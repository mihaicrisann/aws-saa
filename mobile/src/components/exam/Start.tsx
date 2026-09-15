import { Text, View } from 'react-native'
import { banks, domains, exam, shortDomain } from '@/lib/content'
import type { QuestionBank } from '@/lib/progress'
import type { ExamResult } from '@/lib/store'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Choice, Frame, Header, Panel, Pressable98, Row, Rows, Stat, StatRow } from '@/components/ui'
import {
  accuracyOf,
  drawSize,
  fmtDate,
  fmtDuration,
  passed,
  scoreOf,
} from './logic'

function Fact({ label, value }: { label: string; value: string }) {
  const type = useType()
  return (
    <View style={{ flexDirection: 'row', gap: space[3] }}>
      <Text style={[type.eyebrow, { width: 78, paddingTop: 3 }]}>{label}</Text>
      <Text style={[type.body, { flex: 1, fontSize: 13, lineHeight: 19 }]}>{value}</Text>
    </View>
  )
}

function PastExam({ result, onOpen }: { result: ExamResult; onOpen: () => void }) {
  const t = useTheme()
  const type = useType()
  const ok = passed(result)
  return (
    <Pressable98
      onPress={onOpen}
      accessibilityLabel={`Mock on ${fmtDate(result.at)}, ${scoreOf(result)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[3],
        borderTopWidth: 1,
        borderTopColor: t.border,
        paddingHorizontal: space[4],
        paddingVertical: space[3],
      }}
    >
      <Text style={[type.mono, { fontSize: 18, letterSpacing: -0.4, color: ok ? t.good : t.bad }]}>
        {scoreOf(result)}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontSize: 13 }]}>{fmtDate(result.at)}</Text>
        <Text style={[type.mono, { fontSize: 11, color: t.faintForeground }]}>
          {result.correct}/{result.total} · {Math.round(accuracyOf(result) * 100)}% ·{' '}
          {fmtDuration(result.seconds)}
        </Text>
      </View>
      <Text style={[type.eyebrow, { color: ok ? t.good : t.bad }]}>{ok ? 'pass' : 'fail'}</Text>
    </Pressable98>
  )
}

export function ExamStart({
  bank,
  onBank,
  exams,
  onStart,
  onOpen,
}: {
  bank: QuestionBank
  onBank: (b: QuestionBank) => void
  exams: ExamResult[]
  onStart: () => void
  onOpen: (id: string) => void
}) {
  const t = useTheme()
  const type = useType()
  const count = drawSize(bank)
  const pool = banks.find((b) => b.id === bank)
  const past = exams.slice().sort((a, b) => b.at - a.at)
  const best = past.length ? Math.max(...past.map(scoreOf)) : 0

  return (
    <Frame footer={<Button label="Start mock" onPress={onStart} grow />}>
      <Header
        eyebrow="Timed"
        title="Mock exam"
        description="No feedback until you submit. Full review at the end."
      />

      {past.length ? (
        <StatRow>
          <Stat label="Mocks taken" value={past.length} />
          <Stat label="Best" value={best} tone={best >= exam.passingScore ? 'good' : undefined} />
          <Stat label="Last" value={scoreOf(past[0])} hint={fmtDate(past[0].at)} />
        </StatRow>
      ) : null}

      <Rows>
        <Row label="Bank" first>
          <Choice
            value={bank}
            options={banks.map((b) => ({ value: b.id, label: b.label }))}
            onChange={(v) => v && onBank(v)}
          />
          <Text style={[type.muted, { fontSize: 12 }]}>{pool?.blurb}</Text>
        </Row>
        <Row>
          <View style={{ gap: space[3] }}>
            <Fact label="Questions" value={`${count}, drawn from ${pool?.questions.length ?? 0}`} />
            <Fact label="Time" value={`${exam.minutes} minutes, about 2 per question`} />
            <Fact
              label="Mix"
              value={domains.map((d) => `${shortDomain(d.id)} ${d.weight}%`).join(' · ')}
            />
            <Fact
              label="Pass"
              value={`${exam.passingScore} of ${exam.scaleMax}, scaled. No per-domain minimum`}
            />
            <Fact label="Rules" value="Answer everything, flag doubts. No penalty for guessing." />
          </View>
        </Row>
      </Rows>

      {past.length ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <View style={{ paddingHorizontal: space[4], paddingVertical: space[3] }}>
            <Text style={type.eyebrow}>Past mocks</Text>
          </View>
          {past.map((r) => (
            <PastExam key={r.id ?? r.at} result={r} onOpen={() => onOpen(r.id ?? '')} />
          ))}
        </View>
      ) : (
        <Panel title="First sitting">
          <Text style={type.muted}>
            Sit it cold, in one go. The score only means something when the clock is honest.
          </Text>
        </Panel>
      )}

      <Text style={[type.muted, { fontSize: 12 }]}>{exam.note}</Text>
      <View style={{ height: space[2] }} />
    </Frame>
  )
}
