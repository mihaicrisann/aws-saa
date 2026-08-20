import { useSyncExternalStore } from 'react'
import type { DomainId } from './content'

export interface Attempt {
  qid: string
  domain: DomainId
  lecture: string
  correct: boolean
  chosen: number[]
  at: number
  mode: 'drill' | 'exam'
  confidence?: Confidence
  seconds?: number
}

/** How sure the learner said they were before revealing. */
export type Confidence = 'sure' | 'unsure' | 'guess'

export interface CardState {
  ease: number
  interval: number // days
  due: number // epoch ms
  reps: number
  lapses: number
  lastGrade?: number
}

export interface ExamResult {
  at: number
  total: number
  correct: number
  seconds: number
  byDomain: Record<string, { total: number; correct: number }>
  wrongIds: string[]
}

export interface MistakeMeta {
  reason?: 'knowledge' | 'misread' | 'distractor' | 'guess'
  note?: string
  resolved?: boolean
}

export interface Store {
  attempts: Attempt[]
  cards: Record<string, CardState>
  lectureRead: Record<string, number>
  notes: Record<string, string>
  exams: ExamResult[]
  mistakes: Record<string, MistakeMeta>
  activity: Record<string, number> // YYYY-MM-DD -> items studied
  theme: 'dark' | 'light'
}

const KEY = 'saa.store.v1'

const empty: Store = {
  attempts: [],
  cards: {},
  lectureRead: {},
  notes: {},
  exams: [],
  mistakes: {},
  activity: {},
  theme: 'light',
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...empty }
    return { ...empty, ...(JSON.parse(raw) as Partial<Store>) }
  } catch {
    return { ...empty }
  }
}

let state: Store = typeof window === 'undefined' ? { ...empty } : load()
const listeners = new Set<() => void>()

function emit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* quota or private mode — keep working in memory */
  }
  listeners.forEach((l) => l())
  mirrorToDisk()
}

/* ─── disk mirror (dev server only) ────────────────────────────────────
   The Vite dev server exposes /api/progress and writes notes/progress.json,
   so progress survives a cleared browser and is readable by the skills. */
export type MirrorState = 'off' | 'synced' | 'saving' | 'error'
let mirror: MirrorState = 'off'
const mirrorListeners = new Set<() => void>()
const setMirror = (m: MirrorState) => {
  mirror = m
  mirrorListeners.forEach((l) => l())
}
export const useMirror = () =>
  useSyncExternalStore(
    (cb) => {
      mirrorListeners.add(cb)
      return () => mirrorListeners.delete(cb)
    },
    () => mirror,
    () => mirror,
  )

let mirrorTimer: ReturnType<typeof setTimeout> | undefined
function mirrorToDisk() {
  if (!import.meta.env.DEV) return
  clearTimeout(mirrorTimer)
  setMirror('saving')
  mirrorTimer = setTimeout(async () => {
    try {
      const r = await fetch('/api/progress', { method: 'PUT', body: JSON.stringify(state, null, 2) })
      setMirror(r.ok ? 'synced' : 'error')
    } catch {
      setMirror('error')
    }
  }, 800)
}

/** On boot: adopt the disk copy when this browser has nothing of its own. */
export async function restoreFromDisk() {
  if (!import.meta.env.DEV) return
  try {
    const r = await fetch('/api/progress')
    const disk = (await r.json()) as Partial<Store> | null
    if (!disk) return setMirror('synced')
    const localEmpty = state.attempts.length === 0 && Object.keys(state.cards).length === 0 && Object.keys(state.lectureRead).length === 0
    if (localEmpty && (disk.attempts?.length || Object.keys(disk.cards ?? {}).length || Object.keys(disk.lectureRead ?? {}).length)) {
      state = { ...empty, ...disk }
      emit()
      return
    }
    setMirror('synced')
  } catch {
    setMirror('error')
  }
}

export function update(fn: (s: Store) => Store) {
  state = fn(state)
  emit()
}

export function getStore() {
  return state
}

export function useStore<T>(selector: (s: Store) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => selector(state),
    () => selector(state),
  )
}

export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function bumpActivity(s: Store, n = 1): Store {
  const k = today()
  return { ...s, activity: { ...s.activity, [k]: (s.activity[k] ?? 0) + n } }
}

export function recordAttempt(a: Attempt) {
  update((s) => {
    const next = bumpActivity({ ...s, attempts: [...s.attempts, a].slice(-4000) })
    if (a.correct && next.mistakes[a.qid] && !next.mistakes[a.qid].resolved) {
      next.mistakes = { ...next.mistakes, [a.qid]: { ...next.mistakes[a.qid], resolved: true } }
    }
    if (!a.correct) {
      next.mistakes = { ...next.mistakes, [a.qid]: { ...(next.mistakes[a.qid] ?? {}), resolved: false } }
    }
    return next
  })
}

export function setMistakeMeta(qid: string, meta: MistakeMeta) {
  update((s) => ({ ...s, mistakes: { ...s.mistakes, [qid]: { ...(s.mistakes[qid] ?? {}), ...meta } } }))
}

export function clearMistake(qid: string) {
  update((s) => {
    const m = { ...s.mistakes }
    delete m[qid]
    return { ...s, mistakes: m }
  })
}

export function recordExam(r: ExamResult) {
  update((s) => bumpActivity({ ...s, exams: [...s.exams, r] }, 0))
}

export function setCard(id: string, c: CardState) {
  update((s) => bumpActivity({ ...s, cards: { ...s.cards, [id]: c } }))
}

export function markLectureRead(id: string) {
  update((s) => bumpActivity({ ...s, lectureRead: { ...s.lectureRead, [id]: Date.now() } }, 0))
}

export function setNote(id: string, text: string) {
  update((s) => ({ ...s, notes: { ...s.notes, [id]: text } }))
}

export function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function setTheme(theme: 'dark' | 'light') {
  applyTheme(theme)
  try {
    localStorage.setItem('saa.theme', theme)
  } catch {
    /* ignore */
  }
  update((s) => ({ ...s, theme }))
}

export function resetProgress() {
  state = { ...empty, theme: state.theme }
  emit()
}

export function exportStore() {
  return JSON.stringify(state, null, 2)
}

export function importStore(json: string) {
  const parsed = JSON.parse(json) as Partial<Store>
  state = { ...empty, ...parsed }
  emit()
}

/** Consecutive days ending today (or yesterday, so a day isn't lost mid-evening). */
export function studyStreak(activity: Record<string, number>) {
  let days = 0
  const d = new Date()
  if (!activity[today(d)]) d.setDate(d.getDate() - 1)
  for (;;) {
    if (!activity[today(d)]) break
    days++
    d.setDate(d.getDate() - 1)
  }
  return days
}
