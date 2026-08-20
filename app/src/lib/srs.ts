import type { CardState } from './store'

/** Grades the reviewer gives a card. */
export type Grade = 0 | 1 | 2 | 3 // again, hard, good, easy

const DAY = 86_400_000

export const freshCard = (): CardState => ({ ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 })

/** A trimmed SM-2: enough spacing to be useful, few enough knobs to reason about. */
export function schedule(card: CardState, grade: Grade, now = Date.now()): CardState {
  const c = { ...card }

  if (grade === 0) {
    c.lapses += 1
    c.reps = 0
    c.interval = 0
    c.ease = Math.max(1.3, c.ease - 0.2)
    c.due = now + 60_000 // back in this session, a minute later
    c.lastGrade = grade
    return c
  }

  c.reps += 1
  if (grade === 1) c.ease = Math.max(1.3, c.ease - 0.15)
  if (grade === 3) c.ease = Math.min(3.2, c.ease + 0.1)

  if (c.reps === 1) c.interval = grade === 3 ? 3 : 1
  else if (c.reps === 2) c.interval = grade === 1 ? 3 : 6
  else c.interval = Math.round(c.interval * c.ease * (grade === 1 ? 0.7 : 1))

  c.interval = Math.max(1, Math.min(c.interval, 365))
  c.due = now + c.interval * DAY
  c.lastGrade = grade
  return c
}

export const isDue = (c: CardState | undefined, now = Date.now()) => !c || c.due <= now

export function describeInterval(card: CardState, grade: Grade): string {
  const next = schedule(card, grade)
  if (grade === 0) return '1 min'
  if (next.interval === 1) return '1 day'
  if (next.interval < 30) return `${next.interval} days`
  return `${Math.round(next.interval / 30)} mo`
}
