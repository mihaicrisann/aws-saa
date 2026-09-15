import { Text, View } from 'react-native'
import { space } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { XP } from '@/lib/game'
import { Button, Frame, Header, Stat, StatRow } from '@/components/ui'

export function CardsDone({
  reviewed,
  stillDue,
  onBack,
}: {
  reviewed: number
  stillDue: number
  onBack: () => void
}) {
  const type = useType()
  return (
    <Frame
      footer={
        <View style={{ flexDirection: 'row', gap: space[2] }}>
          <Button label="Back to the deck" onPress={onBack} />
        </View>
      }
    >
      <Header
        eyebrow="Deck done"
        title={`${reviewed} card${reviewed === 1 ? '' : 's'} reviewed`}
        description="Good and Easy come back in days, so the deck shrinks as things stick."
      />
      <StatRow>
        <Stat label="Reviewed" value={reviewed} />
        <Stat label="Still due" value={stillDue} />
        <Stat label="XP earned" value={`+${reviewed * XP.card}`} />
      </StatRow>
      <Text style={type.muted}>Come back tomorrow, or pull the next ones forward.</Text>
    </Frame>
  )
}
