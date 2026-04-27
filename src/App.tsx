import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import type {
  ActualBlockWithProduct,
  PlanBlockWithProduct,
  Product,
} from './lib/types'
import { DayView } from './components/DayView'
import { ThemeProvider } from './lib/theme'
import { TweaksPanel } from './components/TweaksPanel'
import { InspectorPanel, type InspectorTarget } from './components/InspectorPanel'
import { CommandPalette } from './components/CommandPalette'
import { WeekView } from './components/WeekView'
import { MonthView } from './components/MonthView'
import { QuickCreateModal } from './components/QuickCreateModal'

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayString = () => formatDate(new Date())

function shiftDate(s: string, days: number): string {
  const d = new Date(`${s}T00:00:00`)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function dateLabel(s: string): string {
  const d = new Date(`${s}T00:00:00`)
  return `${DAY_KO[d.getDay()]} ${d.getDate()}`
}

function AppInner() {
  const [date, setDate] = useState(todayString())
  const [planBlocks, setPlanBlocks] = useState<PlanBlockWithProduct[] | null>(
    null,
  )
  const [actualBlocks, setActualBlocks] = useState<
    ActualBlockWithProduct[] | null
  >(null)
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [view, setView] = useState<'day' | 'week' | 'month'>('day')
  const [quickCreate, setQuickCreate] = useState<{ start: string; end: string } | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const [planRes, actualRes, productsRes] = await Promise.all([
      supabase
        .from('plan_blocks')
        .select('*, product:products(*)')
        .eq('date', date)
        .order('start_time'),
      supabase
        .from('actual_blocks')
        .select('*, product:products(*)')
        .eq('date', date)
        .order('start_time'),
      supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name'),
    ])
    if (planRes.error) return setError(planRes.error.message)
    if (actualRes.error) return setError(actualRes.error.message)
    if (productsRes.error) return setError(productsRes.error.message)
    setPlanBlocks((planRes.data ?? []) as PlanBlockWithProduct[])
    setActualBlocks((actualRes.data ?? []) as ActualBlockWithProduct[])
    setProducts((productsRes.data ?? []) as Product[])
  }, [date])

  useEffect(() => {
    setPlanBlocks(null)
    setActualBlocks(null)
    refresh()
  }, [refresh])

  // Supabase Realtime subscription
  // 다른 client (Discord 봇 / MCP / Siri 등)가 DB를 변경하면 자동 갱신
  useEffect(() => {
    const channel = supabase
      .channel(`calendar-realtime-${date}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_blocks', filter: `date=eq.${date}` },
        () => { refresh() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'actual_blocks', filter: `date=eq.${date}` },
        () => { refresh() },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => { refresh() },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [date, refresh])

  // ⌘P / Ctrl+P global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setCmdOpen((v) => !v)
      }
      // N key = quick create
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)) {
        setQuickCreate({ start: '09:00', end: '10:00' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleBlockClick(kind: 'plan' | 'actual', id: string) {
    const blocks = kind === 'plan' ? planBlocks : actualBlocks
    const block = blocks?.find((b) => b.id === id)
    if (!block) return
    setInspectorTarget({ kind, block })
  }

  const isToday = date === todayString()

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
      <InspectorPanel
        target={inspectorTarget}
        onClose={() => setInspectorTarget(null)}
        onRefresh={refresh}
        onError={setError}
      />
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        planBlocks={planBlocks ?? []}
        actualBlocks={actualBlocks ?? []}
        onNavigateDate={(d) => { setDate(d); setCmdOpen(false) }}
      />
      {quickCreate && (
        <QuickCreateModal
          prefill={quickCreate}
          date={date}
          products={products}
          onClose={() => setQuickCreate(null)}
          onCreated={refresh}
          onError={setError}
        />
      )}
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <header className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 flex-wrap">
          <h1 className="text-lg sm:text-2xl font-bold">나만의 캘린더</h1>
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => setDate((d) => shiftDate(d, -1))}
              className="px-2 py-1 rounded hover:bg-bg-subtle"
              aria-label="이전"
            >
              ←
            </button>
            <button
              onClick={() => setDate(todayString())}
              className={`px-2 py-1 rounded hover:bg-bg-subtle font-medium ${
                isToday ? 'text-fg' : 'text-fg-subtle'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setDate((d) => shiftDate(d, +1))}
              className="px-2 py-1 rounded hover:bg-bg-subtle"
              aria-label="다음"
            >
              →
            </button>
          </div>
          <div className="text-fg-subtle text-sm font-mono">{date}</div>
          {/* View selector */}
          <div className="flex items-center gap-0.5 bg-bg-elevated rounded px-1 py-0.5 text-xs">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-2 py-0.5 rounded transition-colors',
                  view === v
                    ? 'bg-bg-subtle text-fg'
                    : 'text-fg-subtle hover:text-fg-muted',
                ].join(' ')}
              >
                {v === 'day' ? '일' : v === 'week' ? '주' : '월'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTweaksOpen(true)}
            className="px-2 py-1 rounded hover:bg-bg-subtle text-fg-subtle hover:text-fg-muted text-sm"
            aria-label="Tweaks 패널 열기"
            title="Tweaks"
          >
            ⚙
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
            <div className="font-medium text-danger">에러</div>
            <div className="text-danger-muted mt-1 font-mono text-xs">{error}</div>
          </div>
        )}

        {view === 'day' && (
          planBlocks === null || actualBlocks === null ? (
            <div className="rounded-lg border border-border p-4 text-sm text-fg-subtle">
              로딩...
            </div>
          ) : (
            <DayView
              planBlocks={planBlocks}
              actualBlocks={actualBlocks}
              dateLabel={dateLabel(date)}
              onBlockClick={handleBlockClick}
              onDragCreate={(s, e) => setQuickCreate({ start: s, end: e })}
            />
          )
        )}

        {view === 'week' && (
          <WeekView
            anchorDate={date}
            onBlockSelect={setInspectorTarget}
            onDayClick={(d) => { setDate(d); setView('day') }}
          />
        )}

        {view === 'month' && (
          <MonthView
            anchorDate={date}
            onDayClick={(d) => { setDate(d); setView('day') }}
          />
        )}

        <AddBlockForm
          date={date}
          products={products}
          onAdded={refresh}
          onError={setError}
        />
      </div>
    </main>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function AddBlockForm({
  date,
  products,
  onAdded,
  onError,
}: {
  date: string
  products: Product[]
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [kind, setKind] = useState<'plan' | 'actual'>('plan')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [productId, setProductId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // products 로드 시 첫 항목 default 선택
  useEffect(() => {
    if (!productId && products.length > 0) setProductId(products[0].id)
  }, [products, productId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!productId) return onError('product 선택 필요 (markdown 으로 추가 후 sync)')

    setSubmitting(true)
    const row = {
      date,
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      product_id: productId,
    }
    // supabase-js 의 from<RelationName> 은 literal 만 narrow — union 으로 호출 X.
    const { error } =
      kind === 'plan'
        ? await supabase.from('plan_blocks').insert(row)
        : await supabase.from('actual_blocks').insert(row)
    setSubmitting(false)
    if (error) return onError(error.message)
    onAdded()
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 sm:mt-6 rounded-lg border border-border p-3 sm:p-4 grid gap-3"
    >
      <div className="text-sm font-medium text-fg-muted">
        새 block 추가 · {date}
      </div>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={kind === 'plan'}
            onChange={() => setKind('plan')}
          />
          plan
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={kind === 'actual'}
            onChange={() => setKind('actual')}
          />
          actual
        </label>
      </div>

      {/* 시간 선택: 모바일 single column, sm 이상 2열 */}
      <div className="grid grid-cols-2 sm:grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-fg-subtle text-xs w-6">시작</span>
          <input
            type="time"
            step={900}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-bg-elevated border border-border-strong rounded px-2 py-1.5 sm:py-1 font-mono w-full"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-fg-subtle text-xs w-4">끝</span>
          <input
            type="time"
            step={900}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-bg-elevated border border-border-strong rounded px-2 py-1.5 sm:py-1 font-mono w-full"
          />
        </label>
      </div>

      <select
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
        disabled={products.length === 0}
        className="bg-bg-elevated border border-border-strong rounded px-2 py-2 sm:py-1.5 text-sm disabled:opacity-60"
      >
        {products.length === 0 ? (
          <option value="">products 없음 — markdown 으로 추가 후 sync</option>
        ) : (
          products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.category.replace(/^\d+_/, '')}
            </option>
          ))
        )}
      </select>

      <div className="text-[11px] text-fg-subtle">
        product / area 는 markdown SoT — 새 항목은 pa 폴더에 추가 후 sync 로 들어옴.
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-on-accent px-3 py-2 sm:py-1.5 rounded font-medium text-sm disabled:opacity-50"
      >
        {submitting ? '저장 중...' : '추가'}
      </button>
    </form>
  )
}
