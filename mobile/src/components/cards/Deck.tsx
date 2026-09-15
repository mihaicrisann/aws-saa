import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { domains, shortDomain, type DomainId } from '@/lib/content'
import type { CardState } from '@/lib/store'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Choice, Frame, Header, Row, Rows, Stat, StatRow } from '@/components/ui'
import { AHEAD, buildQueue, deckCounts, type CardScope } from './logic'

export function Deck({
  cards,
  domain,
  onDomain,
  onStart,
}: {
  cards: Record<string, CardState>
  domain: DomainId | 'all'
  onDomain: (d: DomainId | 'all') => void
  onStart: (scope: CardScope) => void
}) {
  const t = useTheme()
  const type = useType()
  const counts = useMemo(() => deckCounts(cards, domain), [cards, domain])
  const fresh = useMemo(() => buildQueue(cards, domain, 'new').length, [cards, domain])
  const ahead = useMemo(() => buildQueue(cards, domain, 'ahead').length, [cards, domain])

  return (
    <Frame
      footer={
        counts.due ? (
          <Button label={`Review ${counts.due}`} onPress={() => onStart('due')} grow />
        ) : (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <Button
              label={`Study new (${fresh})`}
              onPress={() => onStart('new')}
              disabled={!fresh}
            />
            <Button
              label={`Review ahead (${Math.min(ahead, AHEAD)})`}
              variant="outline"
              onPress={() => onStart('ahead')}
              disabled={!ahead}
            />
          </View>
        )
      }
    >
      <Header
        title="Cards"
        description="Recall, then rate honestly. The rating sets when it comes back."
      />

      <StatRow>
        <Stat label="Due now" value={counts.due} />
        <Stat label="Total" value={counts.total} />
        <Stat label="Learned" value={counts.learned} hint={`${counts.total - counts.learned} new`} />
      </StatRow>

      <Rows>
        <Row label="Domain" first>
          <Choice
            value={domain}
            options={[
              { value: 'all' as const, label: 'All' },
              ...domains.map((d) => ({ value: d.id, label: shortDomain(d.id), dot: t.domain[d.id] })),
            ]}
            onChange={(v) => v && onDomain(v)}
          />
        </Row>
      </Rows>

      {!counts.due ? (
        <Text style={type.muted}>
          Nothing due here. Take new cards, or pull the next {AHEAD} forward.
        </Text>
      ) : null}
    </Frame>
  )
}
