import { beforeEach, describe, expect, it } from 'vitest'
import {
  accrue,
  answeredCount,
  blankCount,
  cellState,
  choose,
  deadline,
  drawSize,
  examQuestions,
  fmtClock,
  goTo,
  isExpired,
  newExam,
  remainingSeconds,
  reviewItems,
  scoreOf,
  submitExam,
  toggleFlag,
  xpFor,
} from './logic'
import { exam, findQuestion, isMulti, scaledScore, type Question } from '@/lib/content'
import type { ActiveExam } from '@/lib/progress'
import { finishExam, getStore, resetProgress, setActiveExam } from '@/lib/store'
import { examXp, XP } from '@/lib/game'

/** Picks every correct option, one tap at a time, the way the screen does. */
const answerRight = (e: ActiveExam, q: Question) =>
  q.correct.reduce((acc, i) => choose(acc, q, i), e)

const answerWrong = (e: ActiveExam, q: Question) => {
  const bad = q.options.findIndex((_, i) => !q.correct.includes(i))
  return choose(e, q, bad)
}

beforeEach(() => resetProgress())

describe('drawing a paper', () => {
  it('draws the exam count from the chosen bank, without repeats', () => {
    const e = newExam('e1', 'original')
    expect(e.ids).toHaveLength(exam.questions)
    expect(new Set(e.ids).size).toBe(exam.questions)
    expect(e.minutes).toBe(exam.minutes)
    expect(examQuestions(e)).toHaveLength(exam.questions)
  })

  it('never asks a bank for more than it holds', () => {
    expect(drawSize('v2')).toBe(Math.min(exam.questions, 100))
    expect(newExam('e2', 'v2').ids.length).toBe(drawSize('v2'))
  })

  it('covers all four domains', () => {
    const seen = new Set(examQuestions(newExam('e3', 'original')).map((q) => q.domain))
    expect(seen.size).toBe(4)
  })
})

describe('answering', () => {
  it('replaces a single answer and caps a multi one at the number of correct options', () => {
    const e = newExam('e4', 'original')
    const single = examQuestions(e).find((q) => !isMulti(q))!
    expect(choose(choose(e, single, 0), single, 2).answers[single.id]).toEqual([2])

    const multi = examQuestions(e).find(isMulti)!
    const max = multi.correct.length
    let over = e
    for (let i = 0; i < max + 1; i++) over = choose(over, multi, i)
    expect(over.answers[multi.id]).toHaveLength(max)
  })

  it('counts answered, blank and flagged, and colours the navigator cells', () => {
    const e0 = newExam('e5', 'original')
    const q = examQuestions(e0)[1]
    const e = toggleFlag(answerRight(goTo(e0, 1), q), q.id)
    expect(answeredCount(e)).toBe(1)
    expect(blankCount(e)).toBe(exam.questions - 1)
    expect(cellState(e, 1)).toBe('current')
    expect(cellState(e, 0)).toBe('blank')
    expect(toggleFlag(e, q.id).flags).toEqual([])

    const away = goTo(e, 5)
    expect(cellState(away, 1)).toBe('flagged')
  })

  it('accumulates time per question', () => {
    const e = newExam('e6', 'original')
    const id = e.ids[0]
    expect(accrue(accrue(e, id, 12), id, 8).time?.[id]).toBe(20)
    expect(accrue(e, id, 0).time?.[id]).toBeUndefined()
  })
})

describe('the clock', () => {
  it('derives what is left from the start and never drifts', () => {
    const started = Date.now()
    const e = newExam('e7', 'original', started)
    expect(remainingSeconds(e, started)).toBe(exam.minutes * 60)
    expect(remainingSeconds(e, started + 30 * 60_000)).toBe(100 * 60)
    expect(isExpired(e, started)).toBe(false)
    expect(isExpired(e, deadline(e))).toBe(true)
  })

  it('formats as mm:ss, h:mm:ss past the hour, and floors at zero', () => {
    expect(fmtClock(7_800)).toBe('2:10:00')
    expect(fmtClock(exam.minutes * 60)).toBe('2:10:00')
    expect(fmtClock(3_600)).toBe('1:00:00')
    expect(fmtClock(3_599)).toBe('59:59')
    expect(fmtClock(65)).toBe('01:05')
    expect(fmtClock(-4)).toBe('00:00')
  })
})

describe('a full sitting through the store', () => {
  it('records 65 exam attempts, one result and clears the active exam', () => {
    const started = Date.now() - 40 * 60_000
    let e = newExam('sitting-1', 'original', started)
    setActiveExam(e)
    expect(getStore().activeExam?.ids).toHaveLength(exam.questions)

    const qs = examQuestions(e)
    const right = 50
    qs.forEach((q, n) => {
      e = accrue(n < right ? answerRight(e, q) : answerWrong(e, q), q.id, 30)
    })
    setActiveExam(e)

    const live = getStore().activeExam!
    expect(answeredCount(live)).toBe(exam.questions)

    const { attempts, result } = submitExam(live)
    finishExam(attempts, result)

    const s = getStore()
    expect(s.activeExam).toBeNull()
    expect(s.exams).toHaveLength(1)
    expect(s.exams[0].id).toBe('sitting-1')

    const recorded = s.attempts.filter((a) => a.id?.startsWith('sitting-1:'))
    expect(recorded).toHaveLength(exam.questions)
    expect(recorded.every((a) => a.mode === 'exam')).toBe(true)
    expect(recorded.every((a) => a.bank === 'original' && a.seconds === 30)).toBe(true)
    expect(recorded.filter((a) => a.correct)).toHaveLength(right)

    expect(result.correct).toBe(right)
    expect(result.wrongIds).toHaveLength(exam.questions - right)
    expect(scoreOf(result)).toBe(scaledScore(right / exam.questions))
    const perDomain = Object.values(result.byDomain).reduce((a, d) => a + d.total, 0)
    expect(perDomain).toBe(exam.questions)
    expect(result.seconds).toBe(Math.round((result.at - started) / 1000))
    expect(xpFor(result)).toBe(
      right * XP.correct + (exam.questions - right) * XP.wrong + examXp(result),
    )

    // Review reads the paper back off the attempts the sitting wrote.
    const items = reviewItems(result, s.attempts)
    expect(items).toHaveLength(exam.questions)
    expect(items.filter((i) => !i.ok)).toHaveLength(exam.questions - right)
    expect(items[0].q.id).toBe(qs[0].id)
    expect(items[0].chosen).toEqual(qs[0].correct)
  })

  it('leaves blank questions wrong and refuses to score the same sitting twice', () => {
    let e = newExam('sitting-2', 'original')
    const qs = examQuestions(e)
    e = answerRight(e, qs[0])
    const { attempts, result } = submitExam(e)
    expect(result.correct).toBe(1)
    expect(attempts.filter((a) => a.chosen.length === 0)).toHaveLength(exam.questions - 1)

    finishExam(attempts, result)
    finishExam(attempts, result)
    expect(getStore().exams).toHaveLength(1)
    expect(getStore().attempts).toHaveLength(exam.questions)
  })
})

describe('the clock running out', () => {
  it('auto-submits on resume and scores nothing past the deadline', () => {
    const started = Date.now() - (exam.minutes + 20) * 60_000
    let e = newExam('expired', 'original', started)
    const qs = examQuestions(e)
    e = answerRight(e, qs[0])
    setActiveExam(e)

    const live = getStore().activeExam!
    expect(isExpired(live)).toBe(true)

    const { attempts, result } = submitExam(live)
    finishExam(attempts, result)

    // Time stops at the deadline, not whenever the app happened to come back.
    expect(result.at).toBe(deadline(live))
    expect(result.seconds).toBe(exam.minutes * 60)
    expect(attempts.every((a) => a.at === deadline(live))).toBe(true)
    expect(result.correct).toBe(1)
    expect(getStore().activeExam).toBeNull()
    expect(getStore().exams).toHaveLength(1)
  })
})
