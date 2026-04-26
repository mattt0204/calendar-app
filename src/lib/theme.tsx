import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { PALETTES, PALETTE_BY_ID, type PaletteId } from './palettes'
import type { CategoryId } from './categories'
import { CATEGORIES } from './categories'

export type ColorMode = 'dark' | 'light'

interface ThemeContextValue {
  colorMode: ColorMode
  paletteId: PaletteId
  setColorMode: (m: ColorMode) => void
  setPaletteId: (p: PaletteId) => void
  /** 카테고리 id → 현재 팔레트의 색상 */
  getCategoryColor: (id: CategoryId) => string
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const LS_COLOR_MODE = 'calendar_color_mode'
const LS_PALETTE = 'calendar_palette'

function loadColorMode(): ColorMode {
  const v = localStorage.getItem(LS_COLOR_MODE)
  return v === 'light' ? 'light' : 'dark'
}

function loadPaletteId(): PaletteId {
  const v = localStorage.getItem(LS_PALETTE)
  if (v && PALETTE_BY_ID[v as PaletteId]) return v as PaletteId
  return 'default'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>(loadColorMode)
  const [paletteId, setPaletteIdState] = useState<PaletteId>(loadPaletteId)

  const setColorMode = useCallback((m: ColorMode) => {
    setColorModeState(m)
    localStorage.setItem(LS_COLOR_MODE, m)
  }, [])

  const setPaletteId = useCallback((p: PaletteId) => {
    setPaletteIdState(p)
    localStorage.setItem(LS_PALETTE, p)
  }, [])

  const getCategoryColor = useCallback(
    (id: CategoryId) => {
      const palette = PALETTE_BY_ID[paletteId]
      const idx = CATEGORIES.findIndex((c) => c.id === id)
      return idx >= 0 ? palette.colors[idx] : '#888888'
    },
    [paletteId],
  )

  // Apply color mode class to document root
  useEffect(() => {
    const root = document.documentElement
    if (colorMode === 'light') {
      root.classList.add('light-mode')
      root.classList.remove('dark-mode')
    } else {
      root.classList.add('dark-mode')
      root.classList.remove('light-mode')
    }
  }, [colorMode])

  return (
    <ThemeContext.Provider
      value={{ colorMode, paletteId, setColorMode, setPaletteId, getCategoryColor }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

export { PALETTES }
