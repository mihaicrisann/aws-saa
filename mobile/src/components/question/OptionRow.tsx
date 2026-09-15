import { Text, View } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { fonts, useType } from '@/theme/type'
import { Pressable98 } from '@/components/ui'

export type OptionTone = 'idle' | 'picked' | 'right' | 'wrong'

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/** One answer. The letter carries the state; the row only tints once revealed. */
export function OptionRow({
  index,
  text,
  tone,
  picked,
  multi,
  revealed,
  onPress,
}: {
  index: number
  text: string
  tone: OptionTone
  /** Whether the reader chose it — after the reveal this is what "yours" means. */
  picked: boolean
  multi: boolean
  revealed: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const type = useType()

  const accent = tone === 'right' ? t.good : tone === 'wrong' ? t.bad : t.foreground
  const border =
    tone === 'idle' ? t.border : tone === 'picked' ? t.foreground : accent
  const fill =
    tone === 'right' || tone === 'wrong'
      ? accent
      : tone === 'picked'
        ? t.foreground
        : 'transparent'

  return (
    <Pressable98
      onPress={onPress}
      disabled={revealed}
      accessibilityLabel={`${LETTERS[index]}. ${text}`}
      style={{
        flexDirection: 'row',
        gap: space[3],
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: border,
        borderRadius: radius.lg,
        paddingHorizontal: space[3],
        paddingVertical: space[3],
        backgroundColor: t.card,
        opacity: revealed && tone === 'idle' ? 0.5 : 1,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: multi ? radius.sm : 11,
          borderWidth: 1,
          borderColor: tone === 'idle' ? t.borderStrong : border,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: fonts.monoSemibold,
            fontSize: 11,
            color: tone === 'idle' ? t.mutedForeground : t.background,
          }}
        >
          {tone === 'right' ? '✓' : tone === 'wrong' ? '✕' : LETTERS[index]}
        </Text>
      </View>
      <Text style={[type.body, { flex: 1, fontSize: 14, lineHeight: 20 }]}>{text}</Text>
      {revealed && (picked || tone === 'right') ? (
        <Text
          style={[
            type.eyebrow,
            { color: picked ? (tone === 'right' ? t.good : t.bad) : t.mutedForeground },
          ]}
        >
          {picked ? 'yours' : 'missed'}
        </Text>
      ) : null}
    </Pressable98>
  )
}
