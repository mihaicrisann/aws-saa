import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

/** A hairline-separated list. */
export function Rows({ children }: { children: ReactNode }) {
  const t = useTheme()
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  )
}

export function Row({
  label,
  children,
  first,
}: {
  label?: string
  children: ReactNode
  first?: boolean
}) {
  const t = useTheme()
  const type = useType()
  return (
    <View
      style={{
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.border,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        gap: space[2],
      }}
    >
      {label ? <Text style={type.eyebrow}>{label}</Text> : null}
      {children}
    </View>
  )
}

/** One number with its label; several of them make the stat tray. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'good' | 'bad'
}) {
  const t = useTheme()
  const type = useType()
  const color = tone === 'good' ? t.good : tone === 'bad' ? t.bad : t.foreground
  return (
    <View style={{ flex: 1, minWidth: 70, gap: space[1] }}>
      <Text style={type.eyebrow}>{label}</Text>
      <Text style={[type.mono, { fontSize: 20, letterSpacing: -0.4, color }]}>{value}</Text>
      {hint ? <Text style={[type.muted, { fontSize: 12 }]}>{hint}</Text> : null}
    </View>
  )
}

export function StatRow({ children }: { children: ReactNode }) {
  const t = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: space[4],
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: t.border,
        paddingVertical: space[4],
      }}
    >
      {children}
    </View>
  )
}

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  const t = useTheme()
  const type = useType()
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radius.lg,
        backgroundColor: t.card,
        padding: space[4],
        gap: space[3],
      }}
    >
      {title ? <Text style={type.eyebrow}>{title}</Text> : null}
      {children}
    </View>
  )
}
