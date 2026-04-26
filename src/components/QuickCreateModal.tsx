import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIES, type CategoryId } from '../lib/categories'
import { parseNaturalBlock } from '../lib/nlp'

interface QuickCreateModalProps {
  /** Pre-filled start/end from drag-to-create or natural language */
  prefill: { start: string; end: string; productName?: string } | null
  date: string
  onClose: () => void
  onCreated: () => void
  onError: (msg: string) => void
}

export function QuickCreateModal({
  prefill,
  date,
  onClose,
  onCreated,
  onError,
}: QuickCreateModalProps) {
  const [kind, setKind] = useState<'plan' | 'actual'>('actual')
  const [start, setStart] = useState(prefill?.start ?? '09:00')
  const [end, setEnd] = useState(prefill?.end ?? '10:00')
  const [productName, setProductName] = useState(prefill?.productName ?? '')
  const [category, setCategory] = useState<CategoryId>('8_기타')
  const [nlInput, setNlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleNlParse() {
    const parsed = parseNaturalBlock(nlInput)
    if (!parsed) return
    setStart(parsed.start)
    setEnd(parsed.end)
    setProductName(parsed.productName)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const name = productName.trim()
    if (!name) return onError('product name 비어있음')

    setSubmitting(true)
    const { data: productId, error: rpcError } = await supabase.rpc(
      'get_or_create_product',
      { p_name: name, p_category: category },
    )
    if (rpcError) { setSubmitting(false); return onError(rpcError.message) }

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
    onCreated()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="빠른 block 생성"
        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-sm z-50 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-sm">빠른 추가 · {date}</span>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 px-1 text-sm">✕</button>
        </div>

        {/* Natural language input */}
        <div className="flex gap-2 mb-3">
          <input
            ref={inputRef}
            type="text"
            value={nlInput}
            onChange={(e) => setNlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNlParse() }}}
            placeholder='예: "9시 강의 자료 1시간"'
            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm placeholder-neutral-600"
          />
          <button
            type="button"
            onClick={handleNlParse}
            className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600 text-sm text-neutral-200"
          >
            파싱
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          {/* kind */}
          <div className="flex gap-3 text-sm">
            {(['plan', 'actual'] as const).map((k) => (
              <label key={k} className="flex items-center gap-1.5">
                <input type="radio" checked={kind === k} onChange={() => setKind(k)} />
                {k}
              </label>
            ))}
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">시작</span>
              <input
                type="time" step={900} value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">끝</span>
              <input
                type="time" step={900} value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 font-mono text-sm"
              />
            </label>
          </div>

          {/* Product + category */}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              type="text" placeholder="product name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryId)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <button
            type="submit" disabled={submitting}
            className="bg-neutral-100 text-neutral-900 px-3 py-2 rounded font-medium text-sm disabled:opacity-50"
          >
            {submitting ? '저장 중...' : '추가'}
          </button>
        </form>
      </div>
    </>
  )
}
