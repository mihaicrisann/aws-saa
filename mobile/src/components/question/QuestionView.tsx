import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { isMulti, lectureNo, type Question } from '@/lib/content'
import { Eyebrow } from '@/components/ui'
import { DomainBadge } from './DomainBadge'
import { DistractorNotes } from './DistractorNotes'
import { LETTERS, OptionRow, type OptionTone } from './OptionRow'

export interface QuestionViewProps {
  q: Question
  /** Option indices the reader has picked. */
  chosen: number[]
  /** Answers are locked and the reasoning is shown. */
  revealed: boolean
  /** Fired on every option tap; the owner decides single vs multi. */
  onToggle: (index: number) => void
  /** Domain badge, lecture number and the "pick N" hint. Default true. */
  showMeta?: boolean
  /** Explanation and distractor notes once revealed. Default true. */
  showReasoning?: boolean
  /** Rendered under the reasoning — the "read the section" link, say. */
  footer?: ReactNode
}

const tone = (
  i: number,
  q: Question,
  chosen: number[],
  revealed: boolean,
): OptionTone => {
  const picked = chosen.includes(i)
  if (!revealed) return picked ? 'picked' : 'idle'
  if (q.correct.includes(i)) return 'right'
  return picked ? 'wrong' : 'idle'
}

/** Presentational: props in, callbacks out. Drill and Exam both render this. */
export function QuestionView({
  q,
  chosen,
  revealed,
  onToggle,
  showMeta = true,
  showReasoning = true,
  footer,
}: QuestionViewProps) {
  const t = useTheme()
  const type = useType()
  const multi = isMulti(q)

  return (
    <View style={{ gap: space[4] }}>
      {showMeta ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
          <DomainBadge id={q.domain} />
          <Text style={[type.mono, { fontSize: 11, color: t.mutedForeground }]}>
            Lecture {lectureNo(q.lecture)}
          </Text>
          {multi ? (
            <View style={{ marginLeft: 'auto' }}>
              <Eyebrow>Pick {q.correct.length}</Eyebrow>
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={[type.body, { fontSize: 16, lineHeight: 23, letterSpacing: -0.2 }]}>
        {q.stem}
      </Text>

      <View style={{ gap: space[2] }}>
        {q.options.map((opt, i) => (
          <OptionRow
            key={i}
            index={i}
            text={opt}
            multi={multi}
            picked={chosen.includes(i)}
            revealed={revealed}
            tone={tone(i, q, chosen, revealed)}
            onPress={() => onToggle(i)}
          />
        ))}
      </View>

      {revealed && showReasoning ? (
        <View style={{ gap: space[3] }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: t.good,
              borderRadius: radius.lg,
              padding: space[4],
              gap: space[2],
            }}
          >
            <Text style={[type.eyebrow, { color: t.good }]}>
              Why {q.correct.map((i) => LETTERS[i]).join(' + ')}
            </Text>
            <Text style={[type.body, { fontSize: 14, lineHeight: 21 }]}>{q.explanation}</Text>
          </View>
          {q.distractors ? <DistractorNotes distractors={q.distractors} /> : null}
          {footer}
        </View>
      ) : null}
    </View>
  )
}

export default QuestionView
