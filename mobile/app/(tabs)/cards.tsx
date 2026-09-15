import { useMemo, useState } from 'react'
import {
  afterGrade,
  buildQueue,
  CardSession,
  CardsDone,
  Deck,
  deckCounts,
  type CardScope,
} from '@/components/cards'
import { flashcards, type DomainId } from '@/lib/content'
import { freshCard, schedule, type Grade } from '@/lib/srs'
import { getStore, setCard, useStore } from '@/lib/store'

const cardById = Object.fromEntries(flashcards.map((c) => [c.id, c]))

export default function Cards() {
  const cards = useStore((s) => s.cards)
  const [domain, setDomain] = useState<DomainId | 'all'>('all')
  const [queue, setQueue] = useState<string[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [reviewed, setReviewed] = useState(0)

  const counts = useMemo(() => deckCounts(cards, domain), [cards, domain])

  const start = (scope: CardScope) => {
    setQueue(buildQueue(getStore().cards, domain, scope))
    setFlipped(false)
    setReviewed(0)
  }

  if (!queue)
    return <Deck cards={cards} domain={domain} onDomain={setDomain} onStart={start} />

  const card = queue[0] ? cardById[queue[0]] : undefined

  if (!card)
    return (
      <CardsDone
        reviewed={reviewed}
        stillDue={counts.due}
        onBack={() => setQueue(null)}
      />
    )

  const state = cards[card.id] ?? freshCard()

  const grade = (g: Grade) => {
    setCard(card.id, schedule(state, g))
    setQueue((q) => (q ? afterGrade(q, g === 0) : q))
    setFlipped(false)
    setReviewed((n) => n + 1)
  }

  return (
    <CardSession
      card={card}
      state={state}
      flipped={flipped}
      done={reviewed}
      left={queue.length}
      onFlip={() => setFlipped((f) => !f)}
      onGrade={grade}
      onQuit={() => setQueue(null)}
    />
  )
}
