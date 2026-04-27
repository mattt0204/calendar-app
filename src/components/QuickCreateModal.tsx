import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { Product } from '../lib/types'
import { parseNaturalBlock } from '../lib/nlp'

interface QuickCreateModalProps {
  /** Pre-filled start/end from drag-to-create or natural language */
  prefill: { start: string; end: string; productName?: string } | null
  date: string
  products: Product[]
  onClose: () => void
  onCreated: () => void
  onError: (msg: string) => void
}

export function QuickCreateModal({
  prefill,
  date,
  products,
  onClose,
  onCreated,
  onError,
}: QuickCreateModalProps) {
  const [kind, setKind] = useState<'plan' | 'actual'>('actual')
  const [start, setStart] = useState(prefill?.start ?? '09:00')
  const [end, setEnd] = useState(prefill?.end ?? '10:00')
  const [productId, setProductId] = useState<string>('')
  const [nlInput, setNlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // mount 시 prefill.productName 매칭 시도, 없으면 첫 product default
  useEffect(() => {
    if (productId) return
    if (prefill?.productName) {
      const matched = matchProduct(products, prefill.productName)
      if (matched) {
        setProductId(matched.id)
        return
      }
    }
    if (products.length > 0) setProductId(products[0].id)
  }, [prefill, products, productId])

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
    const matched = matchProduct(products, parsed.productName)
    if (matched) setProductId(matched.id)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!productId) return onError('product 선택 필요 (markdown 으로 추가 후 sync)')

    setSubmitting(true)
    const row = {
      date,
      start_time: `${start}:00`,
      end_time: `${end}:00`,
      product_id: productId,
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
        className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-sm z-50 bg-bg-elevated border border-border-strong rounded-xl shadow-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-sm">빠른 추가 · {date}</span>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg px-1 text-sm">✕</button>
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
            className="flex-1 bg-bg-subtle border border-border-strong rounded px-2 py-1.5 text-sm placeholder-fg-subtle"
          />
          <button
            type="button"
            onClick={handleNlParse}
            className="px-3 py-1.5 rounded bg-bg-subtle hover:bg-border text-sm text-fg-muted"
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
              <span className="text-xs text-fg-subtle">시작</span>
              <input
                type="time" step={900} value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-bg-subtle border border-border-strong rounded px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fg-subtle">끝</span>
              <input
                type="time" step={900} value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-bg-subtle border border-border-strong rounded px-2 py-1.5 font-mono text-sm"
              />
            </label>
          </div>

          {/* Product select (기존 DB 의 product 만) */}
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={products.length === 0}
            className="bg-bg-subtle border border-border-strong rounded px-2 py-1.5 text-sm disabled:opacity-60"
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

          <button
            type="submit" disabled={submitting}
            className="bg-accent text-on-accent px-3 py-2 rounded font-medium text-sm disabled:opacity-50"
          >
            {submitting ? '저장 중...' : '추가'}
          </button>
        </form>
      </div>
    </>
  )
}

function matchProduct(products: Product[], name: string): Product | undefined {
  const lower = name.toLowerCase().trim()
  if (!lower) return undefined
  return (
    products.find((p) => p.name === name) ??
    products.find((p) => p.name.toLowerCase() === lower) ??
    products.find((p) => p.name.toLowerCase().includes(lower)) ??
    products.find((p) => lower.includes(p.name.toLowerCase()))
  )
}
