import { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { fonts } from '@/theme/type'
import { useMotion } from './motion'

/** One line that fades in over the content and leaves. Nothing to dismiss. */
export function Toast({ message, id }: { message: string | null; id: number }) {
  const t = useTheme()
  const opacity = useRef(new Animated.Value(0)).current
  const { reduced, duration } = useMotion()

  useEffect(() => {
    if (!message) return
    opacity.setValue(0)
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      useNativeDriver: true,
    }).start()
    const timer = setTimeout(
      () => Animated.timing(opacity, { toValue: 0, duration, useNativeDriver: true }).start(),
      1400,
    )
    return () => clearTimeout(timer)
  }, [id, message, duration, reduced, opacity])

  if (!message) return null
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        opacity,
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: space[5],
        alignItems: 'center',
      }}
    >
      <View
        style={{
          backgroundColor: t.foreground,
          borderRadius: radius.lg,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
        }}
      >
        <Text style={{ fontFamily: fonts.monoMedium, fontSize: 12, color: t.background }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  )
}
