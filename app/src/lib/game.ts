import type { Store, Attempt, ExamResult } from './store'
import { today } from './store'
import { bankOf } from './progress'
import { domains, exam, flashcards, lectures, scaledScore, shortDomain, type DomainId } from './content'

/** Points per action. Wrong answers still pay: showing up is the habit being rewarded. */
export const XP = {
  correct: 10,
  wrong: 3,
  hardCorrect: 15,
  hardWrong: 5,
  card: 4,
  lecture: 50,
  exam: 100,
  examPass: 150,
} as const

export const attemptXp = (a: Pick<Attempt, 'correct' | 'bank'>) => {
  const hard = bankOf(a) === 'v2'
  if (a.correct) return hard ? XP.hardCorrect : XP.correct
  return hard ? XP.hardWrong : XP.wrong
}

export const examXp = (e: Pick<ExamResult, 'correct' | 'total'>) =>
  XP.exam + (e.total && scaledScore(e.correct / e.total) >= exam.passingScore ? XP.examPass : 0)

const dayOf = (at: number) => today(new Date(at))

const attemptsPerDay = (s: Store) => {
  const out: Record<string, number> = {}
  for (const a of s.attempts) out[dayOf(a.at)] = (out[dayOf(a.at)] ?? 0) + 1
  return out
}

/** Activity counts every answer and every card grade; the difference is the cards. */
export function cardsGradedPerDay(s: Store) {
  const answers = attemptsPerDay(s)
  const out: Record<string, number> = {}
  for (const [day, n] of Object.entries(s.activity)) out[day] = Math.max(0, n - (answers[day] ?? 0))
  return out
}

export function xpPerDay(s: Store) {
  const out: Record<string, number> = {}
  const add = (day: string, n: number) => (out[day] = (out[day] ?? 0) + n)
  for (const a of s.attempts) add(dayOf(a.at), attemptXp(a))
  for (const [day, n] of Object.entries(cardsGradedPerDay(s))) if (n) add(day, n * XP.card)
  for (const at of Object.values(s.lectureRead)) add(dayOf(at), XP.lecture)
  for (const e of s.exams) add(dayOf(e.at), examXp(e))
  return out
}

export const totalXp = (s: Store) => Object.values(xpPerDay(s)).reduce((a, b) => a + b, 0)
export const xpToday = (s: Store) => xpPerDay(s)[today()] ?? 0

/** Instance sizes, smallest to metal. Reaching metal is finishing the course properly. */
export const LEVELS = [
  'nano', 'micro', 'small', 'medium', 'large', 'xlarge', '2xlarge', '3xlarge',
  '4xlarge', '6xlarge', '8xlarge', '12xlarge', '16xlarge', '24xlarge', '32xlarge', 'metal',
] as const

export const levelThreshold = (index: number) => Math.round(90 * Math.pow(index, 1.8))

export interface Level {
  index: number
  name: string
  /** Points earned inside this level. */
  into: number
  /** Points this level spans, 0 at the top. */
  span: number
  next: string | null
}

export function levelFor(xp: number): Level {
  let index = 0
  while (index + 1 < LEVELS.length && xp >= levelThreshold(index + 1)) index++
  const top = index + 1 >= LEVELS.length
  return {
    index,
    name: LEVELS[index],
    into: xp - levelThreshold(index),
    span: top ? 0 : levelThreshold(index + 1) - levelThreshold(index),
    next: top ? null : LEVELS[index + 1],
  }
}

export const levelLabel = (l: Level) => `L${l.index + 1} · ${l.name}`

export function bestStreak(activity: Record<string, number>) {
  const days = Object.keys(activity).filter((d) => activity[d] > 0).sort()
  let best = 0, run = 0, prev = ''
  for (const day of days) {
    const before = new Date(day)
    before.setDate(before.getDate() - 1)
    run = prev === today(before) ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}

/** The last seven days, oldest first, with whether anything happened. */
export function lastDays(activity: Record<string, number>, n = 7) {
  const out: { key: string; active: boolean; isToday: boolean }[] = []
  const d = new Date()
  d.setDate(d.getDate() - (n - 1))
  for (let i = 0; i < n; i++) {
    const key = today(d)
    out.push({ key, active: (activity[key] ?? 0) > 0, isToday: i === n - 1 })
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Length of the run of correct answers at the end of a sequence. */
export function tailRun(oks: boolean[]) {
  let n = 0
  for (let i = oks.length - 1; i >= 0 && oks[i]; i--) n++
  return n
}

export function longestRun(oks: boolean[]) {
  let best = 0, run = 0
  for (const ok of oks) {
    run = ok ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

export interface Quest {
  id: string
  title: string
  done: number
  target: number
  to: string
}

export function dailyQuests(s: Store): Quest[] {
  const day = today()
  const answered = s.attempts.filter((a) => dayOf(a.at) === day)
  const graded = cardsGradedPerDay(s)[day] ?? 0
  const dueNow = flashcards.filter((c) => !s.cards[c.id] || s.cards[c.id].due <= Date.now()).length
  const cardTarget = Math.min(10, dueNow + graded)
  const readToday = Object.values(s.lectureRead).filter((at) => dayOf(at) === day).length
  const unread = lectures.find((l) => !s.lectureRead[l.id])
  const fixed = answered.filter((a) => a.correct && s.mistakes[a.qid]).length
  const openMistakes = Object.values(s.mistakes).filter((m) => !m.resolved).length

  const quests: Quest[] = [
    { id: 'answer', title: 'Answer 10 questions', done: Math.min(10, answered.length), target: 10, to: '/drill' },
  ]
  if (cardTarget > 0)
    quests.push({ id: 'cards', title: `Review ${cardTarget} card${cardTarget === 1 ? '' : 's'}`, done: Math.min(cardTarget, graded), target: cardTarget, to: '/cards' })
  if (unread)
    quests.push({ id: 'read', title: 'Read the next lecture', done: Math.min(1, readToday), target: 1, to: `/learn/${unread.id}` })
  else if (openMistakes || fixed)
    quests.push({ id: 'fix', title: 'Fix 3 mistakes', done: Math.min(3, fixed), target: 3, to: '/mistakes' })
  return quests
}

export interface Achievement {
  id: string
  title: string
  how: string
  group: 'milestones' | 'streaks' | 'mastery'
  unlocked: boolean
}

const sorted = (s: Store) => s.attempts.slice().sort((a, b) => a.at - b.at)

function drillSets(s: Store) {
  const sets = new Map<string, Attempt[]>()
  for (const a of s.attempts) {
    if (a.mode !== 'drill' || !a.id?.includes(':')) continue
    const key = a.id.slice(0, a.id.indexOf(':'))
    sets.set(key, [...(sets.get(key) ?? []), a])
  }
  return [...sets.values()]
}

export function achievements(s: Store): Achievement[] {
  const all = sorted(s)
  const scored = all.filter((a) => bankOf(a) === 'original')
  const hard = all.filter((a) => bankOf(a) === 'v2')
  const oks = all.map((a) => a.correct)
  const best = bestStreak(s.activity)
  const passes = s.exams
    .filter((e) => bankOf(e) === 'original')
    .sort((a, b) => a.at - b.at)
    .map((e) => e.total > 0 && scaledScore(e.correct / e.total) >= exam.passingScore)
  const sure = all.filter((a) => a.confidence === 'sure')
  const sureAcc = sure.length ? sure.filter((a) => a.correct).length / sure.length : 0
  const hardAcc = hard.length ? hard.filter((a) => a.correct).length / hard.length : 0
  const resolved = Object.values(s.mistakes).filter((m) => m.resolved).length
  const sets = drillSets(s)
  const domainReady = (d: DomainId) => {
    const rel = scored.filter((a) => a.domain === d)
    return rel.length >= 40 && rel.filter((a) => a.correct).length / rel.length >= 0.72
  }
  const ms = (id: string, title: string, how: string, unlocked: boolean): Achievement => ({ id, title, how, group: 'milestones', unlocked })
  const st = (id: string, title: string, how: string, unlocked: boolean): Achievement => ({ id, title, how, group: 'streaks', unlocked })
  const ma = (id: string, title: string, how: string, unlocked: boolean): Achievement => ({ id, title, how, group: 'mastery', unlocked })

  return [
    ms('first', 'First blood', 'Get one question right', oks.includes(true)),
    ms('century', 'Century', 'Answer 100 questions', all.length >= 100),
    ms('five-hundred', 'Five hundred', 'Answer 500 questions', all.length >= 500),
    ms('thousand', 'Thousand', 'Answer 1,000 questions', all.length >= 1000),
    ms('halfway', 'Halfway', 'Read half the lectures', Object.keys(s.lectureRead).length >= Math.ceil(lectures.length / 2)),
    ms('reader', 'Read it all', 'Read every lecture', lectures.every((l) => s.lectureRead[l.id])),
    ms('deck', 'Whole deck', 'Grade every flashcard at least once', flashcards.every((c) => s.cards[c.id])),
    ms('marathon', 'Marathon', 'Finish a 40-question drill set', sets.some((set) => set.length >= 40)),
    st('week', 'One week', 'Study 7 days in a row', best >= 7),
    st('fortnight', 'Two weeks', 'Study 14 days in a row', best >= 14),
    st('month', 'One month', 'Study 30 days in a row', best >= 30),
    st('sharp', 'Sharpshooter', '10 correct in a row', longestRun(oks) >= 10),
    st('hot', 'Hot hand', '25 correct in a row', longestRun(oks) >= 25),
    st('sweep', 'Clean sweep', 'A drill set of 10 or more with nothing missed', sets.some((set) => set.length >= 10 && set.every((a) => a.correct))),
    ma('pass', 'Pass mark', `Score ${exam.passingScore} or more on a mock`, passes.includes(true)),
    ma('double', 'Two in a row', 'Pass two consecutive mocks', passes.some((p, i) => p && passes[i - 1])),
    ma('calibrated', 'Calibrated', '"Sure" is right 85% of the time over 20 answers', sure.length >= 20 && sureAcc >= 0.85),
    ma('hard', 'Hard mode', '60% on 50 hard-bank questions', hard.length >= 50 && hardAcc >= 0.6),
    ma('closer', 'Closer', 'Resolve 25 mistakes', resolved >= 25),
    ...domains.map((d) => ma(`ready-${d.id}`, `${shortDomain(d.id)} ready`, `72% over 40 ${shortDomain(d.id).toLowerCase()} questions`, domainReady(d.id))),
  ]
}

export const unlockedIds = (s: Store) => achievements(s).filter((a) => a.unlocked).map((a) => a.id)
