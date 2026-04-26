import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import type {
  ActualBlockWithProduct,
  PlanBlockWithProduct,
} from './lib/types'
import { CATEGORIES, type CategoryId } from './lib/categories'
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
  const [error, setError] = useState<string | null>(null)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null)
  const [cmdOpen, setCmdOpen] = useState(false)
  const [view, setView] = useState<'day' | 'week' | 'month'>('day')
  const [quickCreate, setQuickCreate] = useState<{ start: string; end: string } | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    const [planRes, actualRes] = await Promise.all([
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
    ])
    if (planRes.error) return setError(planRes.error.message)
    if (actualRes.error) return setError(actualRes.error.message)
    setPlanBlocks((planRes.data ?? []) as PlanBlockWithProduct[])
    setActualBlocks((actualRes.data ?? []) as ActualBlockWithProduct[])
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
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
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
              className="px-2 py-1 rounded hover:bg-neutral-800"
              aria-label="이전"
            >
              ←
            </button>
            <button
              onClick={() => setDate(todayString())}
              className={`px-2 py-1 rounded hover:bg-neutral-800 font-medium ${
                isToday ? 'text-neutral-100' : 'text-neutral-500'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setDate((d) => shiftDate(d, +1))}
              className="px-2 py-1 rounded hover:bg-neutral-800"
              aria-label="다음"
            >
              →
            </button>
          </div>
          <div className="text-neutral-500 text-sm font-mono">{date}</div>
          {/* View selector */}
          <div className="flex items-center gap-0.5 bg-neutral-900 rounded px-1 py-0.5 text-xs">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={[
                  'px-2 py-0.5 rounded transition-colors',
                  view === v
                    ? 'bg-neutral-700 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300',
                ].join(' ')}
              >
                {v === 'day' ? '일' : v === 'week' ? '주' : '월'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setTweaksOpen(true)}
            className="px-2 py-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 text-sm"
            aria-label="Tweaks 패널 열기"
            title="Tweaks"
          >
            ⚙
          </button>
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm">
            <div className="font-medium text-red-300">에러</div>
            <div className="text-red-400 mt-1 font-mono text-xs">{error}</div>
          </div>
        )}

        {view === 'day' && (
          planBlocks === null || actualBlocks === null ? (
            <div className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-500">
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
  onAdded,
  onError,
}: {
  date: string
  onAdded: () => void
  onError: (m: string) => void
}) {
  const [kind, setKind] = useState<'plan' | 'actual'>('plan')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [productName, setProductName] = useState('')
  const [category, setCategory] = useState<CategoryId>('8_기타')
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const name = productName.trim()
    if (!name) return onError('product name 비어있음')

    setSubmitting(true)
    const { data: productId, error: rpcError } = await supabase.rpc(
      'get_or_create_product',
      { p_name: name, p_category: category },
    )
    if (rpcError) {
      setSubmitting(false)
      return onError(rpcError.message)
    }

    // supabase-js 의 from<RelationName> 은 literal 만 narrow — union 으로 호출 X.
    const row = {
      date,
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      product_id: productId as string,
    }
    const { error } =
      kind === 'plan'
        ? await supabase.from('plan_blocks').insert(row)
        : await supabase.from('actual_blocks').insert(row)
    setSubmitting(false)
    if (error) return onError(error.message)
    setProductName('')
    onAdded()
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 sm:mt-6 rounded-lg border border-neutral-800 p-3 sm:p-4 grid gap-3"
    >
      <div className="text-sm font-medium text-neutral-300">
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
          <span className="text-neutral-500 text-xs w-6">시작</span>
          <input
            type="time"
            step={900}
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 sm:py-1 font-mono w-full"
          />
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-neutral-500 text-xs w-4">끝</span>
          <input
            type="time"
            step={900}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 sm:py-1 font-mono w-full"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          placeholder="product name (예: 강의 자료)"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-2 sm:py-1.5 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryId)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-2 sm:py-1.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-[11px] text-neutral-500">
        동일 name 의 product 가 있으면 카테고리는 무시 — 기존 category 로 묶임.
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-neutral-100 text-neutral-900 px-3 py-2 sm:py-1.5 rounded font-medium text-sm disabled:opacity-50"
      >
        {submitting ? '저장 중...' : '추가'}
      </button>
    </form>
  )
}
