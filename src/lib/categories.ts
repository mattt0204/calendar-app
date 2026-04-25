// pa initiative 폴더 기반 9 카테고리.
// DB products.category CHECK constraint 와 정확히 일치해야 함 (초기 migration).

export const CATEGORIES = [
  { id: '0_compass',  label: '나침반',   color: '#6b5cb8' },
  { id: '1_업무',     label: '업무',     color: '#ff5a5a' },
  { id: '2_인간관계', label: '인간관계', color: '#5aa8ff' },
  { id: '3_건강',     label: '건강',     color: '#f5c04a' },
  { id: '4_재무',     label: '재무',     color: '#5ccf8a' },
  { id: '5_체화돌',   label: '체화돌',   color: '#ff8a4c' },
  { id: '6_언어',     label: '언어',     color: '#3ed3c9' },
  { id: '7_평판',     label: '평판',     color: '#ff6ec4' },
  { id: '8_기타',     label: '기타',     color: '#a88cff' },
] as const

export type CategoryId = typeof CATEGORIES[number]['id']

export const CATEGORY_BY_ID: Record<CategoryId, typeof CATEGORIES[number]> =
  Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
    CategoryId,
    typeof CATEGORIES[number]
  >
