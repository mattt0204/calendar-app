/**
 * 간단한 자연어 → block 파라미터 파서
 * LLM 없이 regex 기반. dogfooding 단계에서 충분.
 *
 * 지원 패턴:
 * - "9시 강의 자료 1시간"
 * - "오후 2시 운동 30분"
 * - "14:30 미팅 1.5시간"
 * - "9-10시 독서"
 * - "9시~11시 코딩"
 */

export interface ParsedBlock {
  start: string  // "HH:MM"
  end: string    // "HH:MM"
  subjectName: string
}

function snapTo15(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

function formatHHMM(h: number, m: number): string {
  const hh = ((Math.floor(h) + Math.floor(m / 60)) % 24)
  const mm = m % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function parseNaturalBlock(input: string): ParsedBlock | null {
  const s = input.trim()
  if (!s) return null

  // 1. "HH:MM" or "H시 [M분]" pattern
  // Try to extract start time
  let startH: number | null = null
  let startM = 0
  let endH: number | null = null
  let endM = 0
  let remaining = s

  // "오전" / "오후" modifier
  let ampm: 'am' | 'pm' | null = null
  if (/오전|AM|am/.test(s)) {
    ampm = 'am'
    remaining = remaining.replace(/오전|AM|am/g, '').trim()
  } else if (/오후|PM|pm/.test(s)) {
    ampm = 'pm'
    remaining = remaining.replace(/오후|PM|pm/g, '').trim()
  }

  // Pattern: "9시~11시" or "9-11시" (range)
  const rangeKo = remaining.match(/^(\d{1,2})시\s*[~\-~]\s*(\d{1,2})시/)
  if (rangeKo) {
    startH = parseInt(rangeKo[1])
    endH = parseInt(rangeKo[2])
    remaining = remaining.slice(rangeKo[0].length).trim()
  }

  // Pattern: "HH:MM-HH:MM"
  const rangeColon = remaining.match(/^(\d{1,2}):(\d{2})\s*[-~]\s*(\d{1,2}):(\d{2})/)
  if (!rangeKo && rangeColon) {
    startH = parseInt(rangeColon[1])
    startM = parseInt(rangeColon[2])
    endH = parseInt(rangeColon[3])
    endM = parseInt(rangeColon[4])
    remaining = remaining.slice(rangeColon[0].length).trim()
  }

  // Pattern: "9시 30분" or "9:30" as start only
  if (startH === null) {
    const timeKo = remaining.match(/^(\d{1,2})시\s*(\d{1,2})?분?/)
    if (timeKo) {
      startH = parseInt(timeKo[1])
      startM = timeKo[2] ? parseInt(timeKo[2]) : 0
      remaining = remaining.slice(timeKo[0].length).trim()
    } else {
      const timeColon = remaining.match(/^(\d{1,2}):(\d{2})/)
      if (timeColon) {
        startH = parseInt(timeColon[1])
        startM = parseInt(timeColon[2])
        remaining = remaining.slice(timeColon[0].length).trim()
      }
    }
  }

  if (startH === null) return null

  // Apply am/pm
  if (ampm === 'pm' && startH < 12) startH += 12
  if (ampm === 'am' && startH === 12) startH = 0
  if (ampm === 'pm' && endH !== null && endH < 12) endH += 12

  // Duration: "1시간", "30분", "1.5시간", "1시간 30분"
  if (endH === null) {
    const durMatch = remaining.match(/(\d+(?:\.\d+)?)\s*시간(?:\s*(\d+)분)?|(\d+)분/)
    if (durMatch) {
      let durationH = 0
      let durationM = 0
      if (durMatch[3]) {
        durationM = parseInt(durMatch[3])
      } else {
        durationH = parseFloat(durMatch[1])
        durationM = durMatch[2] ? parseInt(durMatch[2]) : 0
      }
      const totalMinutes = durationH * 60 + durationM
      const endTotalMinutes = startH * 60 + startM + totalMinutes
      endH = Math.floor(endTotalMinutes / 60)
      endM = endTotalMinutes % 60
      remaining = remaining.replace(durMatch[0], '').trim()
    } else {
      // Default 1 hour
      endH = startH + 1
      endM = startM
    }
  }

  // Subject name = remaining text (strip leading/trailing spaces and common separators)
  const subjectName = remaining
    .replace(/^[-\s]+|[-\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!subjectName) return null

  // Snap to 15 minutes
  const snappedStartM = snapTo15(startM)
  const snappedEndM = snapTo15(endM)

  return {
    start: formatHHMM(startH, snappedStartM),
    end: formatHHMM(endH ?? startH + 1, snappedEndM),
    subjectName,
  }
}
