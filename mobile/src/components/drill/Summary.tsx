import { Text, View } from 'react-native'
import type { ActiveDrill } from '@/lib/progress'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Frame, Header, Panel, Stat, StatRow } from '@/components/ui'
import { fmtSeconds } from '@/components/question'
import { summarize } from './logic'

const LABEL = { sure: 'Sure', unsure: 'Think so', guess: 'Guessing' } as const

export function DrillSummary({
  drill,
  onAgain,
  onDone,
}: {
  drill: ActiveDrill
  onAgain: () => void
  onDone: () => void
}) {
  const t = useTheme()
  const type = useType()
  const s = summarize(drill)
  const pct = Math.round(s.accuracy * 100)
  const passed = pct >= 72

  return (
    <Frame
      footer={
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button label={`Another ${drill.count}`} onPress={onAgain} />
          <Button label="Done" variant="outline" onPress={onDone} />
        </View>
      }
    >
      <Header
        eyebrow="Set complete"
        title={
          <Text style={type.display}>
            <Text style={{ color: passed ? t.good : t.bad }}>{s.right}</Text>
            <Text style={{ color: t.faintForeground }}> / {s.total}</Text> correct
          </Text>
        }
        description={s.verdict}
      />

      <StatRow>
        <Stat label="Accuracy" value={`${pct}%`} tone={passed ? 'good' : 'bad'} />
        <Stat label="Per question" value={fmtSeconds(s.avgSeconds)} hint="exam allows 2:00" />
        <Stat
          label="Sure, wrong"
          value={s.confidentWrong}
          tone={s.confidentWrong ? 'bad' : undefined}
          hint={s.confidentWrong ? 'those first' : s.bestRun >= 3 ? `best run ×${s.bestRun}` : 'none'}
        />
        <Stat label="XP earned" value={`+${s.xp}`} />
      </StatRow>

      {s.byConfidence.length ? (
        <Panel title="By confidence">
          <View style={{ gap: space[2] }}>
            {s.byConfidence.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[type.muted, { flex: 1 }]}>{LABEL[c.id]}</Text>
                <Text style={[type.mono, { fontSize: 13 }]}>
                  {c.correct}/{c.n} · {Math.round((c.correct / c.n) * 100)}%
                </Text>
              </View>
            ))}
            {s.calibration ? (
              <Text style={[type.muted, { fontSize: 12 }]}>{s.calibration}</Text>
            ) : null}
          </View>
        </Panel>
      ) : null}
      <View style={{ height: space[4] }} />
    </Frame>
  )
}
