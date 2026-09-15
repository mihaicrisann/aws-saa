import { flashcards, type DomainId, type Flashcard } from '@/lib/content'
import { isDue } from '@/lib/srs'
import type { CardState } from '@/lib/store'

export type CardScope = 'due' | 'new' | 'ahead'
export const AHEAD = 20

export const inDomain = (domain: DomainId | 'all') =>
  domain === 'all' ? flashcards : flashcards.filter((c) => c.domain === domain)

export interface DeckCounts {
  due: number
  total: number
  learned: number
}

export function deckCounts(
  cards: Record<string, CardState>,
  domain: DomainId | 'all',
  now = Date.now(),
): DeckCounts {
  const pool = inDomain(domain)
  return {
    due: pool.filter((c) => isDue(cards[c.id], now)).length,
    total: pool.length,
    learned: pool.filter((c) => (cards[c.id]?.reps ?? 0) > 0).length,
  }
}

const byDueThenId = (cards: Record<string, CardState>) => (a: Flashcard, b: Flashcard) => {
  const d = (cards[a.id]?.due ?? 0) - (cards[b.id]?.due ?? 0)
  return d !== 0 ? d : a.id.localeCompare(b.id)
}

/** Due first, oldest due first; "new" is what has never been graded; "ahead" borrows from tomorrow. */
export function buildQueue(
  cards: Record<string, CardState>,
  domain: DomainId | 'all',
  scope: CardScope,
  now = Date.now(),
): string[] {
  const pool = inDomain(domain)
  if (scope === 'due')
    return pool.filter((c) => isDue(cards[c.id], now)).sort(byDueThenId(cards)).map((c) => c.id)
  if (scope === 'new')
    return pool.filter((c) => !cards[c.id]).sort(byDueThenId(cards)).map((c) => c.id)
  return pool
    .filter((c) => !isDue(cards[c.id], now))
    .sort(byDueThenId(cards))
    .slice(0, AHEAD)
    .map((c) => c.id)
}

/** "Again" sends the card back a few places so it returns inside the session. */
export function afterGrade(queue: string[], again: boolean): string[] {
  const [head, ...rest] = queue
  if (!head) return queue
  return again ? [...rest.slice(0, 3), head, ...rest.slice(3)] : rest
}
