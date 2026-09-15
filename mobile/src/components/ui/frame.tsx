import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radius, space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

/** The content panel floating on the canvas: a fixed top, a scrolling body, a fixed footer. */
export function Frame({
  top,
  footer,
  children,
  scroll = true,
  padded = true,
}: {
  top?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  scroll?: boolean
  padded?: boolean
}) {
  const t = useTheme()
  const insets = useSafeAreaInsets()
  const pad = padded ? space[5] : 0

  return (
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top }}>
      <View
        style={{
          flex: 1,
          margin: space[3],
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.background,
          overflow: 'hidden',
        }}
      >
        {top ? <View style={{ paddingHorizontal: pad, paddingTop: pad }}>{top}</View> : null}
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: pad, gap: space[5] }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, padding: pad, gap: space[5] }}>{children}</View>
        )}
        {footer ? (
          <View
            style={{
              borderTopWidth: 1,
              borderTopColor: t.border,
              paddingHorizontal: pad,
              paddingVertical: space[3],
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  )
}

/** Every screen opens with one of these: eyebrow, title, one line of why. */
export function Header({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
}) {
  const type = useType()
  return (
    <View style={{ gap: space[2] }}>
      {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
      {typeof title === 'string' ? <Text style={type.display}>{title}</Text> : title}
      {typeof description === 'string' ? (
        <Text style={type.muted}>{description}</Text>
      ) : (
        description
      )}
    </View>
  )
}
