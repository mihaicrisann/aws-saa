import {
  bankQuestions,
  bankVersion,
  findQuestion,
  sameSet,
  shuffle,
  weightedDraw,
  type DomainId,
  type Question,
} from '@/lib/content'
import { bankOf, type ActiveDrill, type QuestionBank } from '@/lib/progress'
import { attemptXp, longestRun } from '@/lib/game'
import type { Attempt, Confidence } from '@/lib/store'

export interface DrillSettings {
  bank: QuestionBank
  domain: DomainId | 'all'
  lecture: string
  count: number
  unseen: boolean
}

export const defaultSettings: DrillSettings = {
  bank: 'original',
  domain: 'all',
  lecture: 'all',
  count: 10,
  unseen: false,
}

export const COUNTS = [10, 20, 40]

/** Question ids already attempted in this bank. Untagged history is original-bank. */
export const seenInBank = (attempts: Pick<Attempt, 'qid' | 'bank'>[], bank: QuestionBank) =>
  new Set(attempts.filter((a) => bankOf(a) === bank).map((a) => a.qid))

export function drillPool(s: DrillSettings, seen: Set<string>): Question[] {
  return bankQuestions(s.bank).filter(
    (q) =>
      (s.domain === 'all' || q.domain === s.domain) &&
      (s.lecture === 'all' || q.lecture === s.lecture) &&
      (!s.unseen || !seen.has(q.id)),
  )
}

/**
 * An unfiltered set follows the exam's domain weighting; a filtered one is
 * already a deliberate slice, so it is only shuffled.
 */
export function buildIds(s: DrillSettings, seen: Set<string>): string[] {
  const pool = drillPool(s, seen)
  const picked =
    s.domain === 'all' && s.lecture === 'all'
      ? weightedDraw(Math.min(s.count, pool.length), pool)
      : shuffle(pool).slice(0, s.count)
  return picked.map((q) => q.id)
}

export function newSession(id: string, s: DrillSettings, seen: Set<string>): ActiveDrill {
  return {
    id,
    ids: buildIds(s, seen),
    index: 0,
    chosen: [],
    revealed: false,
    shownAt: Date.now(),
    log: [],
    domain: s.domain,
    lecture: s.lecture,
    count: s.count,
    unseen: s.unseen,
    bank: s.bank,
    bankVersion: bankVersion(s.bank),
  }
}

export const settingsOf = (d: ActiveDrill): DrillSettings => ({
  bank: d.bank ?? 'original',
  domain: (d.domain as DomainId | 'all') ?? 'all',
  lecture: d.lecture || 'all',
  count: d.count,
  unseen: d.unseen,
})

/** Single-answer replaces; multi toggles and drops the oldest past the cap. */
export function toggleChoice(chosen: number[], i: number, multi: boolean, max: number): number[] {
  if (!multi) return [i]
  if (chosen.includes(i)) return chosen.filter((x) => x !== i)
  const next = [...chosen, i]
  return next.length > max ? next.slice(next.length - max) : next
}

export const questionsOf = (d: ActiveDrill | null): Question[] =>
  (d?.ids ?? []).map(findQuestion).filter((q): q is Question => !!q)

export const currentQuestion = (d: ActiveDrill | null): Question | undefined => {
  if (!d) return undefined
  const id = d.ids[d.index]
  return id ? findQuestion(id) : undefined
}

/** The attempt to record and the session it leaves behind. */
export function check(
  d: ActiveDrill,
  q: Question,
  now = Date.now(),
): { attempt: Attempt; next: ActiveDrill } {
  const ok = sameSet(d.chosen, q.correct)
  const seconds = Math.max(0, Math.round((now - d.shownAt) / 1000))
  return {
    attempt: {
      id: `${d.id}:${q.id}`,
      qid: q.id,
      domain: q.domain,
      lecture: q.lecture,
      correct: ok,
      chosen: d.chosen,
      at: now,
      mode: 'drill',
      confidence: d.confidence,
      seconds,
      bank: d.bank ?? 'original',
      bankVersion: d.bankVersion ?? 0,
    },
    next: {
      ...d,
      revealed: true,
      log: [...d.log, { qid: q.id, ok, confidence: d.confidence, seconds }],
    },
  }
}

export const advance = (d: ActiveDrill, now = Date.now()): ActiveDrill => ({
  ...d,
  index: d.index + 1,
  chosen: [],
  revealed: false,
  confidence: undefined,
  shownAt: now,
})

export const isFinished = (d: ActiveDrill) => d.index >= d.ids.length

export interface ConfidenceSlice {
  id: Confidence
  n: number
  correct: number
}

export interface Summary {
  total: number
  right: number
  accuracy: number
  avgSeconds: number
  byConfidence: ConfidenceSlice[]
  confidentWrong: number
  bestRun: number
  xp: number
  verdict: string
  calibration: string | null
}

const VERDICT = (p: number) =>
  p >= 85
    ? 'Solid. Move on.'
    : p >= 72
      ? 'Around the pass line. Work the misses first.'
      : 'Below the pass line. Re-read the lectures behind the misses.'

export function summarize(d: ActiveDrill): Summary {
  const log = d.log
  const bank = d.bank ?? 'original'
  const total = log.length
  const right = log.filter((l) => l.ok).length
  const accuracy = total ? right / total : 0
  const byConfidence = (['sure', 'unsure', 'guess'] as const)
    .map((id) => {
      const rel = log.filter((l) => l.confidence === id)
      return { id, n: rel.length, correct: rel.filter((l) => l.ok).length }
    })
    .filter((c) => c.n > 0)
  const sure = byConfidence.find((c) => c.id === 'sure')
  const sureAcc = sure ? sure.correct / sure.n : null

  return {
    total,
    right,
    accuracy,
    avgSeconds: total ? Math.round(log.reduce((a, l) => a + l.seconds, 0) / total) : 0,
    byConfidence,
    confidentWrong: log.filter((l) => !l.ok && l.confidence === 'sure').length,
    bestRun: longestRun(log.map((l) => l.ok)),
    xp: log.reduce((a, l) => a + attemptXp({ correct: l.ok, bank }), 0),
    verdict: VERDICT(Math.round(accuracy * 100)),
    calibration:
      sureAcc === null
        ? null
        : sureAcc < 0.85
          ? `"Sure" landed ${Math.round(sureAcc * 100)}% right. Slow down on the qualifier.`
          : '"Sure" held up. Trust it and spend the time elsewhere.',
  }
}
