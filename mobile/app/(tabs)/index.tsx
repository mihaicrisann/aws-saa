import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button, Frame, Header, Meter, Panel, Pressable98, Row, Rows, Stat, StatRow, Toast } from '@/components/ui'
import { recentByDomain } from '@/components/home/logic'
import { SettingsSheet } from '@/components/home/settings-sheet'
import { SyncDot } from '@/components/sync/status'
import { exam, flashcards, lectures, scaledScore, shortDomain } from '@/lib/content'
import { levelFor, levelLabel, totalXp, xpToday } from '@/lib/game'
import { isDue } from '@/lib/srs'
import { studyStreak, useStore } from '@/lib/store'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

const fmt = (n: number) => n.toLocaleString('en-US')
const fmtDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export default function Home() {
  const store = useStore((s) => s)
  const t = useTheme()
  const type = useType()
  const router = useRouter()
  const [settings, setSettings] = useState(false)
  const [toast, setToast] = useState<{ message: string | null; id: number }>({ message: null, id: 0 })

  const xp = useMemo(() => totalXp(store), [store])
  const today = useMemo(() => xpToday(store), [store])
  const level = levelFor(xp)
  const streak = studyStreak(store.activity)
  const due = flashcards.filter((c) => isDue(store.cards[c.id])).length
  const read = Object.keys(store.lectureRead).length
  const stats = useMemo(() => recentByDomain(store.attempts), [store.attempts])
  const answered = stats.reduce((a, s) => a + s.total, 0)
  const last = store.exams.at(-1)
  const score = last && last.total ? scaledScore(last.correct / last.total) : null
  const pass = score != null && score >= exam.passingScore

  const resume = store.activeExam
    ? { label: 'Finish the mock exam', hint: `${store.activeExam.ids.length} questions, clock still running`, to: '/exam' as const }
    : store.activeDrill
      ? { label: 'Resume the drill', hint: `Question ${(store.activeDrill.index ?? 0) + 1} of ${store.activeDrill.ids.length}`, to: '/drill' as const }
      : null

  return (
    <>
      <Frame
        top={
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] }}>
            <View style={{ flex: 1 }}>
              <Header
                eyebrow={`${exam.code} · pass ${exam.passingScore}`}
                title="Overview"
                description="Where you stand today, and what is still owed."
              />
            </View>
            <Pressable
              onPress={() => setSettings(true)}
              accessibilityLabel="Settings"
              hitSlop={12}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], paddingTop: space[2] }}
            >
              <SyncDot compact />
              <Ionicons name="settings-outline" size={20} color={t.mutedForeground} />
            </Pressable>
          </View>
        }
      >
        <StatRow>
          <Stat label="Streak" value={streak} hint={streak === 1 ? 'day' : 'days'} />
          <Stat label="Level" value={level.index + 1} hint={level.name} />
          <Stat label="Cards due" value={due} hint={`of ${flashcards.length}`} />
          <Stat label="Lectures" value={`${read}/${lectures.length}`} hint="read" />
        </StatRow>

        {resume ? (
          <Pressable98 onPress={() => router.navigate(resume.to)}>
            <Rows>
              <Row label="Unfinished" first>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                  <View style={{ flex: 1 }}>
                    <Text style={type.body}>{resume.label}</Text>
                    <Text style={[type.muted, { fontSize: 12 }]}>{resume.hint}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={t.mutedForeground} />
                </View>
              </Row>
            </Rows>
          </Pressable98>
        ) : null}

        <Panel title="Today">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Meter value={store.dailyGoal ? today / store.dailyGoal : 0} />
            <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground, width: 84, textAlign: 'right' }]}>
              {today}/{store.dailyGoal} xp
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
            <Meter value={level.span ? level.into / level.span : 1} />
            <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground, width: 84, textAlign: 'right' }]}>
              {fmt(xp)} xp
            </Text>
          </View>
          <Text style={[type.muted, { fontSize: 12 }]}>
            {levelLabel(level)}
            {level.next ? ` · ${fmt(level.span - level.into)} xp to ${level.next}` : ' · top of the ladder'}
          </Text>
        </Panel>

        <Panel title="Last 50 answers">
          {answered ? (
            stats.map((s) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
                <Text style={[type.muted, { fontSize: 13, width: 88 }]} numberOfLines={1}>
                  {shortDomain(s.id)}
                </Text>
                <Meter value={s.accuracy ?? 0} color={t.domain[s.id]} />
                <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground, width: 56, textAlign: 'right' }]}>
                  {s.accuracy == null ? '—' : `${Math.round(s.accuracy * 100)}%`}
                </Text>
              </View>
            ))
          ) : (
            <Text style={type.muted}>Nothing answered yet. A ten-question drill is enough to start the picture.</Text>
          )}
        </Panel>

        <Panel title="Last mock">
          {last && score != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space[4] }}>
              <View>
                <Text style={[type.mono, { fontSize: 30, letterSpacing: -0.8, color: pass ? t.good : t.bad }]}>
                  {score}
                </Text>
                <Text style={[type.muted, { fontSize: 12 }]}>
                  {pass ? 'pass' : 'below the line'} · pass mark {exam.passingScore}
                </Text>
              </View>
              <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground, textAlign: 'right' }]}>
                {last.correct}/{last.total}
                {'\n'}
                {fmtDate(last.at)}
              </Text>
            </View>
          ) : (
            <View style={{ gap: space[3], alignItems: 'flex-start' }}>
              <Text style={type.muted}>No mocks yet. Sit one once three modules are read — a bad first score is data, not a verdict.</Text>
              <Button label="Sit a mock" variant="outline" size="sm" onPress={() => router.navigate('/exam')} />
            </View>
          )}
        </Panel>
      </Frame>
      <SettingsSheet
        open={settings}
        onClose={() => setSettings(false)}
        onToast={(message) => setToast((x) => ({ message, id: x.id + 1 }))}
      />
      <Toast message={toast.message} id={toast.id} />
    </>
  )
}
