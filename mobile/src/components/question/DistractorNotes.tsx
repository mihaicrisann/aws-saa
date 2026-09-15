import { Text, View } from 'react-native'
import { space } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Panel } from '@/components/ui'
import { LETTERS } from './OptionRow'

/** Why each wrong option is wrong. Blank entries are skipped. */
export function DistractorNotes({ distractors }: { distractors: string[] }) {
  const type = useType()
  const items = distractors.map((d, i) => ({ d, i })).filter((x) => !!x.d)
  if (!items.length) return null

  return (
    <Panel title="Why the others are wrong">
      <View style={{ gap: space[2] }}>
        {items.map(({ d, i }) => (
          <View key={i} style={{ flexDirection: 'row', gap: space[2] }}>
            <Text style={[type.mono, { fontSize: 12, width: 16 }]}>{LETTERS[i]}</Text>
            <Text style={[type.muted, { flex: 1, fontSize: 13 }]}>{d}</Text>
          </View>
        ))}
      </View>
    </Panel>
  )
}
