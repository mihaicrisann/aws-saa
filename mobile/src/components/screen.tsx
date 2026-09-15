import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

/** The content panel floating on the canvas, with the page title and one stat tray. */
export function Screen({
  title,
  statLabel,
  statValue,
  children,
}: {
  title: string
  statLabel: string
  statValue: string | number
  children?: ReactNode
}) {
  const t = useTheme()
  const type = useType()
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top }}>
      <View
        style={{
          flex: 1,
          margin: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.background,
          padding: 20,
          gap: 20,
        }}
      >
        <Text style={type.display}>{title}</Text>
        <View
          style={{
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: t.border,
            paddingVertical: 14,
            gap: 6,
          }}
        >
          <Text style={type.eyebrow}>{statLabel}</Text>
          <Text style={[type.mono, { fontSize: 28, letterSpacing: -0.5 }]}>{statValue}</Text>
        </View>
        {children}
      </View>
    </View>
  )
}
