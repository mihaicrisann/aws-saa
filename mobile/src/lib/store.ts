import { useSyncExternalStore } from 'react'
import Storage from 'expo-sqlite/kv-store'
import {
  emptyProgress,
  InvalidProgress,
  mergeImport,
  normalizeProgress,
  type ActiveDrill,
  type ActiveExam,
  type Progress,
} from './progress'

export type Store = Progress
export type Attempt = Store['attempts'][number]
export type Confidence = 'sure' | 'unsure' | 'guess'
export type CardState = Store['cards'][string]
export type ExamResult = Store['exams'][number]
export type MistakeMeta = Store['mistakes'][string]
export type { ActiveExam, ActiveDrill }

const KEY = 'saa.progress'
const WRITE_DELAY_MS = 150

const listeners = new Set<() => void>()
const publish = () => listeners.forEach((l) => l())

/** Hermes has no crypto.randomUUID, and ids only need to be unique on this device. */
let counter = 0
export const newId = () =>
  `${Date.now().toString(36)}-${(counter++).toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** False on the very first launch, which is when the system colour scheme seeds the theme. */
export let hadStoredProgress = false

const FIELDS = Object.keys(emptyProgress())

/**
 * The schema is strict, so a payload from another build — the web export, or a newer
 * version of this app — must have its unknown fields dropped rather than be rejected.
 */
export function parseProgress(raw: unknown): Progress {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new InvalidProgress('That is not a progress export.')
  return normalizeProgress(
    Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).filter(([k]) => FIELDS.includes(k)),
    ),
  )
}

function load(): Progress {
  try {
    const raw = Storage.getItemSync(KEY)
    if (!raw) return emptyProgress()
    hadStoredProgress = true
    return parseProgress(JSON.parse(raw))
  } catch {
    // Unreadable storage must not brick the app; the next write replaces it.
    return emptyProgress()
  }
}

let state = load()

let writeTimer: ReturnType<typeof setTimeout> | undefined
function persist() {
  if (writeTimer !== undefined) clearTimeout(writeTimer)
  writeTimer = setTimeout(() => {
    writeTimer = undefined
    try {
      Storage.setItemSync(KEY, JSON.stringify(state))
    } catch {}
  }, WRITE_DELAY_MS)
}

/** Flushes the debounced write immediately. Used on background and before export. */
export function flush() {
  if (writeTimer === undefined) return
  clearTimeout(writeTimer)
  writeTimer = undefined
  try {
    Storage.setItemSync(KEY, JSON.stringify(state))
  } catch {}
}

export function useStore<T>(selector: (s: Store) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => selector(state),
    () => selector(state),
  )
}

export const getStore = () => state

/** The sync engine registers here so the store never has to import it. */
type SyncHook = (before: Progress, after: Progress) => void
let syncHook: SyncHook | undefined
export const setSyncHook = (fn: SyncHook) => {
  syncHook = fn
}

export function update(fn: (s: Store) => Store) {
  const before = state
  const next = normalizeProgress(fn(state))
  state = next
  persist()
  publish()
  syncHook?.(before, next)
}

/** A state the server already knows about: written through, but never queued back to it. */
export function applyRemoteState(next: Progress) {
  state = normalizeProgress(next)
  persist()
  flush()
  publish()
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function bumpActivity(s: Store, n = 1): Store {
  const k = today()
  return { ...s, activity: { ...s.activity, [k]: (s.activity[k] ?? 0) + n } }
}

function addAttempt(s: Store, a: Attempt): Store {
  const attempt = { ...a, id: a.id ?? newId() }
  if (s.attempts.some((x) => x.id === attempt.id)) return s
  const next = bumpActivity({ ...s, attempts: [...s.attempts, attempt] })
  if (!a.correct || next.mistakes[a.qid])
    next.mistakes = {
      ...next.mistakes,
      [a.qid]: { ...next.mistakes[a.qid], resolved: a.correct },
    }
  return next
}

export const recordAttempt = (a: Attempt) => update((s) => addAttempt(s, a))

export function recordDrillAttempt(a: Attempt, active: ActiveDrill) {
  update((s) => ({ ...addAttempt(s, a), activeDrill: active }))
}

export function finishExam(attempts: Attempt[], result: ExamResult) {
  update((s) => {
    if (s.exams.some((e) => e.id === result.id)) return { ...s, activeExam: null }
    let next = s
    for (const a of attempts) next = addAttempt(next, a)
    return { ...next, exams: [...next.exams, result], activeExam: null }
  })
}

export const setActiveExam = (activeExam: ActiveExam | null) =>
  update((s) => ({ ...s, activeExam }))

export const setActiveDrill = (activeDrill: ActiveDrill | null) =>
  update((s) => ({ ...s, activeDrill }))

export const setCard = (id: string, c: CardState) =>
  update((s) => bumpActivity({ ...s, cards: { ...s.cards, [id]: c } }))

export const markLectureRead = (id: string) =>
  update((s) => ({ ...s, lectureRead: { ...s.lectureRead, [id]: Date.now() } }))

export const setDailyGoal = (dailyGoal: number) => update((s) => ({ ...s, dailyGoal }))

export const setNote = (id: string, text: string) =>
  update((s) => ({ ...s, notes: { ...s.notes, [id]: text } }))

export const setTheme = (theme: 'dark' | 'light') => {
  hadStoredProgress = true
  update((s) => ({ ...s, theme }))
}

export const resetProgress = () =>
  update((s) => ({ ...emptyProgress(), theme: s.theme, legacyMigrated: true }))

export const exportStore = () => JSON.stringify(state, null, 2)

/** Counts after a merge, so the screen can say what actually arrived. */
export interface ImportResult {
  attempts: number
  cards: number
  exams: number
  added: number
}

export function importStore(json: string): ImportResult {
  const incoming = parseProgress(JSON.parse(json))
  const before = state.attempts.length
  update((s) => mergeImport(s, incoming))
  return {
    attempts: state.attempts.length,
    cards: Object.keys(state.cards).length,
    exams: state.exams.length,
    added: state.attempts.length - before,
  }
}

export function studyStreak(activity: Record<string, number>) {
  let days = 0
  const d = new Date()
  if (!activity[today(d)]) d.setDate(d.getDate() - 1)
  while (activity[today(d)]) {
    days++
    d.setDate(d.getDate() - 1)
  }
  return days
}
