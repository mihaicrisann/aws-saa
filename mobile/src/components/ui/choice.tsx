import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { fonts } from '@/theme/type'
import { Pressable98 } from './button'

export interface Option<T extends string> {
  value: T
  label: string
  dot?: string
}

/** Single-select pills. `allowEmpty` lets a second tap clear the choice. */
export function Choice<T extends string>({
  value,
  options,
  onChange,
  allowEmpty,
  size = 'md',
}: {
  value: T | undefined
  options: Option<T>[]
  onChange: (v: T | undefined) => void
  allowEmpty?: boolean
  size?: 'md' | 'sm'
}) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <Pressable98
            key={o.value}
            accessibilityLabel={o.label}
            onPress={() => onChange(on && allowEmpty ? undefined : o.value)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[2],
              height: size === 'md' ? 34 : 28,
              paddingHorizontal: space[3],
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: on ? t.foreground : t.border,
              backgroundColor: on ? t.foreground : 'transparent',
            }}
          >
            {o.dot ? (
              <View
                style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: o.dot }}
              />
            ) : null}
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: size === 'md' ? 13 : 12,
                letterSpacing: -0.08,
                color: on ? t.background : t.foreground,
              }}
            >
              {o.label}
            </Text>
          </Pressable98>
        )
      })}
    </View>
  )
}

/** An on/off pill, for the one-word toggles. */
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <Choice
      value={value ? 'on' : 'off'}
      options={[
        { value: 'off', label: 'All' },
        { value: 'on', label: label },
      ]}
      onChange={(v) => onChange(v === 'on')}
    />
  )
}

export function SelectButton({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Pressable98
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        alignSelf: 'stretch',
        height: 38,
        justifyContent: 'center',
        paddingHorizontal: space[3],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontFamily: fonts.sans, fontSize: 13, color: t.foreground }}
      >
        {label}
      </Text>
    </Pressable98>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  const t = useTheme()
  return (
    <Text
      style={{
        fontFamily: fonts.monoMedium,
        fontSize: 11,
        letterSpacing: 0.88,
        textTransform: 'uppercase',
        color: t.mutedForeground,
      }}
    >
      {children}
    </Text>
  )
}
