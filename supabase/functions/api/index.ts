/**
 * my-calendar-app Hono + Supabase Edge Function API
 *
 * Deploy: supabase functions deploy api
 * URL: https://<project-ref>.supabase.co/functions/v1/api/...
 *
 * Auth: Authorization: Bearer <MY_CALENDAR_API_KEY>
 *
 * Ref: https://hono.dev/docs/getting-started/supabase-functions
 *
 * 데이터 모델: subjects (kind = 'product' | 'area') · plan_blocks · actual_blocks
 *   - 시간 추적 단위 통합 마스터. SW product + pa/1_self/area/* 양쪽을 다룸.
 */

import { Hono } from 'npm:hono@4'
import { cors } from 'npm:hono@4/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ============================================================
// Types
// ============================================================

type CategoryId =
  | '0_compass' | '1_업무' | '2_인간관계' | '3_건강' | '4_재무'
  | '5_체화돌' | '6_언어' | '7_평판' | '8_기타'

const VALID_CATEGORIES: CategoryId[] = [
  '0_compass', '1_업무', '2_인간관계', '3_건강', '4_재무',
  '5_체화돌', '6_언어', '7_평판', '8_기타',
]

type SubjectKind = 'product' | 'area'
const VALID_KINDS: SubjectKind[] = ['product', 'area']
const DEFAULT_KIND: SubjectKind = 'product'

// ============================================================
// Helpers
// ============================================================

function snap15(timeStr: string): string {
  const parts = timeStr.split(':')
  const h = parseInt(parts[0])
  const m = parseInt(parts[1] ?? '0')
  const snapped = Math.round(m / 15) * 15
  const totalMin = h * 60 + snapped
  const rh = Math.floor(totalMin / 60) % 24
  const rm = totalMin % 60
  return `${String(rh).padStart(2, '0')}:${String(rm).padStart(2, '0')}:00`
}

function is15Aligned(timeStr: string): boolean {
  const parts = timeStr.split(':')
  const m = parseInt(parts[1] ?? '0')
  return m % 15 === 0
}

function errJson(c: unknown, status: number, error: string, message: string, field?: string) {
  // @ts-ignore
  return c.json({ error, message, ...(field ? { field } : {}) }, status)
}

function normalizeKind(k: unknown): SubjectKind {
  if (typeof k === 'string' && VALID_KINDS.includes(k as SubjectKind)) {
    return k as SubjectKind
  }
  return DEFAULT_KIND
}

// ============================================================
// App
// ============================================================

const app = new Hono().basePath('/api')

// CORS — allow GitHub Pages + localhost
app.use('*', cors({
  origin: [
    'https://mattt0204.github.io',
    'http://localhost:5173',
    'http://localhost:3000',
  ],
  allowHeaders: ['Authorization', 'Content-Type'],
}))

// Auth middleware
app.use('*', async (c, next) => {
  const apiKey = Deno.env.get('MY_CALENDAR_API_KEY')
  if (!apiKey) {
    return errJson(c, 500, 'server_error', 'API key not configured')
  }
  const auth = c.req.header('Authorization')
  if (!auth || auth !== `Bearer ${apiKey}`) {
    return errJson(c, 401, 'unauthorized', 'Invalid or missing API key')
  }
  await next()
})

function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}

// ============================================================
// GET /blocks?from=&to=&type=plan|actual|both
// ============================================================
app.get('/blocks', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  const type = c.req.query('type') ?? 'both'

  if (!from || !to) {
    return errJson(c, 400, 'validation_failed', 'from and to query params required')
  }

  const sb = getSupabase()
  const result: Record<string, unknown> = {}

  if (type === 'plan' || type === 'both') {
    const { data, error } = await sb
      .from('plan_blocks')
      .select('*, subject:subjects(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('start_time')
    if (error) return errJson(c, 500, 'db_error', error.message)
    result.plan = data
  }

  if (type === 'actual' || type === 'both') {
    const { data, error } = await sb
      .from('actual_blocks')
      .select('*, subject:subjects(*)')
      .gte('date', from)
      .lte('date', to)
      .order('date')
      .order('start_time')
    if (error) return errJson(c, 500, 'db_error', error.message)
    result.actual = data
  }

  return c.json(result)
})

// ============================================================
// GET /blocks/:id
// ============================================================
app.get('/blocks/:id', async (c) => {
  const id = c.req.param('id')
  const sb = getSupabase()

  const { data: plan } = await sb
    .from('plan_blocks')
    .select('*, subject:subjects(*)')
    .eq('id', id)
    .maybeSingle()
  if (plan) return c.json(plan)

  const { data: actual } = await sb
    .from('actual_blocks')
    .select('*, subject:subjects(*)')
    .eq('id', id)
    .maybeSingle()
  if (actual) return c.json(actual)

  return errJson(c, 404, 'not_found', `Block ${id} not found`)
})

// ============================================================
// GET /subjects?active=true&kind=product|area
// ============================================================
app.get('/subjects', async (c) => {
  const activeParam = c.req.query('active')
  const kindParam = c.req.query('kind')
  const sb = getSupabase()

  let query = sb.from('subjects').select('*').order('name')
  if (activeParam === 'true') {
    query = query.eq('is_active', true)
  }
  if (kindParam && VALID_KINDS.includes(kindParam as SubjectKind)) {
    query = query.eq('kind', kindParam)
  }

  const { data, error } = await query
  if (error) return errJson(c, 500, 'db_error', error.message)
  return c.json(data)
})

// ============================================================
// GET /summary/daily?date=YYYY-MM-DD
// ============================================================
app.get('/summary/daily', async (c) => {
  const date = c.req.query('date')
  if (!date) return errJson(c, 400, 'validation_failed', 'date query param required')

  const sb = getSupabase()
  const [planRes, actualRes] = await Promise.all([
    sb.from('plan_blocks').select('subject_id, start_time, end_time').eq('date', date),
    sb.from('actual_blocks').select('subject_id, start_time, end_time').eq('date', date),
  ])
  if (planRes.error) return errJson(c, 500, 'db_error', planRes.error.message)
  if (actualRes.error) return errJson(c, 500, 'db_error', actualRes.error.message)

  function toMinutes(blocks: { subject_id: string; start_time: string; end_time: string }[]) {
    const map: Record<string, number> = {}
    for (const b of blocks) {
      const [sh, sm] = b.start_time.split(':').map(Number)
      const [eh, em] = b.end_time.split(':').map(Number)
      const diff = (eh * 60 + em) - (sh * 60 + sm)
      map[b.subject_id] = (map[b.subject_id] ?? 0) + diff
    }
    return map
  }

  return c.json({
    date,
    plan_minutes_by_subject: toMinutes(planRes.data ?? []),
    actual_minutes_by_subject: toMinutes(actualRes.data ?? []),
  })
})

// ============================================================
// GET /summary/weekly?week_start=YYYY-MM-DD
// ============================================================
app.get('/summary/weekly', async (c) => {
  const weekStart = c.req.query('week_start')
  if (!weekStart) return errJson(c, 400, 'validation_failed', 'week_start query param required')

  const d = new Date(`${weekStart}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  const weekEnd = d.toISOString().slice(0, 10)

  const sb = getSupabase()
  const [planRes, actualRes, subjectsRes] = await Promise.all([
    sb.from('plan_blocks').select('subject_id, start_time, end_time').gte('date', weekStart).lte('date', weekEnd),
    sb.from('actual_blocks').select('subject_id, start_time, end_time').gte('date', weekStart).lte('date', weekEnd),
    sb.from('subjects').select('*'),
  ])
  if (planRes.error) return errJson(c, 500, 'db_error', planRes.error.message)
  if (actualRes.error) return errJson(c, 500, 'db_error', actualRes.error.message)
  if (subjectsRes.error) return errJson(c, 500, 'db_error', subjectsRes.error.message)

  const subjects = subjectsRes.data ?? []
  const planMin: Record<string, number> = {}
  const actualMin: Record<string, number> = {}

  for (const b of planRes.data ?? []) {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    planMin[b.subject_id] = (planMin[b.subject_id] ?? 0) + (eh * 60 + em) - (sh * 60 + sm)
  }
  for (const b of actualRes.data ?? []) {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    actualMin[b.subject_id] = (actualMin[b.subject_id] ?? 0) + (eh * 60 + em) - (sh * 60 + sm)
  }

  const allIds = new Set([...Object.keys(planMin), ...Object.keys(actualMin)])
  const bySubject = [...allIds].map((sid) => ({
    subject: subjects.find((s) => s.id === sid) ?? null,
    plan_min: planMin[sid] ?? 0,
    actual_min: actualMin[sid] ?? 0,
  })).filter((x) => x.subject !== null)

  return c.json({ week_start: weekStart, by_subject: bySubject })
})

// ============================================================
// POST /blocks/plan  — new plan block
// body: { date, start_time, end_time, subject_name, subject_kind?, note? }
// ============================================================
app.post('/blocks/plan', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { date, start_time, end_time, subject_name, subject_kind, note } = body
  if (!date || !start_time || !end_time || !subject_name) {
    return errJson(c, 400, 'validation_failed', 'date, start_time, end_time, subject_name required')
  }

  const startSnap = snap15(start_time)
  const endSnap = snap15(end_time)
  if (!is15Aligned(startSnap)) return errJson(c, 400, 'validation_failed', 'start_time must be 15-min aligned', 'start_time')
  if (!is15Aligned(endSnap)) return errJson(c, 400, 'validation_failed', 'end_time must be 15-min aligned', 'end_time')
  if (endSnap <= startSnap) return errJson(c, 400, 'validation_failed', 'end_time must be after start_time', 'end_time')

  const sb = getSupabase()
  const { data: subjectId, error: rpcError } = await sb.rpc('get_or_create_subject', {
    p_name: subject_name,
    p_category: '8_기타',
    p_kind: normalizeKind(subject_kind),
  })
  if (rpcError) return errJson(c, 500, 'db_error', rpcError.message)

  const { data, error } = await sb.from('plan_blocks').insert({
    date,
    start_time: startSnap,
    end_time: endSnap,
    subject_id: subjectId,
    note: note ?? null,
  }).select('*, subject:subjects(*)').single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  return c.json(data, 201)
})

// ============================================================
// POST /blocks/actual/start
// body: { subject_name, subject_kind?, started_at? }
// ============================================================
app.post('/blocks/actual/start', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { subject_name, subject_kind, started_at } = body
  if (!subject_name) return errJson(c, 400, 'validation_failed', 'subject_name required')

  const now = started_at ? new Date(started_at) : new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const snappedM = Math.round(m / 15) * 15
  const startStr = `${String(h).padStart(2, '0')}:${String(snappedM % 60).padStart(2, '0')}:00`
  const endMin = h * 60 + snappedM + 15
  const endStr = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const sb = getSupabase()
  const { data: subjectId, error: rpcError } = await sb.rpc('get_or_create_subject', {
    p_name: subject_name,
    p_category: '8_기타',
    p_kind: normalizeKind(subject_kind),
  })
  if (rpcError) return errJson(c, 500, 'db_error', rpcError.message)

  const { data, error } = await sb.from('actual_blocks').insert({
    date: dateStr,
    start_time: startStr,
    end_time: endStr,
    subject_id: subjectId,
  }).select('*, subject:subjects(*)').single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  return c.json(data, 201)
})

// ============================================================
// POST /blocks/actual/:id/stop
// ============================================================
app.post('/blocks/actual/:id/stop', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => ({}))
  const { ended_at } = body

  const now = ended_at ? new Date(ended_at) : new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const snappedM = Math.round(m / 15) * 15
  const endStr = `${String(h).padStart(2, '0')}:${String(snappedM % 60).padStart(2, '0')}:00`

  const sb = getSupabase()
  const { data, error } = await sb
    .from('actual_blocks')
    .update({ end_time: endStr })
    .eq('id', id)
    .select('*, subject:subjects(*)')
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Block ${id} not found`)
  return c.json(data)
})

// ============================================================
// PATCH /blocks/:id
// body: { note?, start_time?, end_time?, subject_name?, subject_kind? }
// ============================================================
app.patch('/blocks/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { note, start_time, end_time, subject_name, subject_kind } = body
  const sb = getSupabase()

  const { data: existing } = await sb
    .from('plan_blocks')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  const table = existing ? 'plan_blocks' : 'actual_blocks'

  const updates: Record<string, unknown> = {}
  if (note !== undefined) updates.note = note
  if (start_time) updates.start_time = snap15(start_time)
  if (end_time) updates.end_time = snap15(end_time)
  if (subject_name) {
    const { data: subjectId, error: rpcError } = await sb.rpc('get_or_create_subject', {
      p_name: subject_name,
      p_category: '8_기타',
      p_kind: normalizeKind(subject_kind),
    })
    if (rpcError) return errJson(c, 500, 'db_error', rpcError.message)
    updates.subject_id = subjectId
  }

  const { data, error } = await sb
    .from(table as 'plan_blocks' | 'actual_blocks')
    .update(updates)
    .eq('id', id)
    .select('*, subject:subjects(*)')
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Block ${id} not found`)
  return c.json(data)
})

// ============================================================
// DELETE /blocks/:id
// ============================================================
app.delete('/blocks/:id', async (c) => {
  const id = c.req.param('id')
  const sb = getSupabase()

  const { data: inPlan } = await sb.from('plan_blocks').select('id').eq('id', id).maybeSingle()
  const table = inPlan ? 'plan_blocks' : 'actual_blocks'

  const { error } = await sb.from(table as 'plan_blocks' | 'actual_blocks').delete().eq('id', id)
  if (error) return errJson(c, 500, 'db_error', error.message)
  return c.json({ deleted: id })
})

// ============================================================
// POST /subjects
// body: { name, category, kind?, color? }
// ============================================================
app.post('/subjects', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { name, category, kind, color } = body
  if (!name || !category) return errJson(c, 400, 'validation_failed', 'name and category required')
  if (!VALID_CATEGORIES.includes(category)) {
    return errJson(c, 400, 'validation_failed', `Invalid category: ${category}`, 'category')
  }
  const safeKind = normalizeKind(kind)

  const sb = getSupabase()
  const { data, error } = await sb
    .from('subjects')
    .insert({ name, category, kind: safeKind, color: color ?? null })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return errJson(c, 409, 'conflict', `Subject '${name}' (kind=${safeKind}) already exists`)
    return errJson(c, 500, 'db_error', error.message)
  }
  return c.json(data, 201)
})

// ============================================================
// PATCH /subjects/:id
// ============================================================
app.patch('/subjects/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { name, category, kind, color, is_active } = body
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      return errJson(c, 400, 'validation_failed', `Invalid category: ${category}`, 'category')
    }
    updates.category = category
  }
  if (kind !== undefined) {
    if (!VALID_KINDS.includes(kind)) {
      return errJson(c, 400, 'validation_failed', `Invalid kind: ${kind}`, 'kind')
    }
    updates.kind = kind
  }
  if (color !== undefined) updates.color = color
  if (is_active !== undefined) updates.is_active = is_active

  const sb = getSupabase()
  const { data, error } = await sb
    .from('subjects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Subject ${id} not found`)
  return c.json(data)
})

// ============================================================
// DELETE /subjects/:id (soft delete via is_active=false)
// ============================================================
app.delete('/subjects/:id', async (c) => {
  const id = c.req.param('id')
  const sb = getSupabase()

  const { data, error } = await sb
    .from('subjects')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Subject ${id} not found`)
  return c.json({ deleted: id, soft: true })
})

// ============================================================
// Export for Deno
// ============================================================
Deno.serve(app.fetch)
