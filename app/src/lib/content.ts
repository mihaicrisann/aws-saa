import curriculumJson from '@content/curriculum.json'
import questionsJson from '@content/questions.json'
import flashcardsJson from '@content/flashcards.json'
import questionsV2Json from '@content/questions-v2.json'
import type { QuestionBank } from './progress'

export type DomainId = 'secure' | 'resilient' | 'perf' | 'cost'

export interface Domain {
  id: DomainId
  n: number
  name: string
  weight: number
  color: 'signal' | 'violet' | 'amber' | 'coral'
}

export interface Lecture {
  id: string
  n: number
  module: string
  title: string
  standfirst: string
  minutes: number
  domains: DomainId[]
  tags: string[]
}

export interface Question {
  id: string
  domain: DomainId
  lecture: string
  difficulty: number
  stem: string
  options: string[]
  correct: number[]
  explanation: string
  distractors?: string[]
  anchor?: string
  sources?: { url: string; checkedAt: string }[]
}

export interface Flashcard {
  id: string
  domain: DomainId
  lecture: string
  front: string
  back: string
  note?: string
}

export const curriculum = curriculumJson as unknown as {
  exam: {
    code: string
    name: string
    questions: number
    scored: number
    minutes: number
    passingScore: number
    scaleMin: number
    scaleMax: number
    costUsd: number
    note: string
  }
  domains: Domain[]
  modules: { id: string; name: string; blurb: string }[]
  lectures: Lecture[]
}

export const questions = questionsJson as unknown as Question[]
export const questionsV2 = questionsV2Json as unknown as Question[]
export const flashcards = flashcardsJson as unknown as Flashcard[]

export interface Bank {
  id: QuestionBank
  label: string
  blurb: string
  /** Bumped when the bank's questions change enough that older results are not comparable. */
  version: number
  questions: Question[]
}
export const banks: Bank[] = [
  {
    id: 'original',
    label: 'Original',
    blurb: 'Exam-level coverage across every lecture.',
    version: 2,
    questions,
  },
  {
    id: 'v2',
    label: 'Hard',
    blurb: 'Harder scenarios with sourced explanations. Fewer, nastier.',
    version: 1,
    questions: questionsV2,
  },
]
export const bankById = Object.fromEntries(banks.map((b) => [b.id, b])) as Record<QuestionBank, Bank>
export const bankQuestions = (b: QuestionBank) => bankById[b].questions
export const bankVersion = (b: QuestionBank) => bankById[b].version

const bankOwning = new Map<string, QuestionBank>(
  banks.flatMap((b) => b.questions.map((q) => [q.id, b.id] as const)),
)
/** Which bank a stored question id came from. Untagged history predates the hard bank. */
export const bankOfQuestion = (id: string): QuestionBank => bankOwning.get(id) ?? 'original'
export const questionById = new Map(banks.flatMap((b) => b.questions.map((q) => [q.id, q] as const)))
export const findQuestion = (id: string) => questionById.get(id)

export const domains = curriculum.domains
export const lectures = curriculum.lectures
export const modules = curriculum.modules
export const exam = curriculum.exam

export const domainById = Object.fromEntries(domains.map((d) => [d.id, d])) as Record<DomainId, Domain>
export const lectureById = Object.fromEntries(lectures.map((l) => [l.id, l])) as Record<string, Lecture>

export const domainVar = (id: DomainId) => `var(--domain-${id})`
const SHORT: Record<DomainId, string> = { secure: 'Secure', resilient: 'Resilient', perf: 'Performance', cost: 'Cost' }
export const shortDomain = (id: DomainId) => SHORT[id]
/** Route to the lecture, at the section that answers the question when known. */
export const questionHref = (q: Pick<Question, 'lecture' | 'anchor'>) => `/learn/${q.lecture}${q.anchor ? `#${q.anchor}` : ''}`
export const lectureNo = (id: string) => String(lectureById[id]?.n ?? 0).padStart(2, '0')

export const questionsByDomain = (d: DomainId, b: QuestionBank = 'original') => bankQuestions(b).filter((q) => q.domain === d)
export const questionsByLecture = (l: string, b: QuestionBank = 'original') => bankQuestions(b).filter((q) => q.lecture === l)
export const cardsByLecture = (l: string) => flashcards.filter((c) => c.lecture === l)

export function shuffle<T>(input: T[], rng: () => number = Math.random): T[] {
  const a = [...input]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Draw `count` questions, matching the real exam's domain weighting rather
 * than the bank's own distribution.
 */
export function weightedDraw(count: number, pool: Question[] = questions): Question[] {
  const picked: Question[] = []
  const used = new Set<string>()

  for (const d of domains) {
    const want = Math.round((d.weight / 100) * count)
    const bucket = shuffle(pool.filter((q) => q.domain === d.id))
    for (const q of bucket.slice(0, want)) {
      picked.push(q)
      used.add(q.id)
    }
  }
  // top up or trim to land exactly on `count`
  const rest = shuffle(pool.filter((q) => !used.has(q.id)))
  while (picked.length < count && rest.length) picked.push(rest.pop()!)
  return shuffle(picked).slice(0, count)
}

export const isMulti = (q: Question) => q.correct.length > 1

export function sameSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false
  const s = new Set(b)
  return a.every((x) => s.has(x))
}

/** Scaled-score estimate on the exam's own 100-1000 range. */
export function scaledScore(accuracy: number) {
  return Math.round(exam.scaleMin + accuracy * (exam.scaleMax - exam.scaleMin))
}
