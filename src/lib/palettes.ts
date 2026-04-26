// 카테고리 팔레트 4종 — Tweaks 패널에서 선택 가능
// 각 팔레트는 CATEGORIES 순서와 정확히 일치 (0_compass ~ 8_기타)

export type PaletteId = 'default' | 'pastel' | 'earth' | 'mono'

export interface Palette {
  id: PaletteId
  label: string
  colors: readonly string[]  // 9 colors, index = CATEGORIES index
}

export const PALETTES: readonly Palette[] = [
  {
    id: 'default',
    label: '기본',
    colors: [
      '#6b5cb8', // 0_compass
      '#ff5a5a', // 1_업무
      '#5aa8ff', // 2_인간관계
      '#f5c04a', // 3_건강
      '#5ccf8a', // 4_재무
      '#ff8a4c', // 5_체화돌
      '#3ed3c9', // 6_언어
      '#ff6ec4', // 7_평판
      '#a88cff', // 8_기타
    ],
  },
  {
    id: 'pastel',
    label: '파스텔',
    colors: [
      '#b3a6e8', // 0_compass
      '#ffb3b3', // 1_업무
      '#a8d4ff', // 2_인간관계
      '#fce8a0', // 3_건강
      '#a8f0c6', // 4_재무
      '#ffc9a0', // 5_체화돌
      '#9aeee8', // 6_언어
      '#ffb3e6', // 7_평판
      '#d4c4ff', // 8_기타
    ],
  },
  {
    id: 'earth',
    label: '어시·자연',
    colors: [
      '#8b6e4e', // 0_compass
      '#c0392b', // 1_업무
      '#2980b9', // 2_인간관계
      '#d4a017', // 3_건강
      '#27ae60', // 4_재무
      '#e67e22', // 5_체화돌
      '#16a085', // 6_언어
      '#8e44ad', // 7_평판
      '#7f8c8d', // 8_기타
    ],
  },
  {
    id: 'mono',
    label: '모노크롬',
    colors: [
      '#e8e8e8', // 0_compass
      '#d0d0d0', // 1_업무
      '#b8b8b8', // 2_인간관계
      '#a0a0a0', // 3_건강
      '#888888', // 4_재무
      '#707070', // 5_체화돌
      '#585858', // 6_언어
      '#404040', // 7_평판
      '#c8c8c8', // 8_기타
    ],
  },
] as const

export const PALETTE_BY_ID: Record<PaletteId, Palette> = Object.fromEntries(
  PALETTES.map((p) => [p.id, p]),
) as Record<PaletteId, Palette>
