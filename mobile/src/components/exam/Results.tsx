import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { domains, exam, findQuestion, lectureById, lectureNo, shortDomain } from '@/lib/content'
import type { ExamResult } from '@/lib/store'
import { space, useTheme } from '@/theme/tokens'
import { fonts, useType } from '@/theme/type'
import { Button, Frame, Meter, Panel, Pressable98, Stat, StatRow } from '@/components/ui'
import { accuracyOf, fmtClock, fmtDuration, passed, scoreOf, xpFor } from './logic'

function DomainRow({
  id,
  correct,
  total,
}: {
  id: (typeof domains)[number]['id']
  correct: number
  total: number
}) {
  const t = useTheme()
  const type = useType()
  const pct = total ? correct / total : 0
  return (
    <View style={{ gap: space[2] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <Text style={[type.body, { flex: 1, fontSize: 13 }]}>{shortDomain(id)}</Text>
        <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground }]}>
          {correct}/{total}
        </Text>
        <Text style={[type.mono, { fontSize: 12, width: 40, textAlign: 'right' }]}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
      <Meter value={pct} color={t.domain[id]} />
    </View>
  )
}

export function ExamResults({
  result,
  wrongCount,
  onReview,
  onDone,
}: {
  result: ExamResult
  wrongCount: number
  onReview: () => void
  onDone: () => void
}) {
  const t = useTheme()
  const type = useType()
  const ok = passed(result)
  const acc = accuracyOf(result)
  const router = useRouter()
  const byLecture = Object.entries(
    result.wrongIds.reduce<Record<string, number>>((a, id) => {
      const lecture = findQuestion(id)?.lecture
      if (lecture) a[lecture] = (a[lecture] ?? 0) + 1
      return a
    }, {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <Frame
      footer={
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button label={`Review ${wrongCount} missed`} onPress={onReview} />
          <Button label="Done" variant="outline" onPress={onDone} />
        </View>
      }
    >
      <View style={{ gap: space[2] }}>
        <Text style={[type.eyebrow, { color: ok ? t.good : t.bad }]}>
          {ok ? 'Pass' : 'Below the line'}
        </Text>
        <Text
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: 64,
            lineHeight: 68,
            letterSpacing: -2.6,
            color: ok ? t.good : t.foreground,
          }}
        >
          {scoreOf(result)}
        </Text>
        <Text style={type.muted}>
          {ok
            ? 'Sit another in two days on a fresh draw. Two in a row is the real signal.'
            : 'Re-read the lectures behind the misses before the next one.'}
        </Text>
      </View>

      <StatRow>
        <Stat
          label="Accuracy"
          value={`${Math.round(acc * 100)}%`}
          hint={`${result.correct}/${result.total} correct`}
          tone={ok ? 'good' : 'bad'}
        />
        <Stat label="Pass mark" value={exam.passingScore} hint="scaled" />
        <Stat
          label="Time used"
          value={fmtDuration(result.seconds)}
          hint={`${fmtClock(Math.round(result.seconds / Math.max(1, result.total)))} per question`}
        />
        <Stat label="XP earned" value={`+${xpFor(result)}`} />
      </StatRow>

      <Panel title="By domain">
        <View style={{ gap: space[4] }}>
          {domains.map((d) => (
            <DomainRow
              key={d.id}
              id={d.id}
              correct={result.byDomain[d.id]?.correct ?? 0}
              total={result.byDomain[d.id]?.total ?? 0}
            />
          ))}
        </View>
      </Panel>
      {byLecture.length ? (
        <Panel title={`${result.wrongIds.length} missed`}>
          <View style={{ gap: space[1] }}>
            {byLecture.map(([lecture, n]) => (
              <Pressable98
                key={lecture}
                accessibilityLabel={`Read lecture ${lectureNo(lecture)}`}
                onPress={() => router.push({ pathname: '/learn/[id]', params: { id: lecture } })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[2],
                  paddingVertical: space[2],
                }}
              >
                <Text style={[type.mono, { fontSize: 11, color: t.faintForeground }]}>
                  {lectureNo(lecture)}
                </Text>
                <Text numberOfLines={1} style={[type.body, { flex: 1, fontSize: 13 }]}>
                  {lectureById[lecture]?.title ?? lecture}
                </Text>
                <Text style={[type.mono, { fontSize: 12, color: t.bad }]}>{n}</Text>
              </Pressable98>
            ))}
          </View>
        </Panel>
      ) : null}
      <View style={{ height: space[4] }} />
    </Frame>
  )
}
