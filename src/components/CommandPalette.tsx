import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PlanBlockWithSubject, ActualBlockWithSubject } from '../lib/types'
import { useTheme } from '../lib/theme'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  /** 현재 로드된 plan blocks (검색용 — 날짜 범위 확장 불필요, 현재 날짜만) */
  planBlocks: PlanBlockWithSubject[]
  actualBlocks: ActualBlockWithSubject[]
  /** 날짜 점프 콜백 */
  onNavigateDate: (date: string) => void
}

type CommandItem =
  | { type: 'action'; label: string; description?: string; action: () => void }
  | { type: 'block'; kind: 'plan' | 'actual'; block: PlanBlockWithSubject | ActualBlockWithSubject; onNavigate: (date: string) => void }

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shiftDate(s: string, days: number): string {
  const d = new Date(`${s}T00:00:00`)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function CommandPalette({
  open,
  onClose,
  planBlocks,
  actualBlocks,
  onNavigateDate,
}: CommandPaletteProps) {
  const { getCategoryColor } = useTheme()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const today = formatDate(new Date())

  // Build command items
  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase()

    // Quick nav actions
    const navActions: CommandItem[] = [
      {
        type: 'action',
        label: '오늘',
        description: today,
        action: () => { onNavigateDate(today); onClose() },
      },
      {
        type: 'action',
        label: '어제',
        description: shiftDate(today, -1),
        action: () => { onNavigateDate(shiftDate(today, -1)); onClose() },
      },
      {
        type: 'action',
        label: '내일',
        description: shiftDate(today, 1),
        action: () => { onNavigateDate(shiftDate(today, 1)); onClose() },
      },
    ]

    // Date jump: if query looks like a date (YYYY-MM-DD or MM-DD or 숫자4자리 등)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/
    if (datePattern.test(q)) {
      navActions.unshift({
        type: 'action',
        label: `날짜로 이동: ${q}`,
        description: q,
        action: () => { onNavigateDate(q); onClose() },
      })
    }

    // Block search
    const allBlocks: CommandItem[] = [
      ...planBlocks.map((b): CommandItem => ({
        type: 'block',
        kind: 'plan',
        block: b,
        onNavigate: onNavigateDate,
      })),
      ...actualBlocks.map((b): CommandItem => ({
        type: 'block',
        kind: 'actual',
        block: b,
        onNavigate: onNavigateDate,
      })),
    ]

    if (!q) return navActions

    const matchedNav = navActions.filter((item) => {
      if (item.type !== 'action') return false
      return (
        item.label.toLowerCase().includes(q) ||
        (item.description && item.description.includes(q))
      )
    })

    const matchedBlocks = allBlocks.filter((item) => {
      if (item.type !== 'block') return false
      const b = item.block
      return (
        b.subject.name.toLowerCase().includes(q) ||
        (b.note && b.note.toLowerCase().includes(q)) ||
        b.date.includes(q)
      )
    })

    return [...matchedNav, ...matchedBlocks]
  }, [query, planBlocks, actualBlocks, today, onNavigateDate, onClose])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor((c) => Math.min(c + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor((c) => Math.max(c - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[cursor]
        if (!item) return
        if (item.type === 'action') {
          item.action()
        } else {
          onNavigateDate(item.block.date)
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, items, cursor, onClose, onNavigateDate])

  // Scroll cursor into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const handleItemClick = useCallback((item: CommandItem) => {
    if (item.type === 'action') {
      item.action()
    } else {
      onNavigateDate(item.block.date)
      onClose()
    }
  }, [onNavigateDate, onClose])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-label="커맨드 팔레트"
        className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-bg-elevated border border-border-strong rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-fg-subtle text-sm">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
            placeholder="날짜 이동, block 검색..."
            className="flex-1 bg-transparent text-fg placeholder-fg-subtle text-sm outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-fg-subtle hover:text-fg-muted text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-72 overflow-y-auto"
        >
          {items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-fg-subtle">
              결과 없음
            </div>
          )}
          {items.map((item, i) => {
            const isActive = i === cursor
            if (item.type === 'action') {
              return (
                <div
                  key={`action-${i}`}
                  data-idx={i}
                  onClick={() => handleItemClick(item)}
                  className={[
                    'flex items-center justify-between px-4 py-2.5 cursor-pointer text-sm',
                    isActive ? 'bg-bg-subtle' : 'hover:bg-bg-subtle/50',
                  ].join(' ')}
                >
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="text-fg-subtle font-mono text-xs">{item.description}</span>
                  )}
                </div>
              )
            }
            // block item
            const b = item.block
            const color = getCategoryColor(b.subject.category)
            return (
              <div
                key={`block-${item.kind}-${b.id}`}
                data-idx={i}
                onClick={() => handleItemClick(item)}
                className={[
                  'flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm',
                  isActive ? 'bg-bg-subtle' : 'hover:bg-bg-subtle/50',
                ].join(' ')}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="flex-1 truncate">{b.subject.name}</span>
                <span className="text-fg-subtle font-mono text-xs shrink-0">
                  {b.date} {b.start_time.slice(0, 5)}
                </span>
                <span className={[
                  'text-[10px] px-1 rounded',
                  item.kind === 'plan' ? 'text-fg-subtle border border-border-strong' : 'bg-bg-subtle text-fg-muted',
                ].join(' ')}>
                  {item.kind}
                </span>
              </div>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border text-[11px] text-fg-subtle flex gap-3">
          <span>↑↓ 이동</span>
          <span>Enter 선택</span>
          <span>ESC 닫기</span>
        </div>
      </div>
    </>
  )
}
