import { useColorScheme } from 'react-native'
import { useStore } from '@/lib/store'
import { useThemeMode } from '@/lib/theme-mode'

/* Mirrors the oklch tokens in app/src/index.css, converted to sRGB. Keep the two
   in step: the same names, the same meaning, one hue per exam domain. */

export interface Tokens {
  canvas: string
  background: string
  card: string
  border: string
  borderStrong: string
  foreground: string
  mutedForeground: string
  faintForeground: string
  good: string
  bad: string
  domain: { secure: string; resilient: string; perf: string; cost: string }
}

export const light: Tokens = {
  canvas: '#f7f7f7',
  background: '#ffffff',
  card: '#ffffff',
  border: '#e6e6e6',
  borderStrong: '#d1d1d1',
  foreground: '#0d0d0d',
  mutedForeground: '#696969',
  faintForeground: '#989898',
  good: '#25984d',
  bad: '#de3b3d',
  domain: {
    secure: '#0074ca',
    resilient: '#8254c4',
    perf: '#d98b09',
    cost: '#d24b54',
  },
}

export const dark: Tokens = {
  canvas: '#070707',
  background: '#0e0e0e',
  card: '#141414',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  foreground: '#ebebeb',
  mutedForeground: '#929292',
  faintForeground: '#636363',
  good: '#65c67d',
  bad: '#fd736d',
  domain: {
    secure: '#60aaf3',
    resilient: '#b897f0',
    perf: '#eeb154',
    cost: '#f68486',
  },
}

/** `--radius: 0.625rem` and the scale derived from it. */
const base = 10
export const radius = {
  sm: base * 0.6,
  md: base * 0.8,
  lg: base,
  xl: base * 1.4,
  '2xl': base * 1.8,
  '3xl': base * 2.2,
} as const

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const

export const hairline = 1 / 3

export type ThemeName = 'light' | 'dark'
export const tokensFor = (name: ThemeName) => (name === 'dark' ? dark : light)

/** The picked theme wins; on "system" the device decides, falling back to the last resolved one. */
export function useThemeName(): ThemeName {
  const mode = useThemeMode()
  const stored = useStore((s) => s.theme)
  const system = useColorScheme()
  if (mode !== 'system') return mode
  return system === 'dark' || system === 'light' ? system : stored
}

export function useTheme(): Tokens {
  return tokensFor(useThemeName())
}
