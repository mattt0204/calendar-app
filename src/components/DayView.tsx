import type {
  PlanBlockWithProduct,
  ActualBlockWithProduct,
} from '../lib/types'
import { CATEGORY_BY_ID } from '../lib/categories'

interface DayViewProps {
  planBlocks: PlanBlockWithProduct[]
  actualBlocks: ActualBlockWithProduct[]
  dateLabel: string
  startHour?: number
  endHour?: number
  onBlockClick?: (kind: 'plan' | 'actual', id: string) => void
}

const HOUR_PX = 60
const HOUR_COL_W = 44  // narrower on mobile; desktop gets more padding
const HEADER_H = 36

function timeToHour(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

interface RenderOpts {
  kind: 'plan' | 'actual'
  startHour: number
  onClick?: (id: string) => void
}

function renderBlock(
  b: PlanBlockWithProduct | ActualBlockWithProduct,
  opts: RenderOpts,
) {
  const start = timeToHour(b.start_time)
  const end = timeToHour(b.end_time)
  const top = (start - opts.startHour) * HOUR_PX
  const height = (end - start) * HOUR_PX - 2
  const cat = CATEGORY_BY_ID[b.product.category]
  const isPlan = opts.kind === 'plan'

  // plan = 외곽 (left 4 right 4) dashed faint, actual = 안쪽 (left 10 right 10) solid bold.
  // 같은 시간대여도 plan 의 dashed outline 이 actual 양옆으로 6px 가시 → drift 0 일 때도 둘 다 보임.
  const inset = isPlan ? 4 : 10
  const style: React.CSSProperties = {
    top,
    height,
    left: inset,
    right: inset,
    background: isPlan ? `${cat.color}11` : `${cat.color}55`,
    borderColor: isPlan ? `${cat.color}66` : cat.color,
  }

  return (
    <div
      key={`${opts.kind}-${b.id}`}
      onClick={opts.onClick ? () => opts.onClick!(b.id) : undefined}
      className={[
        'absolute rounded-md px-2 py-1 overflow-hidden',
        isPlan
          ? 'border border-dashed'
          : 'border-l-4 border border-solid shadow-md',
        opts.onClick ? 'cursor-pointer hover:brightness-125' : '',
      ].join(' ')}
      style={style}
      title={`${opts.kind} · ${b.product.name} · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`}
    >
      <div className="flex items-center gap-1.5 text-sm">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: cat.color }}
        />
        <span className={isPlan ? 'truncate' : 'font-medium truncate'}>
          {b.product.name}
        </span>
      </div>
      <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
        {b.start_time.slice(0, 5)}–{b.end_time.slice(0, 5)}
      </div>
    </div>
  )
}

export function DayView({
  planBlocks,
  actualBlocks,
  dateLabel,
  startHour = 8,
  endHour = 20,
  onBlockClick,
}: DayViewProps) {
  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) hours.push(h)
  const totalHeight = (endHour - startHour) * HOUR_PX

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950">
      {/* overflow-x-auto allows horizontal scroll on narrow screens */}
      <div className="flex overflow-x-auto">
        <div
          className="bg-neutral-925 border-r border-neutral-800 shrink-0"
          style={{ width: HOUR_COL_W }}
        >
          <div
            className="border-b border-neutral-800"
            style={{ height: HEADER_H }}
          />
          {hours.map((h) => (
            <div
              key={h}
              className="text-[10px] sm:text-xs text-neutral-500 text-right pr-1 sm:pr-2 pt-1 font-mono"
              style={{ height: HOUR_PX }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
          <div
            className="border-b border-neutral-800 px-2 sm:px-3 flex items-center justify-between font-medium"
            style={{ height: HEADER_H }}
          >
            <span className="text-sm sm:text-base">{dateLabel}</span>
            <span className="text-[10px] text-neutral-500 font-normal flex items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm border border-dashed border-neutral-500" />
                plan
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm bg-neutral-500" />
                actual
              </span>
            </span>
          </div>
          <div className="relative" style={{ height: totalHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute inset-x-0 border-b border-dotted border-neutral-800"
                style={{ top: i * HOUR_PX, height: HOUR_PX }}
              />
            ))}

            {planBlocks.map((b) =>
              renderBlock(b, {
                kind: 'plan',
                startHour,
                onClick: onBlockClick && ((id) => onBlockClick('plan', id)),
              }),
            )}
            {actualBlocks.map((b) =>
              renderBlock(b, {
                kind: 'actual',
                startHour,
                onClick: onBlockClick && ((id) => onBlockClick('actual', id)),
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
