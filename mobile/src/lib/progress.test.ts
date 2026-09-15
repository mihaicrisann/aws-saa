import { describe, it, expect } from 'vitest'
import {
  emptyProgress,
  normalizeProgress,
  changesBetween,
  applyChanges,
  mergeImport,
  ProgressConflict,
  bankOf,
  bankVersionOf,
  identity,
  type Progress,
} from './progress'
const attempt = {
  id: 'attempt-1',
  qid: 'q1',
  domain: 'secure' as const,
  lecture: '02-iam',
  correct: true,
  chosen: [0],
  at: 100,
  mode: 'drill' as const,
}
describe('durable progress merging', () => {
  it('merges independent changes from stale devices', () => {
    const base = emptyProgress()
    const left = { ...base, notes: { one: 'first' } }
    const right = { ...base, notes: { two: 'second' } }
    expect(applyChanges(left, changesBetween(base, right)).notes).toEqual({
      one: 'first',
      two: 'second',
    })
  })
  it('compares JSONB objects independently of PostgreSQL key ordering', () => {
    const base = {
      ...emptyProgress(),
      activeExam: {
        id: 'exam',
        ids: ['q1', 'q2'],
        answers: { q2: [1], q1: [0] },
        flags: [],
        startedAt: 0,
        minutes: 10,
      },
    }
    const stored = {
      ...base,
      activeExam: { ...base.activeExam, answers: { q1: [0], q2: [1] } },
    }
    const next = { ...base, activeExam: { ...base.activeExam, index: 1 } }
    expect(
      applyChanges(stored, changesBetween(base, next)).activeExam?.index,
    ).toBe(1)
  })
  it('rejects same-note races instead of silently overwriting', () => {
    const base = emptyProgress()
    expect(() =>
      applyChanges(
        { ...base, notes: { one: 'remote' } },
        changesBetween(base, { ...base, notes: { one: 'local' } }),
      ),
    ).toThrow(ProgressConflict)
  })
  it('adds concurrent activity increments even if their resulting counts match', () => {
    const base = emptyProgress()
    const next = { ...base, activity: { '2026-09-10': 1 } }
    expect(
      applyChanges(next, changesBetween(base, next)).activity['2026-09-10'],
    ).toBe(2)
  })
  it('deduplicates retrying a completed attempt including activity and session changes', () => {
    const base = emptyProgress()
    const next = { ...base, attempts: [attempt], activity: { day: 1 } }
    expect(applyChanges(next, changesBetween(base, next))).toEqual(next)
  })
  it('keeps independent attempts and their activity', () => {
    const base = emptyProgress()
    const left = { ...base, attempts: [attempt], activity: { day: 1 } }
    const right = {
      ...base,
      attempts: [{ ...attempt, id: 'attempt-2' }],
      activity: { day: 1 },
    }
    const merged = applyChanges(left, changesBetween(base, right))
    expect(merged.attempts).toHaveLength(2)
    expect(merged.activity.day).toBe(2)
  })
  it('preserves notes/cards/history when importing a partial legacy export', () => {
    const current = {
      ...emptyProgress(),
      notes: { existing: 'keep' },
      attempts: [attempt],
    }
    const imported = normalizeProgress({
      notes: { incoming: 'new' },
      cards: { card: { ease: 2.5, interval: 2, due: 100, reps: 1, lapses: 0 } },
    })
    const merged = mergeImport(current, imported)
    expect(merged.notes).toEqual({ existing: 'keep', incoming: 'new' })
    expect(merged.cards.card.reps).toBe(1)
    expect(merged.attempts).toHaveLength(1)
  })
  it('assigns stable bounded legacy IDs, so repeat imports cannot duplicate history', () => {
    const legacy = { ...attempt, id: undefined }
    const imported = normalizeProgress({ attempts: [legacy] })
    expect(imported.attempts[0].id!.length).toBeLessThan(250)
    expect(
      mergeImport(imported, normalizeProgress({ attempts: [legacy] })).attempts,
    ).toHaveLength(1)
  })
  it('rejects corrupt imports and prototype keys', () => {
    expect(() => normalizeProgress({ attempts: 'wrong' })).toThrow()
    expect(() =>
      normalizeProgress({ notes: JSON.parse('{"__proto__":"bad"}') }),
    ).toThrow()
  })
  it('does not partially apply an atomic exam finalization when its session conflicts', () => {
    const base = emptyProgress()
    const other = {
      ...base,
      activeExam: {
        id: 'other',
        ids: ['q'],
        answers: {},
        flags: [],
        startedAt: 0,
        minutes: 10,
      },
    }
    const change = changesBetween(
      { ...base, activeExam: { ...other.activeExam, id: 'first' } },
      { ...base, attempts: [attempt] },
    )
    expect(() => applyChanges(other, change)).toThrow(ProgressConflict)
    expect(other.attempts).toEqual([])
  })
})

describe('question bank metadata', () => {
  it('reads untagged history as the original bank', () => {
    const stored = normalizeProgress({
      attempts: [attempt],
      exams: [
        {
          id: 'exam-1',
          at: 1,
          total: 10,
          correct: 8,
          seconds: 100,
          byDomain: {},
          wrongIds: [],
        },
      ],
    })
    expect(stored.attempts[0].bank).toBeUndefined()
    expect(bankOf(stored.attempts[0])).toBe('original')
    expect(bankVersionOf(stored.attempts[0])).toBe(0)
    expect(bankOf(stored.exams[0])).toBe('original')
  })
  it('keeps tagged attempts, exams and sessions through a round trip', () => {
    const tagged = normalizeProgress({
      attempts: [{ ...attempt, id: 'v2-attempt', bank: 'v2', bankVersion: 2 }],
      exams: [
        {
          id: 'v2-exam',
          at: 1,
          total: 10,
          correct: 8,
          seconds: 100,
          byDomain: {},
          wrongIds: [],
          bank: 'v2',
          bankVersion: 2,
        },
      ],
      activeDrill: {
        id: 'drill',
        ids: ['v2-001'],
        index: 0,
        chosen: [],
        revealed: false,
        shownAt: 0,
        log: [],
        domain: 'all',
        lecture: 'all',
        count: 10,
        unseen: false,
        bank: 'v2',
        bankVersion: 2,
      },
      activeExam: {
        id: 'exam',
        ids: ['v2-001'],
        answers: {},
        flags: [],
        startedAt: 0,
        minutes: 10,
        bank: 'v2',
        bankVersion: 2,
      },
    })
    expect(bankOf(tagged.attempts[0])).toBe('v2')
    expect(bankVersionOf(tagged.exams[0])).toBe(2)
    expect(tagged.activeDrill?.bank).toBe('v2')
    expect(tagged.activeExam?.bank).toBe('v2')
  })
  it('does not renumber pre-tag legacy history when a bank tag is added', () => {
    const legacy = { ...attempt, id: undefined }
    // Frozen: the id the pre-bank-tag algorithm assigned to this record.
    expect(identity(legacy)).toBe('legacy:100:536716e0c61b1ffe')
    expect(identity({ ...legacy, bank: 'v2' as const, bankVersion: 3 })).toBe(
      identity(legacy),
    )
  })
  it('does not resurrect duplicates when tagged history is re-imported', () => {
    const legacy = normalizeProgress({ attempts: [{ ...attempt, id: undefined }] })
    const tagged = normalizeProgress({
      attempts: [{ ...attempt, id: undefined, bank: 'original', bankVersion: 1 }],
    })
    expect(tagged.attempts[0].id).toBe(legacy.attempts[0].id)
    expect(mergeImport(legacy, tagged).attempts).toHaveLength(1)
    expect(
      applyChanges(legacy, changesBetween(emptyProgress(), tagged)).attempts,
    ).toHaveLength(1)
  })
  it('merges a hard-bank attempt alongside existing original history', () => {
    const base = normalizeProgress({ attempts: [attempt] })
    const next = {
      ...base,
      attempts: [
        ...base.attempts,
        { ...attempt, id: 'v2-1', qid: 'v2-001', bank: 'v2' as const, bankVersion: 1 },
      ],
    }
    const merged = applyChanges(base, changesBetween(base, next))
    expect(merged.attempts).toHaveLength(2)
    expect(merged.attempts.filter((a) => bankOf(a) === 'original')).toHaveLength(1)
    expect(merged.attempts.filter((a) => bankOf(a) === 'v2')).toHaveLength(1)
  })
})
