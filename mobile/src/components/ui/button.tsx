import { useRef, type ReactNode } from 'react'
import { Animated, Pressable, Text, View, type ViewStyle } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { fonts } from '@/theme/type'
import { useMotion } from './motion'

export type ButtonVariant = 'primary' | 'outline' | 'ghost'

/** Pressable and layout box in one, so flex and alignSelf reach the row that holds it. */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** Scale-on-press, transform only, dropped when the system asks for less motion. */
export function Pressable98({
  onPress,
  disabled,
  style,
  children,
  accessibilityLabel,
}: {
  onPress?: () => void
  disabled?: boolean
  style?: ViewStyle | ViewStyle[]
  children: ReactNode
  accessibilityLabel?: string
}) {
  const scale = useRef(new Animated.Value(1)).current
  const { reduced } = useMotion()
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 0 }).start()

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => !reduced && to(0.98)}
      onPressOut={() => !reduced && to(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  )
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  size = 'md',
  grow,
  right,
  tone,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  grow?: boolean
  right?: ReactNode
  tone?: 'bad'
}) {
  const t = useTheme()
  const height = size === 'md' ? 44 : 34
  const bg =
    variant === 'primary' ? t.foreground : variant === 'outline' ? 'transparent' : 'transparent'
  const fg = tone === 'bad' && variant !== 'primary' ? t.bad : variant === 'primary' ? t.background : t.foreground

  return (
    <Pressable98
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={{
        height,
        opacity: disabled ? 0.4 : 1,
        borderRadius: radius.md,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: tone === 'bad' ? t.bad : t.borderStrong,
        backgroundColor: bg,
        paddingHorizontal: size === 'md' ? space[5] : space[3],
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space[2],
        alignSelf: grow ? 'stretch' : 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: fonts.sansMedium,
          fontSize: size === 'md' ? 15 : 13,
          letterSpacing: -0.1,
          color: fg,
        }}
      >
        {label}
      </Text>
      {right ? <View>{right}</View> : null}
    </Pressable98>
  )
}
