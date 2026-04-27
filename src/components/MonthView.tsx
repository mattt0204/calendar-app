import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PlanBlockWithSubject, ActualBlockWithSubject } from '../lib/types'
import type { CategoryId } from '../lib/categories'
import { useTheme } from '../lib/theme'

interface MonthViewProps {
  /** 기준 날짜 (해당 달의 any date) */
  anchorDate: string
  onDayClick?: (date: string) => void
}

const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthGrid(anchor: string): { date: string; isCurrentMonth: boolean }[][] {
  const d = new Date(`${anchor}T00:00:00`)
  const year = d.getFullYear()
  const month = d.getMonth()

  // First day of month
  const firstDay = new Date(year, month, 1)
  // Last day of month
  const lastDay = new Date(year, month + 1, 0)

  // Start from Monday of the week containing firstDay
  const startDow = firstDay.getDay() // 0=Sun
  const startOffset = (startDow + 6) % 7 // offset to Monday
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - startOffset)

  const weeks: { date: string; isCurrentMonth: boolean }[][] = []
  let cur = new Date(start)

  while (cur <= lastDay || weeks.length < 4 || cur.getDay() !== 1) {
    if (weeks.length === 0 || cur.getDay() === 1) {
      weeks.push([])
    }
    weeks[weeks.length - 1].push({
      date: formatDate(cur),
      isCurrentMonth: cur.getMonth() === month,
    })
    cur.setDate(cur.getDate() + 1)
    if (weeks.length >= 6 && cur.getDay() === 1) break
  }

  return weeks
}

interface DayStats {
  totalActualHours: number
  categoryColors: string[]  // top 3 categories by time
}

function computeDayStats(
  blocks: ActualBlockWithSubject[],
  getCategoryColor: (id: CategoryId) => string,
): DayStats {
  if (blocks.length === 0) return { totalActualHours: 0, categoryColors: [] }

  const catTime = new Map<CategoryId, number>()
  let total = 0
  for (const b of blocks) {
    const [sh, sm] = b.start_time.split(':').map(Number)
    const [eh, em] = b.end_time.split(':').map(Number)
    const hours = (eh + em / 60) - (sh + sm / 60)
    catTime.set(b.subject.category, (catTime.get(b.subject.category) ?? 0) + hours)
    total += hours
  }

  // Sort by time desc, take top 3
  const sorted = [...catTime.entries()].sort((a, b) => b[1] - a[1])
  const topColors = sorted.slice(0, 3).map(([id]) => getCategoryColor(id))

  return { totalActualHours: total, categoryColors: topColors }
}

export function MonthView({ anchorDate, onDayClick }: MonthViewProps) {
  const { getCategoryColor } = useTheme()
  const [actualMap, setActualMap] = useState<Map<string, ActualBlockWithSubject[]>>(new Map())
  const [planMap, setPlanMap] = useState<Map<string, PlanBlockWithSubject[]>>(new Map())
  const [loading, setLoading] = useState(false)

  const d = new Date(`${anchorDate}T00:00:00`)
  const year = d.getFullYear()
  const month = d.getMonth()
  const monthLabel = `${year}년 ${month + 1}월`
  const todayStr = formatDate(new Date())

  const grid = getMonthGrid(anchorDate)

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Include prev/next month overflow cells
      const fromD = new Date(year, month, 1)
      fromD.setDate(fromD.getDate() - 6)
      const toD = new Date(year, month + 1, 0)
      toD.setDate(toD.getDate() + 6)
      const to = formatDate(toD)

      const [planRes, actualRes] = await Promise.all([
        supabase
          .from('plan_blocks')
          .select('*, subject:subjects(*)')
          .gte('date', formatDate(fromD))
          .lte('date', to)
          .order('start_time'),
        supabase
          .from('actual_blocks')
          .select('*, subject:subjects(*)')
          .gte('date', formatDate(fromD))
          .lte('date', to)
          .order('start_time'),
      ])
      setLoading(false)
      if (planRes.error || actualRes.error) return

      const pm = new Map<string, PlanBlockWithSubject[]>()
      const am = new Map<string, ActualBlockWithSubject[]>()
      for (const b of (planRes.data ?? []) as PlanBlockWithSubject[]) {
        if (!pm.has(b.date)) pm.set(b.date, [])
        pm.get(b.date)!.push(b)
      }
      for (const b of (actualRes.data ?? []) as ActualBlockWithSubject[]) {
        if (!am.has(b.date)) am.set(b.date, [])
        am.get(b.date)!.push(b)
      }
      setPlanMap(pm)
      setActualMap(am)
    }
    load()
  }, [anchorDate])

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg">
      {/* Month header */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <span className="font-medium text-sm">{monthLabel}</span>
        {loading && <span className="text-xs text-fg-subtle">로딩...</span>}
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_KO.map((d, i) => (
          <div
            key={d}
            className={[
              'text-center text-[10px] py-1',
              i === 0 ? 'text-weekend-sun' : i === 6 ? 'text-weekend-sat' : 'text-fg-subtle',
            ].join(' ')}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {grid.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map(({ date, isCurrentMonth }) => {
            const dd = new Date(`${date}T00:00:00`)
            const dow = dd.getDay()
            const isToday = date === todayStr
            const actualBlocks = actualMap.get(date) ?? []
            const planBlocks = planMap.get(date) ?? []
            const stats = computeDayStats(actualBlocks, getCategoryColor)
            const hasPlan = planBlocks.length > 0

            return (
              <div
                key={date}
                onClick={() => onDayClick?.(date)}
                className={[
                  'min-h-[64px] p-1 border-r border-border last:border-r-0 cursor-pointer transition-colors',
                  isCurrentMonth ? '' : 'opacity-30',
                  isToday ? 'bg-bg-subtle/40' : 'hover:bg-bg-elevated',
                ].join(' ')}
              >
                {/* Date number */}
                <div className={[
                  'text-[11px] font-mono mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                  isToday ? 'bg-accent text-on-accent font-bold' : (
                    dow === 0 ? 'text-weekend-sun' : dow === 6 ? 'text-weekend-sat' : 'text-fg-muted'
                  ),
                ].join(' ')}>
                  {dd.getDate()}
                </div>

                {/* Category dots */}
                {stats.categoryColors.length > 0 && (
                  <div className="flex gap-0.5 mb-0.5 flex-wrap">
                    {stats.categoryColors.map((color, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                )}

                {/* Hours label */}
                {stats.totalActualHours > 0 && (
                  <div className="text-[9px] text-fg-subtle font-mono">
                    {stats.totalActualHours.toFixed(1)}h
                  </div>
                )}

                {/* Plan indicator */}
                {hasPlan && stats.totalActualHours === 0 && (
                  <div className="text-[9px] text-fg-subtle">plan</div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
