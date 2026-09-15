import { Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { isMulti, lectureNo, type Question } from '@/lib/content'
import type { ActiveDrill } from '@/lib/progress'
import type { Confidence } from '@/lib/store'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Frame, Meter, Pressable98, Toast } from '@/components/ui'
import { ConfidencePicker, fmtSeconds, QuestionView, useTicker } from '@/components/question'
import { toggleChoice } from './logic'

export function DrillSession({
  drill,
  question,
  toast,
  onChoose,
  onConfidence,
  onCheck,
  onNext,
  onQuit,
}: {
  drill: ActiveDrill
  question: Question
  toast: { message: string | null; id: number }
  onChoose: (chosen: number[]) => void
  onConfidence: (c: Confidence | undefined) => void
  onCheck: () => void
  onNext: () => void
  onQuit: () => void
}) {
  const t = useTheme()
  const type = useType()
  const router = useRouter()
  const elapsed = useTicker(drill.shownAt, !drill.revealed)
  const multi = isMulti(question)
  const right = drill.log.filter((l) => l.ok).length
  const last = drill.index + 1 === drill.ids.length

  const quit = () =>
    Alert.alert('End this set?', 'The answers you have checked are already recorded.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: onQuit },
    ])

  return (
    <Frame
      top={
        <View style={{ gap: space[3], paddingBottom: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Pressable98 onPress={quit} accessibilityLabel="Quit the drill">
              <Text style={[type.muted, { fontSize: 13 }]}>Quit</Text>
            </Pressable98>
            <Meter value={drill.index / drill.ids.length} />
            <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground }]}>
              {drill.index + 1} / {drill.ids.length}
            </Text>
          </View>
          <Text style={[type.mono, { fontSize: 11, color: t.faintForeground }]}>
            {right} right · {fmtSeconds(elapsed)}
          </Text>
        </View>
      }
      footer={
        drill.revealed ? (
          <Button label={last ? 'Results' : 'Next'} onPress={onNext} grow />
        ) : (
          <Button label="Check" onPress={onCheck} disabled={!drill.chosen.length} grow />
        )
      }
    >
      <QuestionView
        q={question}
        chosen={drill.chosen}
        revealed={drill.revealed}
        onToggle={(i) =>
          onChoose(toggleChoice(drill.chosen, i, multi, question.correct.length))
        }
        footer={
          <Pressable98
            accessibilityLabel="Read the lecture section"
            onPress={() =>
              router.push({
                pathname: '/learn/[id]',
                params: question.anchor
                  ? { id: question.lecture, section: question.anchor }
                  : { id: question.lecture },
              })
            }
          >
            <Text style={[type.muted, { fontSize: 13, color: t.foreground }]}>
              {question.anchor ? 'Read the section' : `Lecture ${lectureNo(question.lecture)}`} ↗
            </Text>
          </Pressable98>
        }
      />
      {!drill.revealed && drill.chosen.length > 0 ? (
        <ConfidencePicker value={drill.confidence} onChange={onConfidence} />
      ) : null}
      <View style={{ height: space[4] }} />
      <Toast message={toast.message} id={toast.id} />
    </Frame>
  )
}
