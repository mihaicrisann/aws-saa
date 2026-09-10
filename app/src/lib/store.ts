'use client'
import { useSyncExternalStore } from 'react'
import {
  applyChanges,
  changesBetween,
  emptyProgress,
  mergeImport,
  normalizeProgress,
  ProgressConflict,
  type Progress,
  type ActiveExam,
  type ActiveDrill,
  type Change,
  identity,
} from './progress'
export type Store = Progress
export type Attempt = Store['attempts'][number]
export type Confidence = 'sure' | 'unsure' | 'guess'
export type CardState = Store['cards'][string]
export type ExamResult = Store['exams'][number]
export type MistakeMeta = Store['mistakes'][string]
export type { ActiveExam, ActiveDrill }
let state = emptyProgress(),
  server = emptyProgress(),
  revision = 0,
  userId = '',
  // Bumped by every sign-in and sign-out so late responses cannot write into a new session.
  epoch = 0
const listeners = new Set<() => void>(),
  mirrorListeners = new Set<() => void>()
export type MirrorState = 'off' | 'synced' | 'saving' | 'error' | 'conflict'
let mirror: MirrorState = 'off',
  message = '',
  running = false,
  ready = false
interface Operation {
  operationId: string
  revision: number
  changes: Change[]
}
let pending: Operation[] = []
let hydration: Promise<void> | undefined,
  hydratingUser = ''
const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const publish = () => listeners.forEach((l) => l())
function setMirror(value: MirrorState, detail = '') {
  mirror = value
  message = detail
  mirrorListeners.forEach((l) => l())
}
export const useMirror = () =>
  useSyncExternalStore(
    (cb) => {
      mirrorListeners.add(cb)
      return () => {
        mirrorListeners.delete(cb)
      }
    },
    () => mirror,
    () => 'off' as MirrorState,
  )
export const useSyncMessage = () =>
  useSyncExternalStore(
    (cb) => {
      mirrorListeners.add(cb)
      return () => {
        mirrorListeners.delete(cb)
      }
    },
    () => message,
    () => '',
  )
const JOURNAL_PREFIX = 'saa.pending.v3.'
const TAB_KEY = 'saa.tab.v1'
const HEARTBEAT_MS = 5_000
// A journal without a heartbeat for this long is orphaned. It sits well above the one
// minute browsers clamp timers to in a hidden tab, so a background tab is never robbed.
const ORPHAN_AFTER_MS = 90_000
interface Journal {
  userId: string
  tabId: string
  heartbeat: number
  pending: Operation[]
  state: Progress
}
let tab = ''
function tabId() {
  if (tab) return tab
  try {
    tab = sessionStorage.getItem(TAB_KEY) ?? ''
    if (!tab) {
      tab = crypto.randomUUID()
      sessionStorage.setItem(TAB_KEY, tab)
    }
  } catch {
    tab = crypto.randomUUID()
  }
  return tab
}
const journalKey = (id = userId) => `${JOURNAL_PREFIX}${id}.${tabId()}`
let heartbeat: ReturnType<typeof setInterval> | undefined
function stopHeartbeat() {
  if (heartbeat !== undefined) clearInterval(heartbeat)
  heartbeat = undefined
}
function writeJournal(at: number) {
  const journal: Journal = {
    userId,
    tabId: tabId(),
    heartbeat: at,
    pending,
    state,
  }
  localStorage.setItem(journalKey(), JSON.stringify(journal))
}
function persistRecovery() {
  if (!userId) return
  try {
    if (pending.length) {
      writeJournal(Date.now())
      if (heartbeat === undefined && typeof window !== 'undefined')
        heartbeat = setInterval(() => {
          if (!pending.length || !userId) return stopHeartbeat()
          try {
            writeJournal(Date.now())
          } catch {}
        }, HEARTBEAT_MS)
    } else {
      localStorage.removeItem(journalKey())
      stopHeartbeat()
    }
  } catch {
    if (pending.length)
      message =
        'Browser recovery storage is unavailable. Keep this tab open until saved.'
  }
}
function readJournal(key: string): Journal | null {
  const raw = readLocal(key)
  if (!raw) return null
  const journal = JSON.parse(raw) as Journal
  if (
    !journal ||
    !Array.isArray(journal.pending) ||
    journal.pending.some((p) => !p.operationId || !Array.isArray(p.changes))
  )
    throw new Error('Invalid recovery')
  return journal
}
// localStorage has no compare-and-set, so a claim is a lock plus a re-read of the journal.
async function withLock<T>(name: string, run: () => T): Promise<T | undefined> {
  const locks = globalThis.navigator?.locks
  if (locks) return locks.request(name, run)
  const key = `saa.lock.${name}`
  const token = `${tabId()}:${crypto.randomUUID()}`
  try {
    const held = JSON.parse(readLocal(key) ?? 'null')
    if (held && Date.now() - held.at < 5_000) return undefined
    localStorage.setItem(key, JSON.stringify({ token, at: Date.now() }))
    await Promise.resolve()
    if (JSON.parse(readLocal(key) ?? 'null')?.token !== token) return undefined
    return run()
  } catch {
    return undefined
  } finally {
    try {
      if (JSON.parse(readLocal(key) ?? 'null')?.token === token)
        localStorage.removeItem(key)
    } catch {}
  }
}
function orphanKeys(id: string) {
  const mine = journalKey(id)
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key !== mine && key.startsWith(`${JOURNAL_PREFIX}${id}.`))
        keys.push(key)
    }
  } catch {}
  return keys
}
// Adopts queued work left by a tab of the same account that is no longer writing heartbeats.
async function adoptOrphans(id: string, session: number) {
  for (const key of orphanKeys(id)) {
    const claimed = await withLock(`saa.adopt.${key}`, () => {
      let journal: Journal | null = null
      try {
        journal = readJournal(key)
      } catch {
        localStorage.removeItem(key)
        return null
      }
      if (!journal || journal.userId !== id) return null
      if (Date.now() - journal.heartbeat < ORPHAN_AFTER_MS) return null
      localStorage.removeItem(key)
      return journal
    })
    if (epoch !== session) return
    if (!claimed) continue
    const known = new Set(pending.map((op) => op.operationId))
    for (const op of claimed.pending) {
      if (known.has(op.operationId)) continue
      pending.push(op)
      try {
        state = applyChanges(state, op.changes)
      } catch (error) {
        // Leave the operation queued: the server decides a conflict it cannot see locally.
        if (!(error instanceof ProgressConflict)) throw error
      }
    }
    persistRecovery()
    publish()
  }
}
async function readBody(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
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
export class SessionChanged extends Error {
  name = 'SessionChanged'
  constructor() {
    super('The account changed before progress finished loading.')
  }
}
export function restoreFromDisk(id: string, skipLegacy = false) {
  if (hydration && hydratingUser === id) return hydration
  const session = ++epoch
  hydratingUser = id
  hydration = hydrate(id, skipLegacy, session).finally(() => {
    if (epoch === session) hydration = undefined
  })
  return hydration
}
async function hydrate(id: string, skipLegacy: boolean, session: number) {
  userId = id
  ready = false
  running = false
  pending = []
  stopHeartbeat()
  setMirror('saving')
  const response = await fetch('/api/progress', { cache: 'no-store' })
  if (epoch !== session) throw new SessionChanged()
  if (!response.ok)
    throw new Error(
      'Unable to load saved progress. Retry when the server is available.',
    )
  const snapshot = await readBody(response)
  if (epoch !== session) throw new SessionChanged()
  if (!snapshot?.data)
    throw new Error(
      'Saved progress could not be read. Retry when the server is available.',
    )
  server = normalizeProgress(snapshot.data)
  revision = snapshot.revision
  state = server
  try {
    const recovered = readJournal(journalKey(id))
    if (recovered) {
      state = normalizeProgress(recovered.state)
      pending = recovered.pending
    }
  } catch {
    throw new Error(
      'Local recovery data could not be read. Export the browser data before clearing it.',
    )
  }
  await adoptOrphans(id, session)
  if (epoch !== session) throw new SessionChanged()
  ready = true
  publish()
  if (!pending.length && !state.legacyMigrated) {
    const raw = skipLegacy ? null : readLocal('saa.store.v1')
    let imported = raw ? normalizeProgress(JSON.parse(raw)) : emptyProgress()
    const active = skipLegacy ? null : readLocal('saa.exam.active.v1')
    if (active) {
      const exam = JSON.parse(active)
      imported = {
        ...imported,
        activeExam: { ...exam, id: exam.id ?? `legacy-exam-${exam.startedAt}` },
      }
      imported = normalizeProgress(imported)
    }
    update((s) => ({
      ...mergeImport(s, imported),
      activeExam: s.activeExam ?? imported.activeExam,
      legacyMigrated: true,
    }))
  }
  if (pending.length) void flushProgress()
  else setMirror('synced')
  applyTheme(state.theme)
}
export function update(fn: (s: Store) => Store) {
  if (!ready) throw new Error('Progress is still loading.')
  const next = normalizeProgress(fn(state)),
    changes = changesBetween(state, next)
  if (!changes.length) return
  pending.push({ operationId: crypto.randomUUID(), revision, changes })
  state = next
  persistRecovery()
  publish()
  if (mirror !== 'conflict') {
    setMirror('saving')
    void flushProgress()
  }
}
export async function flushProgress() {
  if (running || !ready || !userId || mirror === 'conflict') return
  running = true
  const session = epoch
  try {
    while (pending.length) {
      const op = pending[0]
      setMirror('saving')
      const response = await fetch('/api/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      })
      if (epoch !== session) return
      const snapshot = await readBody(response)
      if (epoch !== session) return
      if (response.status === 409) {
        if (snapshot?.data) {
          server = normalizeProgress(snapshot.data)
          revision = snapshot.revision
        }
        const paths = Array.isArray(snapshot?.paths) ? snapshot.paths : []
        setMirror(
          'conflict',
          `Saved progress changed elsewhere${paths.length ? ` (${paths.join(', ')})` : ''}. Choose which changes to keep.`,
        )
        return
      }
      if (!response.ok)
        throw new Error(snapshot?.error ?? 'Unable to save progress.')
      if (!snapshot?.data)
        throw new Error('The server sent an unreadable reply. Retry the save.')
      server = normalizeProgress(snapshot.data)
      revision = snapshot.revision
      pending.shift()
      let rebased = server
      try {
        for (const queued of pending)
          rebased = applyChanges(rebased, queued.changes)
      } catch (error) {
        if (error instanceof ProgressConflict) {
          setMirror(
            'conflict',
            'Another device changed the same progress. Choose which changes to keep.',
          )
          persistRecovery()
          return
        }
        throw error
      }
      state = rebased
      persistRecovery()
      publish()
    }
    setMirror('synced')
  } catch (error) {
    if (epoch !== session) return
    setMirror(
      'error',
      error instanceof Error
        ? error.message
        : 'Save failed. Your changes remain on this device.',
    )
    persistRecovery()
  } finally {
    if (epoch === session) running = false
  }
}
export function resolveConflict(keepLocal: boolean) {
  if (keepLocal) {
    // Rebase only the requested fields, preserving unrelated server changes.
    let target = structuredClone(server)
    for (const op of pending)
      for (const change of op.changes) {
        const [field, id] = change.path
        const root = target as unknown as Record<string, unknown>
        if (field === 'attempts' || field === 'exams') {
          const local = state[field]
          root[field] = local
          continue
        }
        if (id) {
          const values = root[field] as Record<string, unknown>
          if (change.after === null) delete values[id]
          else values[id] = change.after
        } else root[field] = change.after
      }
    // Union history: keeping this device must not erase another device's attempts.
    target.attempts = Array.from(
      new Map(
        [...server.attempts, ...target.attempts].map((a) => [identity(a), a]),
      ).values(),
    )
    target.exams = Array.from(
      new Map(
        [...server.exams, ...target.exams].map((a) => [identity(a), a]),
      ).values(),
    )
    pending = []
    state = server
    persistRecovery()
    setMirror('synced')
    update(() => target)
  } else {
    pending = []
    state = server
    persistRecovery()
    publish()
    setMirror('synced')
  }
}
// Signing out cannot flush what is still queued, so the journal is kept for the same
// account to adopt at the next sign-in and the count is returned for the caller to surface.
// With nothing queued the journal is removed rather than left behind for a signed-out user.
export function clearSession() {
  const unsaved = pending.length
  const recovery = unsaved ? exportStore() : null
  try {
    if (userId && unsaved) writeJournal(0)
    else if (userId) localStorage.removeItem(journalKey())
  } catch {}
  epoch++
  stopHeartbeat()
  ready = false
  running = false
  hydration = undefined
  hydratingUser = ''
  state = emptyProgress()
  server = state
  pending = []
  revision = 0
  userId = ''
  publish()
  setMirror('off')
  return { unsaved, recovery }
}
export const today = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function bumpActivity(s: Store, n = 1): Store {
  const k = today()
  return { ...s, activity: { ...s.activity, [k]: (s.activity[k] ?? 0) + n } }
}
function addAttempt(s: Store, a: Attempt): Store {
  const attempt = { ...a, id: a.id ?? crypto.randomUUID() }
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
    if (s.exams.some((e) => e.id === result.id))
      return { ...s, activeExam: null }
    let next = s
    for (const a of attempts) next = addAttempt(next, a)
    return { ...next, exams: [...next.exams, result], activeExam: null }
  })
}
export const setActiveExam = (activeExam: ActiveExam | null) =>
  update((s) => ({ ...s, activeExam }))
export const setActiveDrill = (activeDrill: ActiveDrill | null) =>
  update((s) => ({ ...s, activeDrill }))
export const setMistakeMeta = (qid: string, meta: MistakeMeta) =>
  update((s) => ({
    ...s,
    mistakes: { ...s.mistakes, [qid]: { ...s.mistakes[qid], ...meta } },
  }))
export const clearMistake = (qid: string) =>
  update((s) => {
    const mistakes = { ...s.mistakes }
    delete mistakes[qid]
    return { ...s, mistakes }
  })
export const recordExam = (r: ExamResult) =>
  update((s) => ({
    ...s,
    exams: [...s.exams, { ...r, id: r.id ?? crypto.randomUUID() }],
  }))
export const setCard = (id: string, c: CardState) =>
  update((s) => bumpActivity({ ...s, cards: { ...s.cards, [id]: c } }))
export const markLectureRead = (id: string) =>
  update((s) => ({ ...s, lectureRead: { ...s.lectureRead, [id]: Date.now() } }))
export const setNote = (id: string, text: string) =>
  update((s) => ({ ...s, notes: { ...s.notes, [id]: text } }))
export function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}
export function setTheme(theme: 'dark' | 'light') {
  applyTheme(theme)
  try {
    localStorage.setItem('saa.theme', theme)
  } catch {}
  update((s) => ({ ...s, theme }))
}
export const resetProgress = () =>
  update((s) => ({ ...emptyProgress(), theme: s.theme, legacyMigrated: true }))
export const exportStore = () => JSON.stringify(state, null, 2)
export function importStore(json: string) {
  const incoming = normalizeProgress(JSON.parse(json))
  update((s) => mergeImport(s, incoming))
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
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushProgress()
  })
  window.addEventListener('beforeunload', (e) => {
    if (pending.length) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
  // Refresh when returning to the app, but never replace pending local changes.
  window.addEventListener('focus', () => {
    if (!ready || pending.length || running) return
    const session = epoch
    void fetch('/api/progress', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok || epoch !== session) return
        const value = await readBody(r)
        if (epoch !== session || pending.length || running || !value?.data)
          return
        server = normalizeProgress(value.data)
        revision = value.revision
        state = server
        publish()
      })
      .catch(() => {})
  })
}
