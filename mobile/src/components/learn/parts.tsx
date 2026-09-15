import type { ReactNode } from 'react'
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { DomainId } from '@/lib/content'
import { hairline, useTheme } from '@/theme/tokens'
import { fonts, useType } from '@/theme/type'

/** One hue per exam domain, same meaning as the web `DomainDot`. */
export function DomainDot({ id, size = 6 }: { id: DomainId; size?: number }) {
  const t = useTheme()
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.domain[id] }}
    />
  )
}

/** Hairline separator between rows. */
export function Divider() {
  const t = useTheme()
  return <View style={{ height: hairline, backgroundColor: t.border }} />
}

/** A row that dims briefly on touch — opacity only, well under 200 ms. */
export function Row({
  onPress,
  children,
  style,
}: {
  onPress: () => void
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }, style]}
      android_ripple={{ borderless: false }}
    >
      {children}
    </Pressable>
  )
}

/** Icon or label button for the reader chrome. `primary` fills, the rest are outlined. */
export function BarButton({
  icon,
  label,
  onPress,
  disabled,
  primary,
  dot,
}: {
  icon?: keyof typeof Ionicons.glyphMap
  label?: string
  onPress: () => void
  disabled?: boolean
  primary?: boolean
  dot?: boolean
}) {
  const t = useTheme()
  const type = useType()
  const fg = primary ? t.background : disabled ? t.faintForeground : t.foreground
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({
        opacity: pressed ? 0.7 : disabled ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 38,
        paddingHorizontal: label ? 14 : 10,
        borderRadius: 10,
        borderWidth: primary ? 0 : 1,
        borderColor: t.border,
        backgroundColor: primary ? t.foreground : 'transparent',
      })}
    >
      {icon ? <Ionicons name={icon} size={16} color={fg} /> : null}
      {label ? (
        <Text style={[type.body, { fontFamily: fonts.sansSemibold, fontSize: 14, color: fg }]}>
          {label}
        </Text>
      ) : null}
      {dot ? (
        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.foreground }} />
      ) : null}
    </Pressable>
  )
}
