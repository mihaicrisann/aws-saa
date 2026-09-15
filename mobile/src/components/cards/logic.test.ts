import { describe, expect, it } from 'vitest'
import { afterGrade, buildQueue, deckCounts } from './logic'
import { flashcards } from '@/lib/content'
import { freshCard, schedule } from '@/lib/srs'
import type { CardState } from '@/lib/store'

const now = Date.UTC(2026, 0, 1)
const at = (due: number, reps = 1): CardState => ({ ...freshCard(), due, reps })

describe('the deck', () => {
  it('counts due, total and learned', () => {
    const [a, b] = flashcards
    const cards = { [a.id]: at(now - 1000), [b.id]: at(now + 86_400_000) }
    const counts = deckCounts(cards, 'all', now)
    expect(counts.total).toBe(flashcards.length)
    expect(counts.learned).toBe(2)
    expect(counts.due).toBe(flashcards.length - 1)
  })

  it('orders the due queue by due date, then id', () => {
    const [a, b, c] = flashcards
    const cards = { [a.id]: at(now - 10), [b.id]: at(now - 5000), [c.id]: at(now + 1) }
    const queue = buildQueue(cards, 'all', 'due', now)
    expect(queue.indexOf(b.id)).toBeLessThan(queue.indexOf(a.id))
    expect(queue).not.toContain(c.id)
  })

  it('offers only ungraded cards as new, and at most twenty ahead', () => {
    const cards = Object.fromEntries(flashcards.map((c) => [c.id, at(now + 86_400_000)]))
    expect(buildQueue(cards, 'all', 'new', now)).toHaveLength(0)
    expect(buildQueue(cards, 'all', 'ahead', now)).toHaveLength(20)
  })

  it('keeps one domain when one is chosen', () => {
    const queue = buildQueue({}, 'secure', 'due', now)
    expect(queue.length).toBeGreaterThan(0)
    expect(queue.every((id) => flashcards.find((c) => c.id === id)!.domain === 'secure')).toBe(true)
  })
})

describe('grading', () => {
  it('drops a graded card and sends "again" back a few places', () => {
    expect(afterGrade(['a', 'b', 'c'], false)).toEqual(['b', 'c'])
    expect(afterGrade(['a', 'b', 'c', 'd', 'e'], true)).toEqual(['b', 'c', 'd', 'a', 'e'])
  })

  it('pushes a good card days out and an again card a minute out', () => {
    const good = schedule(freshCard(), 2, now)
    expect(good.due).toBeGreaterThan(now + 86_400_000 - 1)
    expect(schedule(good, 0, now).due).toBe(now + 60_000)
  })
})
