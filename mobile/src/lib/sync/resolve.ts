import {
  applyChanges,
  changesBetween,
  identity,
  ProgressConflict,
  type Change,
  type Progress,
} from '../progress'
import type { Operation } from './api'

export interface ResolveMeta {
  /** When this device last touched its own copy. */
  lastLocalEditAt: number
  /** When the server copy last changed; absent on servers that predate the field. */
  serverUpdatedAt?: number
  /** The server's revision, which the replacement operation is written against. */
  revision: number
  operationId: string
}

export interface Resolution {
  state: Progress
  operation: Operation | null
}

/** The newest thing the server data can prove, for servers that do not send updatedAt. */
export function latestStamp(p: Progress) {
  let at = 0
  for (const a of p.attempts) at = Math.max(at, a.at)
  for (const e of p.exams) at = Math.max(at, e.at)
  for (const value of Object.values(p.lectureRead)) at = Math.max(at, value)
  return at
}

const union = <T extends { id?: string; at: number }>(a: T[], b: T[]) =>
  Array.from(new Map([...a, ...b].map((item) => [identity(item), item])).values())

const collides = (change: Change, paths: Set<string>) =>
  paths.has(change.path.join('.')) || paths.has(change.path[0])

/**
 * Latest wins, never interactive: rebase the queue onto the server copy, and settle the
 * handful of keys both sides changed by whichever side was touched last. History is
 * unioned either way — an attempt or a mock is never dropped to win an argument.
 */
export function resolveConflict(
  server: Progress,
  local: Progress,
  pending: Operation[],
  meta: ResolveMeta,
): Resolution {
  if (!pending.length) return { state: server, operation: null }

  let resolved = server
  const collided: Change[] = []
  for (const op of pending) {
    let changes = op.changes
    for (;;) {
      try {
        resolved = applyChanges(resolved, changes)
        break
      } catch (error) {
        if (!(error instanceof ProgressConflict)) throw error
        const paths = new Set(error.paths)
        const kept = changes.filter((c) => !collides(c, paths))
        if (kept.length === changes.length) throw error
        collided.push(...changes.filter((c) => collides(c, paths)))
        changes = kept
      }
    }
  }

  const localWins = meta.lastLocalEditAt > (meta.serverUpdatedAt ?? latestStamp(server))
  if (localWins && collided.length) {
    const next = structuredClone(resolved) as unknown as Record<string, unknown>
    for (const change of collided) {
      const [field, id] = change.path
      if (field === 'attempts' || field === 'exams') continue
      if (!id) next[field] = change.after
      else if (change.after === null) delete (next[field] as Record<string, unknown>)[id]
      else (next[field] as Record<string, unknown>)[id] = change.after
    }
    resolved = next as unknown as Progress
  }

  resolved = {
    ...resolved,
    attempts: union(union(server.attempts, local.attempts), resolved.attempts),
    exams: union(union(server.exams, local.exams), resolved.exams),
    activity: Object.fromEntries(
      [...new Set([...Object.keys(server.activity), ...Object.keys(local.activity), ...Object.keys(resolved.activity)])].map(
        (day) => [
          day,
          Math.max(server.activity[day] ?? 0, local.activity[day] ?? 0, resolved.activity[day] ?? 0),
        ],
      ),
    ),
  }

  // A server copy that has never seen a key is not asserting the key was deleted. A rollback,
  // a restore from backup or a fresh database must not take this phone's cards, notes and
  // lecture history down with it.
  for (const field of ['cards', 'lectureRead', 'notes', 'mistakes'] as const) {
    const kept = { ...(resolved[field] as Record<string, unknown>) }
    for (const [id, value] of Object.entries(local[field]))
      if (!(id in server[field]) && !(id in kept)) kept[id] = value
    resolved = { ...resolved, [field]: kept } as Progress
  }

  const changes = changesBetween(server, resolved)
  return {
    state: resolved,
    operation: changes.length
      ? { operationId: meta.operationId, revision: meta.revision, changes }
      : null,
  }
}
