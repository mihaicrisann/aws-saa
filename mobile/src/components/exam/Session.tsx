import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, AppState, Text, View } from 'react-native'
import { isMulti, type Question } from '@/lib/content'
import type { ActiveExam } from '@/lib/progress'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Eyebrow, Frame, Meter, Pressable98 } from '@/components/ui'
import { QuestionView, useTicker } from '@/components/question'
import { ExamNavigator } from './Navigator'
import {
  answerOf,
  answeredCount,
  blankCount,
  choose,
  currentId,
  fmtClock,
  goTo,
  isExpired,
  LOW_SECONDS,
  accrue,
  toggleFlag,
} from './logic'

export function ExamSession({
  exam,
  question,
  onEdit,
  onSubmit,
}: {
  exam: ActiveExam
  question: Question
  /** Applies a change to the live exam and persists it immediately. */
  onEdit: (fn: (e: ActiveExam) => ActiveExam) => void
  onSubmit: () => void
}) {
  const t = useTheme()
  const type = useType()
  const [navOpen, setNavOpen] = useState(false)
  const shownAt = useRef(Date.now())

  const index = exam.index ?? 0
  const total = exam.ids.length
  const elapsed = useTicker(exam.startedAt, true)
  const remaining = exam.minutes * 60 - elapsed
  const low = remaining < LOW_SECONDS
  const flagged = exam.flags.includes(question.id)
  const chosen = answerOf(exam, question.id)
  const multi = isMulti(question)

  /** Every edit first charges the time since this question appeared. */
  const edit = useCallback(
    (fn: (e: ActiveExam) => ActiveExam) => {
      const spent = Math.round((Date.now() - shownAt.current) / 1000)
      shownAt.current = Date.now()
      onEdit((e) => fn(accrue(e, currentId(e), spent)))
    },
    [onEdit],
  )

  const submit = useCallback(() => {
    edit((e) => e)
    onSubmit()
  }, [edit, onSubmit])

  useEffect(() => {
    if (remaining <= 0) submit()
  }, [remaining, submit])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      shownAt.current = Date.now()
      if (isExpired(exam)) submit()
    })
    return () => sub.remove()
  }, [exam, submit])

  const confirm = () => {
    const blank = blankCount(exam)
    Alert.alert(
      'Submit the exam?',
      [
        blank
          ? `${blank} question${blank === 1 ? ' is' : 's are'} still blank. Nothing is lost by guessing.`
          : 'Everything is answered.',
        exam.flags.length ? `${exam.flags.length} still flagged.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      [
        { text: 'Keep working', style: 'cancel' },
        { text: 'Submit', style: 'destructive', onPress: submit },
      ],
    )
  }

  return (
    <Frame
      top={
        <View style={{ gap: space[3], paddingBottom: space[4] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Text style={[type.mono, { fontSize: 13 }]}>
              {String(index + 1).padStart(2, '0')}
              <Text style={{ color: t.faintForeground }}> / {total}</Text>
            </Text>
            <Text style={[type.mono, { fontSize: 11, color: t.mutedForeground }]}>
              {answeredCount(exam)} answered
            </Text>
            <Text
              style={[
                type.mono,
                {
                  marginLeft: 'auto',
                  fontSize: 17,
                  letterSpacing: -0.4,
                  color: low ? t.bad : t.foreground,
                },
              ]}
            >
              {fmtClock(remaining)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row' }}>
            <Meter
              value={1 - Math.max(0, remaining) / (exam.minutes * 60)}
              color={low ? t.bad : undefined}
            />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
            <Button label={`All ${total}`} size="sm" variant="outline" onPress={() => setNavOpen(true)} />
            <Button
              label={flagged ? 'Flagged' : 'Flag'}
              size="sm"
              variant={flagged ? 'primary' : 'ghost'}
              onPress={() => edit((e) => toggleFlag(e, question.id))}
            />
            <View style={{ marginLeft: 'auto' }}>
              <Pressable98 onPress={confirm} accessibilityLabel="Submit the exam">
                <Text style={[type.muted, { fontSize: 13, color: t.foreground }]}>Submit</Text>
              </Pressable98>
            </View>
          </View>
        </View>
      }
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <Button
            label="Previous"
            size="sm"
            variant="outline"
            disabled={index === 0}
            onPress={() => edit((e) => goTo(e, (e.index ?? 0) - 1))}
          />
          <View style={{ marginLeft: 'auto' }}>
            <Button
              label={index + 1 < total ? 'Next' : 'Finish'}
              size="sm"
              onPress={() =>
                index + 1 < total ? edit((e) => goTo(e, (e.index ?? 0) + 1)) : confirm()
              }
            />
          </View>
        </View>
      }
    >
      {multi ? <Eyebrow>Pick {question.correct.length}</Eyebrow> : null}
      <QuestionView
        q={question}
        chosen={chosen}
        revealed={false}
        showMeta={false}
        onToggle={(i) => edit((e) => choose(e, question, i))}
      />
      <View style={{ height: space[4] }} />

      <ExamNavigator
        open={navOpen}
        exam={exam}
        onClose={() => setNavOpen(false)}
        onJump={(n) => edit((e) => goTo(e, n))}
      />
    </Frame>
  )
}
