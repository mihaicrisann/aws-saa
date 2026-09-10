import { z } from 'zod'
const number = z.number().finite().nonnegative()
const key = z
  .string()
  .min(1)
  .max(250)
  .refine(
    (v) => !['__proto__', 'constructor', 'prototype'].includes(v),
    'Invalid key',
  )
const confidence = z.enum(['sure', 'unsure', 'guess'])
export const questionBanks = ['original', 'v2'] as const
export type QuestionBank = (typeof questionBanks)[number]
const bank = z.enum(questionBanks)
const bankVersion = z.number().int().nonnegative().max(1_000_000)
// Records written before the hard bank existed carry no tag and are original-bank.
export const bankOf = (item: { bank?: QuestionBank }): QuestionBank =>
  item.bank ?? 'original'
export const bankVersionOf = (item: { bankVersion?: number }) =>
  item.bankVersion ?? 0
export const attemptSchema = z.object({
  id: key.optional(),
  qid: key,
  domain: z.enum(['resilient', 'secure', 'perf', 'cost']),
  lecture: key,
  correct: z.boolean(),
  chosen: z.array(z.number().int().min(0).max(20)).max(20),
  at: number,
  mode: z.enum(['drill', 'exam']),
  confidence: confidence.optional(),
  seconds: number.optional(),
  bank: bank.optional(),
  bankVersion: bankVersion.optional(),
})
const cardSchema = z.object({
  ease: number,
  interval: number,
  due: number,
  reps: number,
  lapses: number,
  lastGrade: number.optional(),
})
export const examSchema = z.object({
  id: key.optional(),
  at: number,
  total: number,
  correct: number,
  seconds: number,
  byDomain: z.record(key, z.object({ total: number, correct: number })),
  wrongIds: z.array(key),
  bank: bank.optional(),
  bankVersion: bankVersion.optional(),
})
export const activeExamSchema = z.object({
  id: key,
  ids: z.array(key).max(200),
  answers: z.record(key, z.array(z.number().int().min(0).max(20))),
  flags: z.array(key),
  startedAt: number,
  minutes: number,
  time: z.record(key, number).optional(),
  index: number.optional(),
  bank: bank.optional(),
  bankVersion: bankVersion.optional(),
})
export const activeDrillSchema = z.object({
  id: key,
  ids: z.array(key).max(200),
  index: number,
  chosen: z.array(z.number().int().min(0).max(20)),
  revealed: z.boolean(),
  confidence: confidence.optional(),
  shownAt: number,
  log: z.array(
    z.object({
      qid: key,
      ok: z.boolean(),
      confidence: confidence.optional(),
      seconds: number,
    }),
  ),
  domain: z.string(),
  lecture: z.string(),
  count: number,
  unseen: z.boolean(),
  bank: bank.optional(),
  bankVersion: bankVersion.optional(),
})
export const progressSchema = z
  .object({
    attempts: z.array(attemptSchema).max(100000).default([]),
    cards: z.record(key, cardSchema).default({}),
    lectureRead: z.record(key, number).default({}),
    notes: z.record(key, z.string().max(100000)).default({}),
    exams: z.array(examSchema).max(10000).default([]),
    mistakes: z
      .record(
        key,
        z.object({
          reason: z
            .enum(['knowledge', 'misread', 'distractor', 'guess'])
            .optional(),
          note: z.string().max(100000).optional(),
          resolved: z.boolean().optional(),
        }),
      )
      .default({}),
    activity: z.record(key, number).default({}),
    theme: z.enum(['dark', 'light']).default('light'),
    activeExam: activeExamSchema.nullable().default(null),
    activeDrill: activeDrillSchema.nullable().default(null),
    legacyMigrated: z.boolean().default(false),
    dailyGoal: z.number().int().min(10).max(5000).default(100),
  })
  .strict()
export type Progress = z.infer<typeof progressSchema>
export type ActiveExam = z.infer<typeof activeExamSchema>
export type ActiveDrill = z.infer<typeof activeDrillSchema>
export const emptyProgress = (): Progress => progressSchema.parse({})
export const identity = (item: {
  id?: string
  at: number
  bank?: QuestionBank
  bankVersion?: number
}) => {
  if (item.id) return item.id
  // Bank tags are metadata, not identity: tagging must not renumber untagged history.
  const { bank: _bank, bankVersion: _version, ...untagged } = item
  const value = JSON.stringify(untagged)
  let a = 2166136261,
    b = 5381
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ value.charCodeAt(i)
  }
  return `legacy:${item.at}:${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`
}
// A payload the caller can never make succeed, as opposed to a server or storage failure.
export class InvalidProgress extends Error {}
export function normalizeProgress(value: unknown): Progress {
  const inspect = (node: unknown, depth = 0) => {
    if (depth > 20)
      throw new InvalidProgress('Progress data is nested too deeply.')
    if (node && typeof node === 'object')
      for (const name of Object.keys(node)) {
        if (['__proto__', 'constructor', 'prototype'].includes(name))
          throw new InvalidProgress('Invalid progress key')
        inspect((node as Record<string, unknown>)[name], depth + 1)
      }
  }
  inspect(value)
  const parsed = progressSchema.parse(value)
  parsed.attempts = Array.from(
    new Map(
      parsed.attempts.map((a) => {
        const item = { ...a, id: identity(a) }
        return [item.id, item]
      }),
    ).values(),
  )
  parsed.exams = Array.from(
    new Map(
      parsed.exams.map((a) => {
        const item = { ...a, id: identity(a) }
        return [item.id, item]
      }),
    ).values(),
  )
  return parsed
}
export type Change = { path: string[]; before: unknown; after: unknown }
const equal = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => equal(item, b[index]))
    )
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>
  const keys = Object.keys(left).filter((k) => left[k] !== undefined),
    other = Object.keys(right).filter((k) => right[k] !== undefined)
  return (
    keys.length === other.length &&
    keys.every((k) => Object.hasOwn(right, k) && equal(left[k], right[k]))
  )
}
export function changesBetween(before: Progress, after: Progress): Change[] {
  const changes: Change[] = []
  for (const k of Object.keys(after) as (keyof Progress)[]) {
    if (equal(before[k], after[k])) continue
    if (['cards', 'lectureRead', 'notes', 'mistakes', 'activity'].includes(k)) {
      const a = before[k] as Record<string, unknown>,
        b = after[k] as Record<string, unknown>
      for (const id of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (!equal(a[id], b[id]))
          changes.push({
            path: [k, id],
            before: a[id] ?? null,
            after: b[id] ?? null,
          })
    } else changes.push({ path: [k], before: before[k], after: after[k] })
  }
  return changes
}
export class ProgressConflict extends Error {
  constructor(public paths: string[]) {
    super('Progress changed on another device.')
  }
}
export function applyChanges(current: Progress, changes: Change[]): Progress {
  // A repeated finalization has already committed its history, activity and session clear.
  for (const field of ['exams', 'attempts'] as const) {
    const change = changes.find(
      (c) => c.path.length === 1 && c.path[0] === field,
    )
    if (change && Array.isArray(change.before) && Array.isArray(change.after)) {
      const before = new Set(change.before.map(identity)),
        existing = new Set(current[field].map(identity))
      const additions = change.after.filter((a) => !before.has(identity(a)))
      if (additions.length && additions.every((a) => existing.has(identity(a))))
        return current
    }
  }
  const next = structuredClone(current)
  const conflicts: string[] = []
  for (const c of changes) {
    const [field, id] = c.path
    if (
      !Object.hasOwn(next, field) ||
      (id &&
        !['cards', 'lectureRead', 'notes', 'mistakes', 'activity'].includes(
          field,
        )) ||
      c.path.length > 2 ||
      ['__proto__', 'constructor', 'prototype'].includes(id ?? '')
    )
      throw new InvalidProgress('Invalid progress path')
    const record = next as unknown as Record<string, unknown>
    const actual = id
      ? ((record[field] as Record<string, unknown>)[id] ?? null)
      : record[field]
    if (
      field === 'activity' &&
      id &&
      typeof c.after === 'number' &&
      (typeof c.before === 'number' || c.before === null) &&
      c.after >= Number(c.before)
    ) {
      ;(record[field] as Record<string, unknown>)[id] =
        Number(actual) + c.after - Number(c.before)
      continue
    }
    if (equal(actual, c.after)) continue
    if (
      (field === 'attempts' || field === 'exams') &&
      !id &&
      Array.isArray(c.after) &&
      Array.isArray(c.before)
    ) {
      const previous = new Set(c.before.map(identity))
      const incoming = new Set(c.after.map(identity))
      // Removing history is destructive and must match the current history exactly.
      if (
        [...previous].some((x) => !incoming.has(x)) &&
        !equal(actual, c.before)
      ) {
        conflicts.push(field)
        continue
      }
      if ([...previous].some((x) => !incoming.has(x))) record[field] = c.after
      else
        record[field] = Array.from(
          new Map(
            [...(actual as { id?: string; at: number }[]), ...c.after].map(
              (a) => [identity(a), a],
            ),
          ).values(),
        )
      continue
    }
    if (!equal(actual, c.before)) {
      conflicts.push(c.path.join('.'))
      continue
    }
    if (id) {
      if (c.after === null)
        delete (record[field] as Record<string, unknown>)[id]
      else (record[field] as Record<string, unknown>)[id] = c.after
    } else record[field] = c.after
  }
  if (conflicts.length) throw new ProgressConflict(conflicts)
  return normalizeProgress(next)
}
export function mergeImport(current: Progress, incoming: Progress): Progress {
  const next = { ...current }
  next.attempts = Array.from(
    new Map(
      [...current.attempts, ...incoming.attempts].map((a) => [identity(a), a]),
    ).values(),
  )
  next.exams = Array.from(
    new Map(
      [...current.exams, ...incoming.exams].map((a) => [identity(a), a]),
    ).values(),
  )
  for (const field of ['cards', 'lectureRead', 'notes', 'mistakes'] as const)
    Object.assign(next, { [field]: { ...current[field], ...incoming[field] } })
  next.activity = { ...current.activity }
  for (const [day, n] of Object.entries(incoming.activity))
    next.activity[day] = Math.max(next.activity[day] ?? 0, n)
  return normalizeProgress(next)
}
