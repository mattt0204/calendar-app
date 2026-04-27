/**
 * sync-pa-subjects.ts
 * --------------------------------------------------------------
 * pa markdown SoT → Supabase `subjects` 테이블 단방향 sync.
 *
 *   pa/1_self/area/<name>/_area.md          → kind = 'area'
 *   pa/2_sw/products/<name>/_product.md     → kind = 'product'
 *
 * 멱등 — `(name, kind)` UNIQUE 위에서 UPSERT, status:archive 는 is_active=false.
 * markdown 이 SoT 이므로 충돌 해결 규칙 없음 (덮어씀).
 *
 * Out-of-scope (의도적 — 후속 ticket 으로 분리):
 *   - pa/3_youtube/* (channel/series/episode) sync
 *   - alias / display name 매핑 (folder 이름 ↔ Matt 발화)
 *   - source provenance 컬럼 (`source: 'pa' | 'manual'`)
 *   - manual_override 보호 (DB 측 수동 변경이 markdown 갱신을 이김)
 *
 * Usage:
 *   bun run sync:pa                       # 양쪽 모두 (default)
 *   bun run sync:pa -- --source=area      # area 만
 *   bun run sync:pa -- --source=product   # product 만
 *   bun run sync:pa -- --dry              # DB 변경 없이 변경 예정만 출력
 *
 * 환경변수: .env.local 의 VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY 자동 로드
 *           (RLS disabled dogfooding 단계 — anon key 로 충분)
 */

import { createClient } from '@supabase/supabase-js'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Database } from '../src/lib/database.types'

// ============================================================
// Config
// ============================================================

const PA_ROOT = '/Users/matt/0_meta/pa'
const AREA_GLOB_DIR = join(PA_ROOT, '1_self', 'area')
const PRODUCT_GLOB_DIR = join(PA_ROOT, '2_sw', 'products')

type SubjectKind = 'product' | 'area'
type CategoryId =
  | '0_compass' | '1_업무' | '2_인간관계' | '3_건강' | '4_재무'
  | '5_체화돌' | '6_언어' | '7_평판' | '8_기타'

const VALID_CATEGORIES: ReadonlySet<CategoryId> = new Set<CategoryId>([
  '0_compass', '1_업무', '2_인간관계', '3_건강', '4_재무',
  '5_체화돌', '6_언어', '7_평판', '8_기타',
])
const DEFAULT_CATEGORY: CategoryId = '8_기타'

interface SubjectRow {
  name: string
  category: CategoryId
  kind: SubjectKind
  is_active: boolean
}

// ============================================================
// .env.local loader (zero-dep)
// ============================================================

function loadEnvLocal() {
  const envPath = join(__dirname, '..', '.env.local')
  if (!existsSync(envPath)) return
  const txt = readFileSync(envPath, 'utf-8')
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
    if (!m) continue
    const [, k, vRaw] = m
    if (process.env[k]) continue  // 기존 환경변수 우선
    process.env[k] = vRaw.replace(/^["']|["']$/g, '').trim()
  }
}

// ============================================================
// Frontmatter parser (top-level scalar 만 — nested object skip)
// ============================================================

function parseFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out: Record<string, string> = {}
  const lines = m[1].split('\n')
  for (const line of lines) {
    // top-level key: value (들여쓰기 있으면 nested 라 skip)
    const km = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/)
    if (!km) continue
    let v = km[2].trim()
    // strip surrounding quotes
    v = v.replace(/^["']|["']$/g, '')
    out[km[1]] = v
  }
  return out
}

// ============================================================
// Category 매핑
// ============================================================

/**
 * frontmatter 의 `initiative` (예: "[[2_인간관계/정신유대/_main]]") 에서
 * 9 카테고리 prefix 를 뽑아 매핑.
 *  - "[[" / "]]" 제거
 *  - 첫 슬래시 전 segment 추출
 *  - 9 카테고리 set 매칭, 없으면 fallback (kind 별 default)
 *
 * SW product 의 initiative 는 종종 "[[0_업무-기존]]" 같이 9 카테고리 외 값.
 * → product fallback = 1_업무, area fallback = 8_기타.
 */
function categoryFromInitiative(
  initiative: string | undefined,
  kind: SubjectKind,
): CategoryId {
  const fallback: CategoryId = kind === 'product' ? '1_업무' : DEFAULT_CATEGORY
  if (!initiative) return fallback
  const cleaned = initiative.replace(/\[\[|\]\]/g, '').trim()
  const head = cleaned.split('/')[0]
  return VALID_CATEGORIES.has(head as CategoryId) ? (head as CategoryId) : fallback
}

// ============================================================
// Scanners
// ============================================================

interface ScanResult {
  rows: SubjectRow[]
  skipped: { name: string; reason: string }[]
}

function scanArea(): ScanResult {
  return scanDir(AREA_GLOB_DIR, '_area.md', 'area')
}

function scanProducts(): ScanResult {
  return scanDir(PRODUCT_GLOB_DIR, '_product.md', 'product')
}

function scanDir(dir: string, fileName: string, kind: SubjectKind): ScanResult {
  const rows: SubjectRow[] = []
  const skipped: { name: string; reason: string }[] = []

  if (!existsSync(dir)) {
    skipped.push({ name: dir, reason: 'directory not found' })
    return { rows, skipped }
  }

  for (const entry of readdirSync(dir)) {
    const sub = join(dir, entry)
    if (!statSync(sub).isDirectory()) continue
    const mdPath = join(sub, fileName)
    if (!existsSync(mdPath)) {
      skipped.push({ name: entry, reason: `no ${fileName}` })
      continue
    }

    const content = readFileSync(mdPath, 'utf-8')
    const fm = parseFrontmatter(content)

    // status 처리
    const status = (fm.status ?? 'active').toLowerCase()
    if (status === 'hypothesis') {
      skipped.push({ name: entry, reason: 'status: hypothesis (skip)' })
      continue
    }

    // name: frontmatter `name` 우선, 없으면 folder 이름
    const name = fm.name?.trim() || entry
    const category = categoryFromInitiative(fm.initiative, kind)
    const isActive = status !== 'archive' && status !== 'archived'

    rows.push({ name, category, kind, is_active: isActive })
  }

  return { rows, skipped }
}

// ============================================================
// Upsert
// ============================================================

async function upsertRows(
  sb: ReturnType<typeof createClient<Database>>,
  rows: SubjectRow[],
  dry: boolean,
) {
  if (rows.length === 0) return { inserted: 0, updated: 0 }

  if (dry) {
    for (const r of rows) {
      console.log(`  [dry] upsert: ${r.kind.padEnd(7)} ${r.name} (${r.category}, active=${r.is_active})`)
    }
    return { inserted: 0, updated: 0 }
  }

  const { error } = await sb
    .from('subjects')
    .upsert(rows, { onConflict: 'name,kind' })

  if (error) throw new Error(`upsert failed: ${error.message}`)

  return { inserted: rows.length, updated: 0 }
}

// ============================================================
// Main
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const sourceArg = args.find((a) => a.startsWith('--source='))?.split('=')[1]
  const source = (sourceArg === 'area' || sourceArg === 'product' ? sourceArg : 'all') as
    'area' | 'product' | 'all'
  return { dry, source }
}

async function main() {
  loadEnvLocal()
  const { dry, source } = parseArgs()

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in env or .env.local')
    process.exit(1)
  }

  const sb = createClient<Database>(url, key)

  console.log(`[sync-pa-subjects] source=${source} dry=${dry}`)

  const all: SubjectRow[] = []
  const allSkipped: { name: string; reason: string }[] = []

  if (source === 'all' || source === 'product') {
    const r = scanProducts()
    console.log(`  products scanned: ${r.rows.length} (skipped ${r.skipped.length})`)
    all.push(...r.rows)
    allSkipped.push(...r.skipped)
  }
  if (source === 'all' || source === 'area') {
    const r = scanArea()
    console.log(`  areas scanned:    ${r.rows.length} (skipped ${r.skipped.length})`)
    all.push(...r.rows)
    allSkipped.push(...r.skipped)
  }

  if (allSkipped.length > 0) {
    console.log('  skipped detail:')
    for (const s of allSkipped) console.log(`    - ${s.name}: ${s.reason}`)
  }

  const result = await upsertRows(sb, all, dry)
  console.log(`[sync-pa-subjects] ${dry ? 'dry-run done' : `upserted ${result.inserted} rows`}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
