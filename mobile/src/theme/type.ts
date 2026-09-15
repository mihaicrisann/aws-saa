import type { TextStyle } from 'react-native'
import { useTheme } from './tokens'

/** The font files in assets/fonts, keyed the way expo-font loads them. */
export const fonts = {
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  mono: 'GeistMono_400Regular',
  monoMedium: 'GeistMono_500Medium',
  monoSemibold: 'GeistMono_600SemiBold',
} as const

export interface TypeStyles {
  eyebrow: TextStyle
  mono: TextStyle
  display: TextStyle
  body: TextStyle
  muted: TextStyle
}

/** Text styles carrying the colour of the active theme; the metrics match the web utilities. */
export function useType(): TypeStyles {
  const t = useTheme()
  return {
    eyebrow: {
      fontFamily: fonts.monoMedium,
      fontSize: 11,
      lineHeight: 13,
      letterSpacing: 0.88,
      textTransform: 'uppercase',
      color: t.mutedForeground,
    },
    mono: {
      fontFamily: fonts.mono,
      fontSize: 14,
      letterSpacing: 0,
      color: t.foreground,
    },
    display: {
      fontFamily: fonts.sansSemibold,
      fontSize: 26,
      lineHeight: 30,
      letterSpacing: -0.62,
      color: t.foreground,
    },
    body: {
      fontFamily: fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      letterSpacing: -0.09,
      color: t.foreground,
    },
    muted: {
      fontFamily: fonts.sans,
      fontSize: 14,
      lineHeight: 20,
      letterSpacing: -0.08,
      color: t.mutedForeground,
    },
  }
}
