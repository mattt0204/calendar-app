import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { PlanBlockWithProduct, ActualBlockWithProduct } from '../lib/types'
import { useTheme } from '../lib/theme'

export interface InspectorTarget {
  kind: 'plan' | 'actual'
  block: PlanBlockWithProduct | ActualBlockWithProduct
}

interface InspectorPanelProps {
  target: InspectorTarget | null
  onClose: () => void
  onRefresh: () => void
  onError: (msg: string) => void
}

export function InspectorPanel({ target, onClose, onRefresh, onError }: InspectorPanelProps) {
  const { getCategoryColor } = useTheme()

  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Sync form state when target changes
  useEffect(() => {
    if (!target) return
    const b = target.block
    setStart(b.start_time.slice(0, 5))  // "HH:MM:SS" → "HH:MM"
    setEnd(b.end_time.slice(0, 5))
    setNote(b.note ?? '')
  }, [target])

  // ESC to close
  useEffect(() => {
    if (!target) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [target, onClose])

  if (!target) return null

  const { kind, block: b } = target
  const color = getCategoryColor(b.product.category)
  const table = kind === 'plan' ? 'plan_blocks' : 'actual_blocks'

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from(table)
      .update({
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        note: note.trim() || null,
      })
      .eq('id', b.id)
    setSaving(false)
    if (error) return onError(error.message)
    onRefresh()
    onClose()
  }

  async function handleDelete() {
    if (!confirm(`${kind} block 삭제?`)) return
    setDeleting(true)
    const { error } = await supabase.from(table).delete().eq('id', b.id)
    setDeleting(false)
    if (error) return onError(error.message)
    onRefresh()
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Block 인스펙터"
        className="fixed top-0 right-0 h-full w-80 z-50 shadow-2xl border-l border-border bg-bg text-fg flex flex-col"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border"
          style={{ borderLeftColor: color, borderLeftWidth: 3 }}
        >
          <div>
            <div className="text-xs text-fg-subtle uppercase tracking-wider">{kind}</div>
            <div className="font-medium text-sm truncate max-w-[200px]">{b.product.name}</div>
          </div>
          <button
            onClick={onClose}
            className="text-fg-subtle hover:text-fg px-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Category badge */}
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: color }}
            />
            <span>{b.product.category.replace(/^\d+_/, '')}</span>
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fg-subtle">시작</span>
              <input
                type="time"
                step={900}
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-bg-elevated border border-border-strong rounded px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-fg-subtle">끝</span>
              <input
                type="time"
                step={900}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-bg-elevated border border-border-strong rounded px-2 py-1.5 font-mono text-sm"
              />
            </label>
          </div>

          {/* Note */}
          <label className="flex flex-col gap-1">
            <span className="text-xs text-fg-subtle">메모</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="이 시간에 뭘 했지..."
              className="bg-bg-elevated border border-border-strong rounded px-2 py-1.5 text-sm resize-none"
            />
          </label>

          {/* Metadata */}
          <div className="text-[11px] text-fg-subtle space-y-0.5 font-mono">
            {b.created_at && (
              <div>생성: {new Date(b.created_at).toLocaleString('ko-KR')}</div>
            )}
            {b.updated_at && b.updated_at !== b.created_at && (
              <div>수정: {new Date(b.updated_at).toLocaleString('ko-KR')}</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-auto pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-accent text-on-accent px-3 py-1.5 rounded font-medium text-sm disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded border border-danger/40 text-danger hover:bg-danger/10 text-sm disabled:opacity-50"
            >
              {deleting ? '...' : '삭제'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
