import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlanBlockWithProduct, ActualBlockWithProduct } from '../lib/types'
import type { CategoryId } from '../lib/categories'
import { useTheme } from '../lib/theme'

interface WeekViewProps {
  /** 주의 기준 날짜 (보통 월요일 or 해당 주 any date) */
  anchorDate: string
  startHour?: number
  endHour?: number
  onBlockClick?: (kind: 'plan' | 'actual', id: string) => void
  onDayClick?: (date: string) => void
}

const HOUR_PX = 48
const HOUR_COL_W = 36
const HEADER_H = 36
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getWeekDates(anchor: string): string[] {
  const d = new Date(`${anchor}T00:00:00`)
  // Get Monday of the week
  const dow = d.getDay() // 0=Sun
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return formatDate(dd)
  })
}

function timeToHour(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

interface DayBlocksMap {
  plan: Map<string, PlanBlockWithProduct[]>
  actual: Map<string, ActualBlockWithProduct[]>
}

interface BlockDotProps {
  block: PlanBlockWithProduct | ActualBlockWithProduct
  kind: 'plan' | 'actual'
  startHour: number
  getCategoryColor: (id: CategoryId) => string
  onClick?: (id: string) => void
}

function BlockDot({ block: b, kind, startHour, getCategoryColor, onClick }: BlockDotProps) {
  const start = timeToHour(b.start_time)
  const end = timeToHour(b.end_time)
  const top = (start - startHour) * HOUR_PX
  const height = Math.max((end - start) * HOUR_PX - 1, 4)
  const color = getCategoryColor(b.product.category)
  const isPlan = kind === 'plan'

  return (
    <div
      onClick={onClick ? () => onClick(b.id) : undefined}
      className={[
        'absolute inset-x-0.5 rounded-sm overflow-hidden',
        isPlan ? 'border border-dashed opacity-60' : 'border-l-2 border border-solid',
        onClick ? 'cursor-pointer hover:brightness-125' : '',
      ].join(' ')}
      style={{
        top,
        height,
        background: isPlan ? `${color}11` : `${color}44`,
        borderColor: isPlan ? `${color}88` : color,
      }}
      title={`${kind} · ${b.product.name} · ${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`}
    />
  )
}

export function WeekView({
  anchorDate,
  startHour = 8,
  endHour = 20,
  onBlockClick,
  onDayClick,
}: WeekViewProps) {
  const { getCategoryColor } = useTheme()
  const [blocksMap, setBlocksMap] = useState<DayBlocksMap>({
    plan: new Map(),
    actual: new Map(),
  })
  const [loading, setLoading] = useState(false)

  const weekDates = getWeekDates(anchorDate)
  const todayStr = formatDate(new Date())

  useEffect(() => {
    async function load() {
      setLoading(true)
      const from = weekDates[0]
      const to = weekDates[6]

      const [planRes, actualRes] = await Promise.all([
        supabase
          .from('plan_blocks')
          .select('*, product:products(*)')
          .gte('date', from)
          .lte('date', to)
          .order('start_time'),
        supabase
          .from('actual_blocks')
          .select('*, product:products(*)')
          .gte('date', from)
          .lte('date', to)
          .order('start_time'),
      ])
      setLoading(false)

      if (planRes.error || actualRes.error) return

      const planMap = new Map<string, PlanBlockWithProduct[]>()
      const actualMap = new Map<string, ActualBlockWithProduct[]>()

      for (const b of (planRes.data ?? []) as PlanBlockWithProduct[]) {
        if (!planMap.has(b.date)) planMap.set(b.date, [])
        planMap.get(b.date)!.push(b)
      }
      for (const b of (actualRes.data ?? []) as ActualBlockWithProduct[]) {
        if (!actualMap.has(b.date)) actualMap.set(b.date, [])
        actualMap.get(b.date)!.push(b)
      }

      setBlocksMap({ plan: planMap, actual: actualMap })
    }
    load()
  }, [anchorDate])  // re-load when anchor changes (weekDates derived from it)

  const hours: number[] = []
  for (let h = startHour; h < endHour; h++) hours.push(h)
  const totalHeight = (endHour - startHour) * HOUR_PX

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-950">
      {loading && (
        <div className="text-xs text-neutral-600 px-3 py-1 border-b border-neutral-800">
          로딩...
        </div>
      )}
      <div className="flex overflow-x-auto">
        {/* Hour column */}
        <div
          className="bg-neutral-925 border-r border-neutral-800 shrink-0"
          style={{ width: HOUR_COL_W }}
        >
          <div className="border-b border-neutral-800" style={{ height: HEADER_H }} />
          {hours.map((h) => (
            <div
              key={h}
              className="text-[9px] text-neutral-600 text-right pr-1 pt-0.5 font-mono"
              style={{ height: HOUR_PX }}
            >
              {String(h).padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {weekDates.map((date) => {
          const d = new Date(`${date}T00:00:00`)
          const dow = d.getDay()
          const isToday = date === todayStr
          const planBlocks = blocksMap.plan.get(date) ?? []
          const actualBlocks = blocksMap.actual.get(date) ?? []

          return (
            <div
              key={date}
              className="flex-1 border-r border-neutral-800 last:border-r-0"
              style={{ minWidth: 48 }}
            >
              {/* Day header */}
              <div
                className={[
                  'border-b border-neutral-800 flex flex-col items-center justify-center cursor-pointer hover:bg-neutral-800 transition-colors',
                  isToday ? 'bg-neutral-800/50' : '',
                ].join(' ')}
                style={{ height: HEADER_H }}
                onClick={() => onDayClick?.(date)}
              >
                <span className={[
                  'text-[9px] font-medium',
                  dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-neutral-500',
                ].join(' ')}>
                  {DAY_KO[dow]}
                </span>
                <span className={[
                  'text-xs font-mono',
                  isToday ? 'text-neutral-100 font-bold' : 'text-neutral-400',
                ].join(' ')}>
                  {d.getDate()}
                </span>
              </div>

              {/* Blocks grid */}
              <div className="relative" style={{ height: totalHeight }}>
                {hours.map((h, i) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-b border-dotted border-neutral-800/50"
                    style={{ top: i * HOUR_PX, height: HOUR_PX }}
                  />
                ))}
                {planBlocks.map((b) => (
                  <BlockDot
                    key={`plan-${b.id}`}
                    block={b}
                    kind="plan"
                    startHour={startHour}
                    getCategoryColor={getCategoryColor}
                    onClick={onBlockClick && ((id) => onBlockClick('plan', id))}
                  />
                ))}
                {actualBlocks.map((b) => (
                  <BlockDot
                    key={`actual-${b.id}`}
                    block={b}
                    kind="actual"
                    startHour={startHour}
                    getCategoryColor={getCategoryColor}
                    onClick={onBlockClick && ((id) => onBlockClick('actual', id))}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
