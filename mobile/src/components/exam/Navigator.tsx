import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { ActiveExam } from '@/lib/progress'
import { radius, space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Pressable98 } from '@/components/ui'
import { answeredCount, blankCount, cellState, type CellState } from './logic'

function Legend({ fill, stroke, label }: { fill: string; stroke?: string; label: string }) {
  const t = useTheme()
  const type = useType()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 2,
          borderWidth: 1,
          borderColor: stroke ?? t.borderStrong,
          backgroundColor: fill,
        }}
      />
      <Text style={[type.mono, { fontSize: 11, color: t.mutedForeground }]}>{label}</Text>
    </View>
  )
}

/** Every question at once: answered, flagged, where you are. Tap to jump. */
export function ExamNavigator({
  open,
  exam,
  onJump,
  onClose,
}: {
  open: boolean
  exam: ActiveExam
  onJump: (index: number) => void
  onClose: () => void
}) {
  const t = useTheme()
  const type = useType()
  const insets = useSafeAreaInsets()

  const fill: Record<CellState, string> = {
    current: t.foreground,
    flagged: t.card,
    answered: t.card,
    blank: 'transparent',
  }
  const stroke: Record<CellState, string> = {
    current: t.foreground,
    flagged: t.domain.perf,
    answered: t.borderStrong,
    blank: t.border,
  }
  const ink: Record<CellState, string> = {
    current: t.background,
    flagged: t.foreground,
    answered: t.foreground,
    blank: t.faintForeground,
  }

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View
        style={{
          maxHeight: '72%',
          backgroundColor: t.background,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          borderTopWidth: 1,
          borderColor: t.border,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: space[5],
            paddingVertical: space[4],
            borderBottomWidth: 1,
            borderBottomColor: t.border,
          }}
        >
          <Text style={[type.eyebrow, { flex: 1 }]}>All questions</Text>
          <Pressable98 onPress={onClose} accessibilityLabel="Close the navigator">
            <Text style={[type.muted, { fontSize: 13, color: t.foreground }]}>Close</Text>
          </Pressable98>
        </View>

        <ScrollView contentContainerStyle={{ padding: space[5], gap: space[4] }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {exam.ids.map((id, n) => {
              const state = cellState(exam, n)
              return (
                <Pressable98
                  key={id}
                  accessibilityLabel={`Question ${n + 1}, ${state}`}
                  onPress={() => {
                    onJump(n)
                    onClose()
                  }}
                  style={{
                    width: 38,
                    height: 32,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: stroke[state],
                    backgroundColor: fill[state],
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={[type.mono, { fontSize: 12, color: ink[state] }]}>{n + 1}</Text>
                </Pressable98>
              )
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
            <Legend fill={t.card} stroke={t.borderStrong} label={`${answeredCount(exam)} answered`} />
            <Legend fill={t.card} stroke={t.domain.perf} label={`${exam.flags.length} flagged`} />
            <Legend fill="transparent" stroke={t.border} label={`${blankCount(exam)} blank`} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}
