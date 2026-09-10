import { describe, expect, it } from 'vitest'
import { emptyProgress } from './progress'
import { today } from './store'
import {
  achievements, attemptXp, bestStreak, cardsGradedPerDay, dailyQuests, examXp,
  LEVELS, levelFor, levelThreshold, longestRun, tailRun, totalXp, xpToday, XP,
} from './game'

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return today(d)
}
const attempt = (i: number, correct: boolean, extra: Partial<Parameters<typeof attemptXp>[0]> & { at?: number; id?: string; mode?: 'drill' | 'exam' } = {}) => ({
  id: extra.id ?? `set:${i}`, qid: `q${i}`, domain: 'secure' as const, lecture: '01', correct, chosen: [0],
  at: extra.at ?? Date.now(), mode: extra.mode ?? ('drill' as const), bank: extra.bank,
})

describe('xp', () => {
  it('pays for effort and more for hard questions', () => {
    expect(attemptXp({ correct: true })).toBe(XP.correct)
    expect(attemptXp({ correct: false })).toBe(XP.wrong)
    expect(attemptXp({ correct: true, bank: 'v2' })).toBe(XP.hardCorrect)
    expect(examXp({ correct: 65, total: 65 })).toBe(XP.exam + XP.examPass)
    expect(examXp({ correct: 10, total: 65 })).toBe(XP.exam)
  })
  it('derives cards from activity minus answers', () => {
    const s = { ...emptyProgress(), attempts: [attempt(1, true), attempt(2, false)], activity: { [today()]: 5 } }
    expect(cardsGradedPerDay(s)[today()]).toBe(3)
    expect(xpToday(s)).toBe(XP.correct + XP.wrong + 3 * XP.card)
  })
  it('totals lectures and exams too', () => {
    const s = { ...emptyProgress(), lectureRead: { a: Date.now() }, exams: [{ at: Date.now(), total: 10, correct: 10, seconds: 1, byDomain: {}, wrongIds: [] }] }
    expect(totalXp(s)).toBe(XP.lecture + XP.exam + XP.examPass)
  })
})

describe('levels', () => {
  it('thresholds rise monotonically and start at zero', () => {
    expect(levelThreshold(0)).toBe(0)
    for (let i = 1; i < LEVELS.length; i++) expect(levelThreshold(i)).toBeGreaterThan(levelThreshold(i - 1))
  })
  it('places xp inside the right level', () => {
    expect(levelFor(0)).toMatchObject({ index: 0, name: 'nano', into: 0, next: 'micro' })
    const at = levelThreshold(5)
    expect(levelFor(at)).toMatchObject({ index: 5, name: 'xlarge', into: 0 })
    expect(levelFor(at - 1).index).toBe(4)
    const top = levelFor(1e9)
    expect(top).toMatchObject({ name: 'metal', next: null, span: 0 })
  })
})

describe('streaks and runs', () => {
  it('finds the longest run of consecutive days', () => {
    expect(bestStreak({ [day(-1)]: 1, [day(-2)]: 2, [day(-3)]: 1, [day(-7)]: 1, [day(-8)]: 1 })).toBe(3)
    expect(bestStreak({})).toBe(0)
  })
  it('counts runs of right answers', () => {
    expect(tailRun([false, true, true])).toBe(2)
    expect(tailRun([true, false])).toBe(0)
    expect(longestRun([true, true, false, true, true, true])).toBe(3)
  })
})

describe('quests', () => {
  it('tracks answers today and the next lecture', () => {
    const s = { ...emptyProgress(), attempts: [attempt(1, true), attempt(2, true, { at: Date.now() - 3 * 86_400_000 })] }
    const q = dailyQuests(s)
    expect(q.find((x) => x.id === 'answer')).toMatchObject({ done: 1, target: 10 })
    expect(q.find((x) => x.id === 'read')).toMatchObject({ done: 0, target: 1 })
  })
})

describe('achievements', () => {
  it('unlocks from history alone', () => {
    const attempts = Array.from({ length: 100 }, (_, i) => attempt(i, true, { id: `big:${i}` }))
    const s = { ...emptyProgress(), attempts, exams: [{ at: 1, total: 10, correct: 9, seconds: 1, byDomain: {}, wrongIds: [] }] }
    const on = new Set(achievements(s).filter((a) => a.unlocked).map((a) => a.id))
    expect([...on]).toEqual(expect.arrayContaining(['first', 'century', 'sharp', 'hot', 'marathon', 'sweep', 'pass', 'ready-secure']))
    expect(on.has('double')).toBe(false)
    expect(on.has('week')).toBe(false)
  })
})
