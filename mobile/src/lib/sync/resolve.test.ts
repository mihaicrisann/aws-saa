import { describe, expect, it } from 'vitest'
import { changesBetween, emptyProgress, normalizeProgress, type Progress } from '../progress'
import { latestStamp, resolveConflict } from './resolve'

const p = (over: Partial<Progress>): Progress => normalizeProgress({ ...emptyProgress(), ...over })

const attempt = (id: string, at = 1_000) => ({
  id,
  qid: `q-${id}`,
  domain: 'secure' as const,
  lecture: '02-iam',
  correct: true,
  chosen: [0],
  at,
  mode: 'drill' as const,
})

const queue = (before: Progress, after: Progress, revision = 3) => [
  { operationId: 'op-1', revision, changes: changesBetween(before, after) },
]

const meta = (over: Partial<Parameters<typeof resolveConflict>[3]> = {}) => ({
  lastLocalEditAt: 5_000,
  serverUpdatedAt: 1_000,
  revision: 3,
  operationId: 'op-new',
  ...over,
})

describe('resolveConflict', () => {
  it('adopts the server copy when nothing is queued', () => {
    const server = p({ dailyGoal: 200 })
    const result = resolveConflict(server, p({ dailyGoal: 300 }), [], meta())
    expect(result.state).toBe(server)
    expect(result.operation).toBeNull()
  })

  it('gives a collided key to this device when it edited last', () => {
    const base = p({ dailyGoal: 100 })
    const local = p({ dailyGoal: 300 })
    const server = p({ dailyGoal: 200 })
    const { state, operation } = resolveConflict(server, local, queue(base, local), meta())
    expect(state.dailyGoal).toBe(300)
    expect(operation?.revision).toBe(3)
    expect(operation?.changes).toContainEqual({ path: ['dailyGoal'], before: 200, after: 300 })
  })

  it('gives it to the server when the server changed last', () => {
    const base = p({ dailyGoal: 100 })
    const local = p({ dailyGoal: 300 })
    const server = p({ dailyGoal: 200 })
    const { state, operation } = resolveConflict(
      server,
      local,
      queue(base, local),
      meta({ lastLocalEditAt: 1_000, serverUpdatedAt: 5_000 }),
    )
    expect(state.dailyGoal).toBe(200)
    expect(operation).toBeNull()
  })

  it('falls back to the newest stamp in the data when the server sends no updatedAt', () => {
    const base = p({ dailyGoal: 100 })
    const local = p({ dailyGoal: 300 })
    const server = p({ dailyGoal: 200, attempts: [attempt('s1', 9_000)] })
    expect(latestStamp(server)).toBe(9_000)
    const { state } = resolveConflict(
      server,
      local,
      queue(base, local),
      meta({ serverUpdatedAt: undefined }),
    )
    expect(state.dailyGoal).toBe(200)
  })

  it('unions history in both directions and never drops an attempt', () => {
    const base = p({ attempts: [attempt('shared')] })
    const local = p({ attempts: [attempt('shared'), attempt('mine')] })
    const server = p({ attempts: [attempt('shared'), attempt('theirs')], exams: [] })
    const { state } = resolveConflict(server, local, queue(base, local), meta())
    expect(state.attempts.map((a) => a.id).sort()).toEqual(['mine', 'shared', 'theirs'])
  })

  it('keeps non-colliding keys from both sides', () => {
    const base = p({})
    const local = p({ notes: { '02-iam': 'roles over users' } })
    const server = p({ lectureRead: { '03-vpc': 7_000 } })
    const { state, operation } = resolveConflict(server, local, queue(base, local), meta())
    expect(state.notes['02-iam']).toBe('roles over users')
    expect(state.lectureRead['03-vpc']).toBe(7_000)
    expect(operation?.changes).toEqual([
      { path: ['notes', '02-iam'], before: null, after: 'roles over users' },
    ])
  })

  it('keeps a card the server has never seen, so a rollback cannot erase it', () => {
    const card = { ease: 2.5, interval: 4, due: 9_000, reps: 3, lapses: 0 }
    const base = p({ cards: { c1: card } })
    const local = p({ cards: { c1: card }, dailyGoal: 300 })
    const server = p({ dailyGoal: 200 })
    const { state } = resolveConflict(server, local, queue(base, local), meta())
    expect(state.cards.c1).toEqual(card)
    expect(state.dailyGoal).toBe(300)
  })

  it('still lets the server win a key it does know about', () => {
    const base = p({ notes: { '02-iam': 'old' } })
    const local = p({ notes: { '02-iam': 'mine' } })
    const server = p({ notes: { '02-iam': 'theirs' } })
    const { state } = resolveConflict(
      server,
      local,
      queue(base, local),
      meta({ lastLocalEditAt: 1_000, serverUpdatedAt: 5_000 }),
    )
    expect(state.notes['02-iam']).toBe('theirs')
  })

  it('takes the higher count per day for activity', () => {
    const base = p({ activity: { '2026-09-15': 2 } })
    const local = p({ activity: { '2026-09-15': 4 } })
    const server = p({ activity: { '2026-09-15': 9 } })
    const { state } = resolveConflict(server, local, queue(base, local), meta())
    expect(state.activity['2026-09-15']).toBeGreaterThanOrEqual(9)
  })
})
