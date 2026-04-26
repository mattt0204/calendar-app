import { useTheme, PALETTES } from '../lib/theme'
import type { ColorMode } from '../lib/theme'

interface TweaksPanelProps {
  open: boolean
  onClose: () => void
}

export function TweaksPanel({ open, onClose }: TweaksPanelProps) {
  const { colorMode, paletteId, setColorMode, setPaletteId } = useTheme()

  if (!open) return null

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
        aria-label="Tweaks 패널"
        className={[
          'fixed top-0 right-0 h-full w-72 z-50 shadow-2xl',
          'border-l border-neutral-800',
          colorMode === 'dark'
            ? 'bg-neutral-950 text-neutral-100'
            : 'bg-white text-neutral-900',
          'flex flex-col',
        ].join(' ')}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <span className="font-medium text-sm">Tweaks</span>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 px-1"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* 다크 / 라이트 모드 */}
          <section>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
              화면 모드
            </div>
            <div className="flex gap-2">
              {(['dark', 'light'] as ColorMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setColorMode(m)}
                  className={[
                    'flex-1 py-2 rounded text-sm font-medium border transition-colors',
                    colorMode === m
                      ? 'border-neutral-400 bg-neutral-800 text-neutral-100'
                      : 'border-neutral-700 text-neutral-500 hover:border-neutral-500',
                  ].join(' ')}
                >
                  {m === 'dark' ? '다크' : '라이트'}
                </button>
              ))}
            </div>
          </section>

          {/* 팔레트 4종 */}
          <section>
            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2">
              카테고리 팔레트
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPaletteId(p.id)}
                  className={[
                    'flex flex-col items-start gap-1.5 p-2 rounded border text-sm transition-colors',
                    paletteId === p.id
                      ? 'border-neutral-400 bg-neutral-800'
                      : 'border-neutral-700 hover:border-neutral-500',
                  ].join(' ')}
                >
                  {/* 색상 스와치 */}
                  <div className="flex gap-0.5 flex-wrap">
                    {p.colors.slice(0, 6).map((color, i) => (
                      <span
                        key={i}
                        className="w-3 h-3 rounded-sm"
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-neutral-400">{p.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
