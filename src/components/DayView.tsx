import { useCallback, useRef, useState } from 'react'
import type {
  PlanBlockWithSubject,
  ActualBlockWithSubject,
} from '../lib/types'
import type { CategoryId } from '../lib/categories'
import { useTheme } from '../lib/theme'

interface DayViewProps {
  planBlocks: PlanBlockWithSubject[]
  actualBlocks: ActualBlockWithSubject[]
  dateLabel: string
  startHour?: number
  endHour?: number
  onBlockClick?: (kind: 'plan' | 'actual', id: string) => void
  /** Called when user drag-to-creates on the grid. start/end are "HH:MM" strings */
  onDragCreate?: (start: string, end: string) => void
}

const HOUR_PX = 60
const HOUR_COL_W = 44  // narrower on mobile; desktop gets more padding
const HEADER_H = 36

function timeToHour(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

interface BlockProps {
  block: PlanBlockWithSubject | ActualBlockWithSubject
  kind: 'plan' | 'actual'
  startHour: number
  getCategoryColor: (id: CategoryId) => string
  onClick?: (id: string) => void
}

function Block({ block: b, kind, startHour, getCategoryColor, onClick }: BlockProps) {
  const start = timeToHour(b.start_time)
  const end = timeToHour(b.end_time)
  const top = (start - startHour) * HOUR_PX
  const height = (end - start) * HOUR_PX - 2
  const color = getCategoryColor(b.subject.category)
  const isPlan = kind === 'plan'

  // plan = 외곽 (left 4 right 4) dashed faint, actual = 안쪽 (left 10 right 10) solid bold.
  // 같은 시간대여도 plan 의 dashed outline 이 actual 양옆으로 6px 가시 → drift 0 일 때도 둘 다 보임.
  const inset = isPlan ? 4 : 10
  const style: React.CSSProperties = {
    top,
    height,
    left: inset,
    right: inset,
    background: isPlan ? `${color}11` : `${color}55`,
    borderColor: isPlan ? `${color}66` : color,
  }

  return (
    <div
      key={`${kind}-${b.id}`}
      data-block="true"
      onClick={onClick ? () => onClick(b.id) : undefined}
      className={[
        'absolute rounded-md px-2 py-1 overflow-hidden',
        isPlan
          ? 'border border-dashed'
          : 'border-l-4 border border-solid shadow-md',
        onClick ? 'cursor-pointer hover:brightness-125' : '',
      ].join(' ')}
      style={style}
      title={`${kind} · ${b.subject.name} · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`}
    >
      <div className="flex items-center gap-1.5 text-sm">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: color }}
        />
        <span className={isPlan ? 'truncate' : 'font-medium truncate'}>
          {b.subject.name}
        </span>
      </div>
      <div className="text-[10px] text-fg-muted mt-0.5 font-mono">
        {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
      </div>
    </div>
  )
}

function snapTo15Min(hour: number): string {
  const totalMinutes = hour * 60
  const snapped = Math.round(totalMinutes / 15) * 15
  const h = Math.floor(snapped / 60)
  const m = snapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function DayView({
  planBlocks,
  actualBlocks,
  dateLabel,
  startHour = 8,
  endHour = 20,
  onBlockClick,
  onDragCreate,
}: DayViewProps) {
  const { getCategoryColor } = useTheme()

  // Drag-to-create state
  const gridRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const [dragRange, setDragRange] = useState<{ top: number; height: number } | null>(null)

  const yToHour = useCallback(
    (y: number) => {
      return startHour + y / HOUR_PX
    },
    [startHour],
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onDragCreate) return
      // Only when clicking on the grid directly (not on a block)
      if ((e.target as HTMLElement).closest('[data-block]')) return
      e.preventDefault()
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = e.clientY - rect.top
      dragStartY.current = y
      setDragRange({ top: y, height: 0 })
    },
    [onDragCreate],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragStartY.current === null) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = e.clientY - rect.top
      const top = Math.min(dragStartY.current, y)
      const height = Math.abs(y - dragStartY.current)
      setDragRange({ top, height })
    },
    [],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragStartY.current === null) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = e.clientY - rect.top
      const startY = Math.min(dragStartY.current, y)
      const endY = Math.max(dragStartY.current, y)

      dragStartY.current = null
      setDragRange(null)

      // Minimum drag = 15px (15 min)
      if (endY - startY < 10) return

      const startHourF = yToHour(startY)
      const endHourF = yToHour(endY)
      const startStr = snapTo15Min(startHourF)
      const endStr = snapTo15Min(endHourF)
      if (startStr !== endStr && onDragCreate) {
        onDragCreate(startStr, endStr)
      }
    },
    [yToHour, onDragCreate],
  )

  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) hours.push(h)
  const totalHeight = (endHour - startHour) * HOUR_PX

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg">
      {/* overflow-x-auto allows horizontal scroll on narrow screens */}
      <div className="flex overflow-x-auto">
        <div
          className="bg-bg-elevated border-r border-border shrink-0"
          style={{ width: HOUR_COL_W }}
        >
          <div
            className="border-b border-border"
            style={{ height: HEADER_H }}
          />
          {hours.map((h) => (
            <div
              key={h}
              className="text-[10px] sm:text-xs text-fg-subtle text-right pr-1 sm:pr-2 pt-1 font-mono"
              style={{ height: HOUR_PX }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
          <div
            className="border-b border-border px-2 sm:px-3 flex items-center justify-between font-medium"
            style={{ height: HEADER_H }}
          >
            <span className="text-sm sm:text-base">{dateLabel}</span>
            <span className="text-[10px] text-fg-subtle font-normal flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm border border-dashed border-fg-muted" />
                plan
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm bg-fg-muted" />
                actual
              </span>
            </span>
          </div>
          <div
            ref={gridRef}
            className="relative"
            style={{ height: totalHeight, cursor: onDragCreate ? 'crosshair' : undefined }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-b border-dotted border-border"
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
              />
            ))}

            {planBlocks.map((b) => (
              <Block
                key={`plan-${b.id}`}
                block={b}
                kind="plan"
                startHour={startHour}
                getCategoryColor={getCategoryColor}
                onClick={onBlockClick && ((id) => onBlockClick('plan', id))}
              />
            ))}
            {actualBlocks.map((b) => (
              <Block
                key={`actual-${b.id}`}
                block={b}
                kind="actual"
                startHour={startHour}
                getCategoryColor={getCategoryColor}
                onClick={onBlockClick && ((id) => onBlockClick('actual', id))}
              />
            ))}

            {/* Drag-to-create preview */}
            {dragRange && dragRange.height > 4 && (
              <div
                className="absolute inset-x-2 rounded border-2 border-dashed border-fg-muted bg-bg-subtle/30 pointer-events-none z-10"
                style={{ top: dragRange.top, height: dragRange.height }}
              >
                <div className="text-[10px] text-fg-muted px-1 pt-0.5 font-mono">
                  {snapTo15Min(yToHour(dragRange.top))} – {snapTo15Min(yToHour(dragRange.top + dragRange.height))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
