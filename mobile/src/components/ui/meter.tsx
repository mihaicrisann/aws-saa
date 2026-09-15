import { View } from 'react-native'
import { useTheme } from '@/theme/tokens'

/** A thin progress bar. Width only; no colour unless it means something. */
export function Meter({ value, color }: { value: number; color?: string }) {
  const t = useTheme()
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: t.border }}>
      <View
        style={{
          height: 3,
          borderRadius: 2,
          width: `${pct * 100}%`,
          backgroundColor: color ?? t.foreground,
        }}
      />
    </View>
  )
}
