import { useSyncExternalStore } from 'react'
import Storage from 'expo-sqlite/kv-store'
import {
  applyChanges,
  changesBetween,
  mergeImport,
  ProgressConflict,
  type Progress,
} from '../progress'
import { applyRemoteState, getStore, setSyncHook } from '../store'
import * as api from './api'
import { Conflict, HttpError, Offline, newUuid, type Operation, type Snapshot } from './api'
import { latestStamp, resolveConflict } from './resolve'

export { resolveConflict, latestStamp } from './resolve'
export type { Operation } from './api'

const KEY = 'saa.sync'
const DEBOUNCE_MS = 1_000
const MAX_RESOLVES = 3

export interface SyncMeta {
  userId: string
  email: string
  revision: number
  serverUpdatedAt: number
  lastLocalEditAt: number
  pending: Operation[]
  /** False until this device's local progress has been folded into the account. */
  merged: boolean
}

export type SyncState = 'off' | 'offline' | 'syncing' | 'synced' | 'error'

export interface SyncStatus {
  state: SyncState
  detail: string
  pendingCount: number
  lastSyncedAt: number
  email: string
  /** The session expired with work still queued; the same account has to sign in again. */
  needsSignIn: boolean
}

const blank = (): SyncMeta => ({
  userId: '',
  email: '',
  revision: 0,
  serverUpdatedAt: 0,
  lastLocalEditAt: 0,
  pending: [],
  merged: false,
})

function load(): SyncMeta {
  try {
    const raw = Storage.getItemSync(KEY)
    if (!raw) return blank()
    const value = JSON.parse(raw) as Partial<SyncMeta>
    if (!value || typeof value.userId !== 'string' || !Array.isArray(value.pending)) return blank()
    return { ...blank(), ...value, pending: value.pending as Operation[] }
  } catch {
    return blank()
  }
}

let meta = load()
let expired = false
let running: Promise<void> | null = null
let timer: ReturnType<typeof setTimeout> | undefined

const listeners = new Set<() => void>()
let snapshot: SyncStatus = {
  state: meta.userId ? 'synced' : 'off',
  detail: '',
  pendingCount: meta.pending.length,
  lastSyncedAt: 0,
  email: meta.email,
  needsSignIn: false,
}

function publish(state: SyncState = snapshot.state, detail = '', syncedNow = false) {
  snapshot = {
    state: meta.userId ? state : 'off',
    detail,
    pendingCount: meta.pending.length,
    lastSyncedAt: syncedNow ? Date.now() : snapshot.lastSyncedAt,
    email: meta.email,
    needsSignIn: expired,
  }
  listeners.forEach((l) => l())
}

function persist() {
  try {
    Storage.setItemSync(KEY, JSON.stringify(meta))
  } catch {}
}

export const getSyncMeta = (): SyncMeta => meta
export const getSyncStatus = () => snapshot

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => snapshot,
    () => snapshot,
  )
}

const stampOf = (s: Snapshot) => s.updatedAt ?? latestStamp(s.data)

/** Every local edit while signed in becomes one queued operation against the last known revision. */
function onLocalChange(before: Progress, after: Progress) {
  if (!meta.userId) return
  const changes = changesBetween(before, after)
  if (!changes.length) return
  meta.pending.push({ operationId: newUuid(), revision: meta.revision, changes })
  meta.lastLocalEditAt = Date.now()
  persist()
  publish('syncing')
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = undefined
    void flush()
  }, DEBOUNCE_MS)
}

setSyncHook(onLocalChange)

function failed(error: unknown) {
  if (error instanceof Offline) return publish('offline', error.message)
  if (error instanceof HttpError && error.status === 401) {
    expired = true
    void api.forgetToken()
    return publish(
      'error',
      meta.pending.length
        ? `Session expired. Sign in again to save ${meta.pending.length} change${meta.pending.length === 1 ? '' : 's'}.`
        : 'Session expired. Sign in again.',
    )
  }
  publish('error', error instanceof Error ? error.message : 'Sync failed.')
}

/** Rebase the queue onto the server copy and leave exactly one operation to push. */
function rebase(server: Snapshot) {
  const { state, operation } = resolveConflict(server.data, getStore(), meta.pending, {
    lastLocalEditAt: meta.lastLocalEditAt,
    serverUpdatedAt: server.updatedAt,
    revision: server.revision,
    operationId: newUuid(),
  })
  meta.revision = server.revision
  meta.serverUpdatedAt = stampOf(server)
  meta.pending = operation ? [operation] : []
  applyRemoteState(state)
  persist()
  publish('syncing')
}

export function flush(): Promise<void> {
  if (running) return running
  running = push().finally(() => {
    running = null
  })
  return running
}

async function push() {
  if (!meta.userId || expired) return
  if (!meta.pending.length) return publish('synced', '', true)
  publish('syncing')
  let resolves = 0
  while (meta.pending.length) {
    try {
      const server = await api.saveProgress(meta.pending[0])
      meta.revision = server.revision
      meta.serverUpdatedAt = stampOf(server)
      meta.pending.shift()
      let rebased = server.data
      try {
        for (const queued of meta.pending) rebased = applyChanges(rebased, queued.changes)
      } catch (error) {
        if (!(error instanceof ProgressConflict)) throw error
        if (++resolves > MAX_RESOLVES) return publish('error', 'Could not reconcile with the server.')
        rebase(server)
        continue
      }
      applyRemoteState(rebased)
      persist()
    } catch (error) {
      if (error instanceof Conflict) {
        if (++resolves > MAX_RESOLVES) return publish('error', 'Could not reconcile with the server.')
        rebase(error.snapshot)
        continue
      }
      persist()
      return failed(error)
    }
  }
  publish('synced', '', true)
}

/** Fold whatever is on this device into the account, then push the difference. */
async function adopt() {
  const server = await api.readProgress()
  const merged = mergeImport(server.data, getStore())
  const changes = changesBetween(server.data, merged)
  meta.revision = server.revision
  meta.serverUpdatedAt = stampOf(server)
  meta.merged = true
  meta.pending = changes.length ? [{ operationId: newUuid(), revision: server.revision, changes }] : []
  applyRemoteState(merged)
  persist()
  await flush()
}

export async function pull(): Promise<void> {
  if (!meta.userId || expired) return
  try {
    if (!meta.merged) return await adopt()
    const server = await api.readProgress()
    if (meta.pending.length) {
      if (server.revision === meta.revision) return
      rebase(server)
      await flush()
      return
    }
    if (server.revision > meta.revision) {
      meta.revision = server.revision
      meta.serverUpdatedAt = stampOf(server)
      applyRemoteState(server.data)
      persist()
    }
    publish('synced', '', true)
  } catch (error) {
    failed(error)
  }
}

/** The one trigger everything else calls: push what is queued, then take what is new. */
export async function sync() {
  await flush()
  await pull()
}

export async function signIn(email: string, password: string) {
  const account = await api.signIn(email.trim(), password)
  expired = false
  if (meta.userId === account.id && meta.merged) {
    meta.email = account.email
    persist()
    publish('syncing')
    await sync()
    return account
  }
  meta = { ...blank(), userId: account.id, email: account.email, lastLocalEditAt: Date.now() }
  persist()
  publish('syncing')
  await adopt()
  return account
}

/**
 * Signing out keeps the progress on the phone — it is his data on his device — and only
 * refuses while there is queued work the server has not seen.
 */
export async function signOut({ force = false } = {}): Promise<{ unsaved: number }> {
  if (meta.pending.length && !expired) await flush()
  if (meta.pending.length && !force) return { unsaved: meta.pending.length }
  await api.signOut()
  meta = blank()
  expired = false
  persist()
  publish('off')
  return { unsaved: 0 }
}

/** Test seam: drops every in-memory trace of a session without touching the store. */
export function resetSyncForTests() {
  meta = blank()
  expired = false
  running = null
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
  persist()
  publish('off')
}

export async function restoreSession() {
  await api.loadToken()
  if (!meta.userId) return
  if (!api.currentToken()) {
    expired = true
    publish('error', meta.pending.length ? `Sign in again to save ${meta.pending.length} pending changes.` : 'Sign in again.')
    return
  }
  publish('syncing')
  await sync()
}
