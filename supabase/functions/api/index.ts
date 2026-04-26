/**
 * my-calendar-app Hono + Supabase Edge Function API
 *
 * Deploy: supabase functions deploy api
 * URL: https://<project-ref>.supabase.co/functions/v1/api/...
 *
 * Auth: Authorization: Bearer <MY_CALENDAR_API_KEY>
 *
 * Ref: https://hono.dev/docs/getting-started/supabase-functions
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

// ============================================================
// Helpers
// ============================================================

function snap15(timeStr: string): string {
  // "HH:MM" or "HH:MM:SS" → snap minutes to nearest 15
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
    // Key not configured — fail safe
    return errJson(c, 500, 'server_error', 'API key not configured')
  }
  const auth = c.req.header('Authorization')
  if (!auth || auth !== `Bearer ${apiKey}`) {
    return errJson(c, 401, 'unauthorized', 'Invalid or missing API key')
  }
  await next()
})

// Supabase client factory (per-request, uses service role key)
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
      .select('*, product:products(*)')
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
      .select('*, product:products(*)')
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

  // Try plan first, then actual
  const { data: plan } = await sb
    .from('plan_blocks')
    .select('*, product:products(*)')
    .eq('id', id)
    .maybeSingle()
  if (plan) return c.json(plan)

  const { data: actual } = await sb
    .from('actual_blocks')
    .select('*, product:products(*)')
    .eq('id', id)
    .maybeSingle()
  if (actual) return c.json(actual)

  return errJson(c, 404, 'not_found', `Block ${id} not found`)
})

// ============================================================
// GET /products?active=true
// ============================================================
app.get('/products', async (c) => {
  const activeParam = c.req.query('active')
  const sb = getSupabase()

  let query = sb.from('products').select('*').order('name')
  if (activeParam === 'true') {
    query = query.eq('is_active', true)
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
    sb.from('plan_blocks').select('product_id, start_time, end_time').eq('date', date),
    sb.from('actual_blocks').select('product_id, start_time, end_time').eq('date', date),
  ])
  if (planRes.error) return errJson(c, 500, 'db_error', planRes.error.message)
  if (actualRes.error) return errJson(c, 500, 'db_error', actualRes.error.message)

  function toMinutes(blocks: { product_id: string; start_time: string; end_time: string }[]) {
    const map: Record<string, number> = {}
    for (const b of blocks) {
      const [sh, sm] = b.start_time.split(':').map(Number)
      const [eh, em] = b.end_time.split(':').map(Number)
      const diff = (eh * 60 + em) - (sh * 60 + sm)
      map[b.product_id] = (map[b.product_id] ?? 0) + diff
    }
    return map
  }

  return c.json({
    date,
    plan_minutes_by_product: toMinutes(planRes.data ?? []),
    actual_minutes_by_product: toMinutes(actualRes.data ?? []),
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
  const [planRes, actualRes, productsRes] = await Promise.all([
    sb.from('plan_blocks').select('product_id, start_time, end_time').gte('date', weekStart).lte('date', weekEnd),
    sb.from('actual_blocks').select('product_id, start_time, end_time').gte('date', weekStart).lte('date', weekEnd),
    sb.from('products').select('*'),
  ])
  if (planRes.error) return errJson(c, 500, 'db_error', planRes.error.message)
  if (actualRes.error) return errJson(c, 500, 'db_error', actualRes.error.message)
  if (productsRes.error) return errJson(c, 500, 'db_error', productsRes.error.message)

  const products = productsRes.data ?? []
  const planMin: Record<string, number> = {}
  const actualMin: Record<string, number> = {}

  for (const b of planRes.data ?? []) {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    planMin[b.product_id] = (planMin[b.product_id] ?? 0) + (eh * 60 + em) - (sh * 60 + sm)
  }
  for (const b of actualRes.data ?? []) {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    actualMin[b.product_id] = (actualMin[b.product_id] ?? 0) + (eh * 60 + em) - (sh * 60 + sm)
  }

  const allProductIds = new Set([...Object.keys(planMin), ...Object.keys(actualMin)])
  const byProduct = [...allProductIds].map((pid) => ({
    product: products.find((p) => p.id === pid) ?? null,
    plan_min: planMin[pid] ?? 0,
    actual_min: actualMin[pid] ?? 0,
  })).filter((x) => x.product !== null)

  return c.json({ week_start: weekStart, by_product: byProduct })
})

// ============================================================
// POST /blocks/plan  — new plan block
// ============================================================
app.post('/blocks/plan', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { date, start_time, end_time, product_name, note } = body
  if (!date || !start_time || !end_time || !product_name) {
    return errJson(c, 400, 'validation_failed', 'date, start_time, end_time, product_name required')
  }

  const startSnap = snap15(start_time)
  const endSnap = snap15(end_time)
  if (!is15Aligned(startSnap)) return errJson(c, 400, 'validation_failed', 'start_time must be 15-min aligned', 'start_time')
  if (!is15Aligned(endSnap)) return errJson(c, 400, 'validation_failed', 'end_time must be 15-min aligned', 'end_time')
  if (endSnap <= startSnap) return errJson(c, 400, 'validation_failed', 'end_time must be after start_time', 'end_time')

  const sb = getSupabase()
  const { data: productId, error: rpcError } = await sb.rpc('get_or_create_product', {
    p_name: product_name,
    p_category: '8_기타',
  })
  if (rpcError) return errJson(c, 500, 'db_error', rpcError.message)

  const { data, error } = await sb.from('plan_blocks').insert({
    date,
    start_time: startSnap,
    end_time: endSnap,
    product_id: productId,
    note: note ?? null,
  }).select('*, product:products(*)').single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  return c.json(data, 201)
})

// ============================================================
// POST /blocks/actual/start — start an actual block (end_time = start+1min placeholder)
// ============================================================
app.post('/blocks/actual/start', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { product_name, started_at } = body
  if (!product_name) return errJson(c, 400, 'validation_failed', 'product_name required')

  const now = started_at ? new Date(started_at) : new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  const snappedM = Math.round(m / 15) * 15
  const startStr = `${String(h).padStart(2, '0')}:${String(snappedM % 60).padStart(2, '0')}:00`
  // end = start + 15 min (placeholder; stopped via /stop)
  const endMin = h * 60 + snappedM + 15
  const endStr = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00`
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const sb = getSupabase()
  const { data: productId, error: rpcError } = await sb.rpc('get_or_create_product', {
    p_name: product_name,
    p_category: '8_기타',
  })
  if (rpcError) return errJson(c, 500, 'db_error', rpcError.message)

  const { data, error } = await sb.from('actual_blocks').insert({
    date: dateStr,
    start_time: startStr,
    end_time: endStr,
    product_id: productId,
  }).select('*, product:products(*)').single()
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
    .select('*, product:products(*)')
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Block ${id} not found`)
  return c.json(data)
})

// ============================================================
// PATCH /blocks/:id
// ============================================================
app.patch('/blocks/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { note, start_time, end_time, product_name } = body
  const sb = getSupabase()

  // Determine which table
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
  if (product_name) {
    const { data: productId, error: rpcError } = await sb.rpc('get_or_create_product', {
      p_name: product_name,
      p_category: '8_기타',
    })
    if (rpcError) return errJson(c, 500, 'db_error', rpcError.message)
    updates.product_id = productId
  }

  const { data, error } = await sb
    .from(table as 'plan_blocks' | 'actual_blocks')
    .update(updates)
    .eq('id', id)
    .select('*, product:products(*)')
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
// POST /products
// ============================================================
app.post('/products', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { name, category, color } = body
  if (!name || !category) return errJson(c, 400, 'validation_failed', 'name and category required')
  if (!VALID_CATEGORIES.includes(category)) {
    return errJson(c, 400, 'validation_failed', `Invalid category: ${category}`, 'category')
  }

  const sb = getSupabase()
  const { data, error } = await sb
    .from('products')
    .insert({ name, category, color: color ?? null })
    .select()
    .single()
  if (error) {
    if (error.code === '23505') return errJson(c, 409, 'conflict', `Product '${name}' already exists`)
    return errJson(c, 500, 'db_error', error.message)
  }
  return c.json(data, 201)
})

// ============================================================
// PATCH /products/:id
// ============================================================
app.patch('/products/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  if (!body) return errJson(c, 400, 'validation_failed', 'Invalid JSON body')

  const { name, category, color, is_active } = body
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (category !== undefined) {
    if (!VALID_CATEGORIES.includes(category)) {
      return errJson(c, 400, 'validation_failed', `Invalid category: ${category}`, 'category')
    }
    updates.category = category
  }
  if (color !== undefined) updates.color = color
  if (is_active !== undefined) updates.is_active = is_active

  const sb = getSupabase()
  const { data, error } = await sb
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Product ${id} not found`)
  return c.json(data)
})

// ============================================================
// DELETE /products/:id (soft delete via is_active=false)
// ============================================================
app.delete('/products/:id', async (c) => {
  const id = c.req.param('id')
  const sb = getSupabase()

  // Soft delete
  const { data, error } = await sb
    .from('products')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()
  if (error) return errJson(c, 500, 'db_error', error.message)
  if (!data) return errJson(c, 404, 'not_found', `Product ${id} not found`)
  return c.json({ deleted: id, soft: true })
})

// ============================================================
// Export for Deno
// ============================================================
Deno.serve(app.fetch)
