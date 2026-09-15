import {
  bankQuestions,
  bankVersion,
  domains,
  exam,
  findQuestion,
  isMulti,
  sameSet,
  scaledScore,
  weightedDraw,
  type Question,
} from '@/lib/content'
import type { ActiveExam, QuestionBank } from '@/lib/progress'
import { toggleChoice } from '@/components/drill/logic'
import { attemptXp, examXp } from '@/lib/game'
import type { Attempt, ExamResult } from '@/lib/store'

/** A bank smaller than the real paper gives what it has. */
export const drawSize = (bank: QuestionBank) =>
  Math.min(exam.questions, bankQuestions(bank).length)

export function newExam(id: string, bank: QuestionBank, now = Date.now()): ActiveExam {
  return {
    id,
    ids: weightedDraw(drawSize(bank), bankQuestions(bank)).map((q) => q.id),
    answers: {},
    flags: [],
    time: {},
    index: 0,
    startedAt: now,
    minutes: exam.minutes,
    bank,
    bankVersion: bankVersion(bank),
  }
}

export const examQuestions = (e: ActiveExam): Question[] =>
  e.ids.map(findQuestion).filter((q): q is Question => !!q)

export const deadline = (e: ActiveExam) => e.startedAt + e.minutes * 60_000

/** Always derived from the clock, never decremented, so backgrounding cannot drift it. */
export const remainingSeconds = (e: ActiveExam, now = Date.now()) =>
  Math.round((deadline(e) - now) / 1000)

export const isExpired = (e: ActiveExam, now = Date.now()) => remainingSeconds(e, now) <= 0

export const answerOf = (e: ActiveExam, qid: string) => e.answers[qid] ?? []
export const isAnswered = (e: ActiveExam, qid: string) => answerOf(e, qid).length > 0
export const answeredCount = (e: ActiveExam) => e.ids.filter((id) => isAnswered(e, id)).length
export const blankCount = (e: ActiveExam) => e.ids.length - answeredCount(e)

export function choose(e: ActiveExam, q: Question, index: number): ActiveExam {
  return {
    ...e,
    answers: {
      ...e.answers,
      [q.id]: toggleChoice(answerOf(e, q.id), index, isMulti(q), q.correct.length),
    },
  }
}

export const toggleFlag = (e: ActiveExam, qid: string): ActiveExam => ({
  ...e,
  flags: e.flags.includes(qid) ? e.flags.filter((f) => f !== qid) : [...e.flags, qid],
})

/** Charges the seconds since the question appeared to that question. */
export function accrue(e: ActiveExam, qid: string | undefined, seconds: number): ActiveExam {
  if (!qid || seconds <= 0) return e
  const time = e.time ?? {}
  return { ...e, time: { ...time, [qid]: (time[qid] ?? 0) + seconds } }
}

export const goTo = (e: ActiveExam, index: number): ActiveExam => ({
  ...e,
  index: Math.max(0, Math.min(e.ids.length - 1, index)),
})

export const currentId = (e: ActiveExam): string | undefined => e.ids[e.index ?? 0]

export type CellState = 'current' | 'flagged' | 'answered' | 'blank'

export function cellState(e: ActiveExam, n: number): CellState {
  const id = e.ids[n]
  if (n === (e.index ?? 0)) return 'current'
  if (e.flags.includes(id)) return 'flagged'
  return isAnswered(e, id) ? 'answered' : 'blank'
}

export interface Submission {
  attempts: Attempt[]
  result: ExamResult
}

/** One attempt per drawn question plus the exam record. Blank counts as wrong. */
export function submitExam(e: ActiveExam, now = Date.now()): Submission {
  const qs = examQuestions(e)
  const finishedAt = Math.min(now, deadline(e))
  const byDomain: Record<string, { total: number; correct: number }> = {}
  for (const d of domains) byDomain[d.id] = { total: 0, correct: 0 }
  const wrongIds: string[] = []
  const attempts: Attempt[] = []
  let correct = 0

  for (const q of qs) {
    const chosen = answerOf(e, q.id)
    const ok = chosen.length > 0 && sameSet(chosen, q.correct)
    byDomain[q.domain].total += 1
    if (ok) {
      byDomain[q.domain].correct += 1
      correct += 1
    } else wrongIds.push(q.id)
    attempts.push({
      id: `${e.id}:${q.id}`,
      qid: q.id,
      domain: q.domain,
      lecture: q.lecture,
      correct: ok,
      chosen,
      at: finishedAt,
      mode: 'exam',
      seconds: e.time?.[q.id] ?? 0,
      bank: e.bank ?? 'original',
      bankVersion: e.bankVersion ?? 0,
    })
  }

  return {
    attempts,
    result: {
      id: e.id,
      at: finishedAt,
      total: qs.length,
      correct,
      seconds: Math.round((finishedAt - e.startedAt) / 1000),
      byDomain,
      wrongIds,
      bank: e.bank ?? 'original',
      bankVersion: e.bankVersion ?? 0,
    },
  }
}

export const accuracyOf = (r: Pick<ExamResult, 'correct' | 'total'>) =>
  r.total ? r.correct / r.total : 0
export const scoreOf = (r: Pick<ExamResult, 'correct' | 'total'>) => scaledScore(accuracyOf(r))
export const passed = (r: Pick<ExamResult, 'correct' | 'total'>) => scoreOf(r) >= exam.passingScore

/** What the whole sitting was worth: every answer, plus the exam bonus. */
export const xpFor = (r: ExamResult) =>
  r.correct * attemptXp({ correct: true, bank: r.bank }) +
  (r.total - r.correct) * attemptXp({ correct: false, bank: r.bank }) +
  examXp(r)

export interface ReviewItem {
  n: number
  q: Question
  chosen: number[]
  ok: boolean
  seconds: number
}

/** The paper as answered, rebuilt from the attempts the sitting wrote. */
export function reviewItems(result: ExamResult, attempts: Attempt[]): ReviewItem[] {
  const prefix = `${result.id}:`
  return attempts
    .filter((a) => a.id?.startsWith(prefix))
    .map((a, n) => {
      const q = findQuestion(a.qid)
      return q ? { n, q, chosen: a.chosen, ok: a.correct, seconds: a.seconds ?? 0 } : null
    })
    .filter((x): x is ReviewItem => !!x)
}

/** mm:ss, and h:mm:ss once there is an hour on the clock — 130:00 reads as nothing. */
export const fmtClock = (s: number) => {
  const v = Math.max(0, Math.floor(s))
  const mm = String(Math.floor(v / 60) % 60).padStart(2, '0')
  const ss = String(v % 60).padStart(2, '0')
  const h = Math.floor(v / 3600)
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Hours only once there are any, so the results read as a duration not a stopwatch. */
export function fmtDuration(seconds: number) {
  const m = Math.round(Math.max(0, seconds) / 60)
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}

export const fmtDate = (at: number) =>
  new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export const LOW_SECONDS = 600
