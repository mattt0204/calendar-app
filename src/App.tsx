import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import type {
  ActualBlockWithProduct,
  PlanBlockWithProduct,
} from './lib/types'
import { CATEGORIES, type CategoryId } from './lib/categories'
import { DayView } from './components/DayView'

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

export default function App() {
  const [date, setDate] = useState(todayString())
  const [planBlocks, setPlanBlocks] = useState<PlanBlockWithProduct[] | null>(
    null,
  )
  const [actualBlocks, setActualBlocks] = useState<
    ActualBlockWithProduct[] | null
  >(null)
  const [error, setError] = useState<string | null>(null)

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

  async function handleDelete(kind: 'plan' | 'actual', id: string) {
    if (!confirm(`${kind} block 삭제?`)) return
    const table = kind === 'plan' ? 'plan_blocks' : 'actual_blocks'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) return setError(error.message)
    refresh()
  }

  const isToday = date === todayString()

  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100">
      <div className="max-w-3xl mx-auto px-6 py-8">
        <header className="mb-6 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">나만의 캘린더</h1>
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
        </header>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/30 p-3 text-sm">
            <div className="font-medium text-red-300">에러</div>
            <div className="text-red-400 mt-1 font-mono text-xs">{error}</div>
          </div>
        )}

        {planBlocks === null || actualBlocks === null ? (
          <div className="rounded-lg border border-neutral-800 p-4 text-sm text-neutral-500">
            로딩...
          </div>
        ) : (
          <DayView
            planBlocks={planBlocks}
            actualBlocks={actualBlocks}
            dateLabel={dateLabel(date)}
            onBlockClick={handleDelete}
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
      className="mt-6 rounded-lg border border-neutral-800 p-4 grid gap-3"
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

      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 items-center text-sm">
        <span className="text-neutral-500 text-xs">시작</span>
        <input
          type="time"
          step={900}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono"
        />
        <span className="text-neutral-500 text-xs">끝</span>
        <input
          type="time"
          step={900}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono"
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          placeholder="product name (예: 강의 자료)"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as CategoryId)}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-[11px] text-neutral-500">
        💡 동일 name 의 product 가 있으면 카테고리는 무시 — 기존 product 의
        category 로 묶임 (`get_or_create_product` RPC).
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="bg-neutral-100 text-neutral-900 px-3 py-1.5 rounded font-medium text-sm disabled:opacity-50"
      >
        {submitting ? '저장 중...' : '추가'}
      </button>
    </form>
  )
}
