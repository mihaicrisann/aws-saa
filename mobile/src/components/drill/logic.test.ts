import { describe, expect, it } from 'vitest'
import {
  advance,
  buildIds,
  check,
  currentQuestion,
  drillPool,
  isFinished,
  newSession,
  seenInBank,
  settingsOf,
  summarize,
  toggleChoice,
  type DrillSettings,
} from './logic'
import { bankQuestions, findQuestion, questionsByLecture } from '@/lib/content'
import { getStore, recordDrillAttempt, resetProgress, setActiveDrill } from '@/lib/store'

const base: DrillSettings = {
  bank: 'original',
  domain: 'all',
  lecture: 'all',
  count: 10,
  unseen: false,
}

describe('building a set', () => {
  it('draws the asked-for count, without repeats, from the chosen bank', () => {
    const ids = buildIds(base, new Set())
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
    const inBank = new Set(bankQuestions('original').map((q) => q.id))
    expect(ids.every((id) => inBank.has(id))).toBe(true)
  })

  it('weights the domains when nothing is filtered', () => {
    const ids = buildIds({ ...base, count: 40 }, new Set())
    const byDomain = new Set(ids.map((id) => findQuestion(id)!.domain))
    expect(byDomain.size).toBe(4)
  })

  it('stays inside one lecture when one is picked', () => {
    const lecture = questionsByLecture('iam')[0]?.lecture ?? bankQuestions('original')[0].lecture
    const ids = buildIds({ ...base, lecture }, new Set())
    expect(ids.length).toBeGreaterThan(0)
    expect(ids.every((id) => findQuestion(id)!.lecture === lecture)).toBe(true)
  })

  it('drops anything already attempted in that bank when unseen is on', () => {
    const first = bankQuestions('original')[0]
    const seen = seenInBank([{ qid: first.id, bank: 'original' }], 'original')
    expect(drillPool({ ...base, unseen: true }, seen).some((q) => q.id === first.id)).toBe(false)
    expect(drillPool({ ...base, unseen: true }, seenInBank([{ qid: first.id, bank: 'v2' }], 'original')).some((q) => q.id === first.id)).toBe(true)
  })
})

describe('picking options', () => {
  it('replaces the pick on a single-answer question', () => {
    expect(toggleChoice([0], 2, false, 1)).toEqual([2])
  })

  it('toggles and caps a multi-answer question at the number of correct options', () => {
    expect(toggleChoice([0], 1, true, 2)).toEqual([0, 1])
    expect(toggleChoice([0, 1], 0, true, 2)).toEqual([1])
    expect(toggleChoice([0, 1], 3, true, 2)).toEqual([1, 3])
  })
})

describe('a whole ten-question set, through the store', () => {
  it('records one attempt per question and leaves a summary that adds up', () => {
    resetProgress()
    setActiveDrill(newSession('set-1', base, new Set()))

    let answered = 0
    for (;;) {
      const drill = getStore().activeDrill!
      if (isFinished(drill)) break
      const q = currentQuestion(drill)!
      // Right on the even questions, wrong on the odd ones.
      const right = answered % 2 === 0
      const chosen = right
        ? q.correct
        : [q.options.map((_, i) => i).find((i) => !q.correct.includes(i))!]
      const confidence = right ? 'sure' : 'guess'
      const staged = { ...drill, chosen, confidence } as const
      setActiveDrill(staged)
      const { attempt, next } = check(staged, q, Date.now() + 12_000)
      recordDrillAttempt(attempt, next)
      expect(getStore().activeDrill!.revealed).toBe(true)
      setActiveDrill(advance(getStore().activeDrill!))
      answered++
    }

    const store = getStore()
    expect(answered).toBe(10)
    expect(store.attempts).toHaveLength(10)
    expect(store.attempts.every((a) => a.mode === 'drill' && a.bank === 'original')).toBe(true)
    expect(store.attempts.every((a) => a.seconds === 12)).toBe(true)
    expect(store.attempts.filter((a) => a.correct)).toHaveLength(5)

    const drill = store.activeDrill!
    expect(isFinished(drill)).toBe(true)
    const s = summarize(drill)
    expect(s.total).toBe(10)
    expect(s.right).toBe(5)
    expect(s.accuracy).toBe(0.5)
    expect(s.avgSeconds).toBe(12)
    expect(s.xp).toBe(5 * 10 + 5 * 3)
    expect(s.confidentWrong).toBe(0)
    expect(s.byConfidence).toEqual([
      { id: 'sure', n: 5, correct: 5 },
      { id: 'guess', n: 5, correct: 0 },
    ])
    expect(s.calibration).toContain('held up')
    expect(settingsOf(drill)).toEqual(base)

    setActiveDrill(null)
    expect(getStore().activeDrill).toBeNull()
  })

  it('flags confident misses in the summary', () => {
    resetProgress()
    const drill = newSession('set-2', base, new Set())
    const withLog = {
      ...drill,
      index: 2,
      ids: drill.ids.slice(0, 2),
      log: [
        { qid: drill.ids[0], ok: false, confidence: 'sure' as const, seconds: 30 },
        { qid: drill.ids[1], ok: true, confidence: 'sure' as const, seconds: 10 },
      ],
    }
    const s = summarize(withLog)
    expect(s.confidentWrong).toBe(1)
    expect(s.calibration).toContain('50%')
    expect(s.verdict).toContain('Below the pass line')
  })
})
