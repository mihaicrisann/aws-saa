import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  emptyProgress,
  normalizeProgress,
  changesBetween,
  applyChanges,
  mergeImport,
  ProgressConflict,
  bankOf,
  bankVersionOf,
  identity,
  type Progress,
} from './progress'
const attempt = {
  id: 'attempt-1',
  qid: 'q1',
  domain: 'secure' as const,
  lecture: '02-iam',
  correct: true,
  chosen: [0],
  at: 100,
  mode: 'drill' as const,
}
describe('durable progress merging', () => {
  it('merges independent changes from stale devices', () => {
    const base = emptyProgress()
    const left = { ...base, notes: { one: 'first' } }
    const right = { ...base, notes: { two: 'second' } }
    expect(applyChanges(left, changesBetween(base, right)).notes).toEqual({
      one: 'first',
      two: 'second',
    })
  })
  it('compares JSONB objects independently of PostgreSQL key ordering', () => {
    const base = {
      ...emptyProgress(),
      activeExam: {
        id: 'exam',
        ids: ['q1', 'q2'],
        answers: { q2: [1], q1: [0] },
        flags: [],
        startedAt: 0,
        minutes: 10,
      },
    }
    const stored = {
      ...base,
      activeExam: { ...base.activeExam, answers: { q1: [0], q2: [1] } },
    }
    const next = { ...base, activeExam: { ...base.activeExam, index: 1 } }
    expect(
      applyChanges(stored, changesBetween(base, next)).activeExam?.index,
    ).toBe(1)
  })
  it('rejects same-note races instead of silently overwriting', () => {
    const base = emptyProgress()
    expect(() =>
      applyChanges(
        { ...base, notes: { one: 'remote' } },
        changesBetween(base, { ...base, notes: { one: 'local' } }),
      ),
    ).toThrow(ProgressConflict)
  })
  it('adds concurrent activity increments even if their resulting counts match', () => {
    const base = emptyProgress()
    const next = { ...base, activity: { '2026-09-10': 1 } }
    expect(
      applyChanges(next, changesBetween(base, next)).activity['2026-09-10'],
    ).toBe(2)
  })
  it('deduplicates retrying a completed attempt including activity and session changes', () => {
    const base = emptyProgress()
    const next = { ...base, attempts: [attempt], activity: { day: 1 } }
    expect(applyChanges(next, changesBetween(base, next))).toEqual(next)
  })
  it('keeps independent attempts and their activity', () => {
    const base = emptyProgress()
    const left = { ...base, attempts: [attempt], activity: { day: 1 } }
    const right = {
      ...base,
      attempts: [{ ...attempt, id: 'attempt-2' }],
      activity: { day: 1 },
    }
    const merged = applyChanges(left, changesBetween(base, right))
    expect(merged.attempts).toHaveLength(2)
    expect(merged.activity.day).toBe(2)
  })
  it('preserves notes/cards/history when importing a partial legacy export', () => {
    const current = {
      ...emptyProgress(),
      notes: { existing: 'keep' },
      attempts: [attempt],
    }
    const imported = normalizeProgress({
      notes: { incoming: 'new' },
      cards: { card: { ease: 2.5, interval: 2, due: 100, reps: 1, lapses: 0 } },
    })
    const merged = mergeImport(current, imported)
    expect(merged.notes).toEqual({ existing: 'keep', incoming: 'new' })
    expect(merged.cards.card.reps).toBe(1)
    expect(merged.attempts).toHaveLength(1)
  })
  it('assigns stable bounded legacy IDs, so repeat imports cannot duplicate history', () => {
    const legacy = { ...attempt, id: undefined }
    const imported = normalizeProgress({ attempts: [legacy] })
    expect(imported.attempts[0].id!.length).toBeLessThan(250)
    expect(
      mergeImport(imported, normalizeProgress({ attempts: [legacy] })).attempts,
    ).toHaveLength(1)
  })
  it('rejects corrupt imports and prototype keys', () => {
    expect(() => normalizeProgress({ attempts: 'wrong' })).toThrow()
    expect(() =>
      normalizeProgress({ notes: JSON.parse('{"__proto__":"bad"}') }),
    ).toThrow()
  })
  it('does not partially apply an atomic exam finalization when its session conflicts', () => {
    const base = emptyProgress()
    const other = {
      ...base,
      activeExam: {
        id: 'other',
        ids: ['q'],
        answers: {},
        flags: [],
        startedAt: 0,
        minutes: 10,
      },
    }
    const change = changesBetween(
      { ...base, activeExam: { ...other.activeExam, id: 'first' } },
      { ...base, attempts: [attempt] },
    )
    expect(() => applyChanges(other, change)).toThrow(ProgressConflict)
    expect(other.attempts).toEqual([])
  })
})

describe('question bank metadata', () => {
  it('reads untagged history as the original bank', () => {
    const stored = normalizeProgress({
      attempts: [attempt],
      exams: [
        {
          id: 'exam-1',
          at: 1,
          total: 10,
          correct: 8,
          seconds: 100,
          byDomain: {},
          wrongIds: [],
        },
      ],
    })
    expect(stored.attempts[0].bank).toBeUndefined()
    expect(bankOf(stored.attempts[0])).toBe('original')
    expect(bankVersionOf(stored.attempts[0])).toBe(0)
    expect(bankOf(stored.exams[0])).toBe('original')
  })
  it('keeps tagged attempts, exams and sessions through a round trip', () => {
    const tagged = normalizeProgress({
      attempts: [{ ...attempt, id: 'v2-attempt', bank: 'v2', bankVersion: 2 }],
      exams: [
        {
          id: 'v2-exam',
          at: 1,
          total: 10,
          correct: 8,
          seconds: 100,
          byDomain: {},
          wrongIds: [],
          bank: 'v2',
          bankVersion: 2,
        },
      ],
      activeDrill: {
        id: 'drill',
        ids: ['v2-001'],
        index: 0,
        chosen: [],
        revealed: false,
        shownAt: 0,
        log: [],
        domain: 'all',
        lecture: 'all',
        count: 10,
        unseen: false,
        bank: 'v2',
        bankVersion: 2,
      },
      activeExam: {
        id: 'exam',
        ids: ['v2-001'],
        answers: {},
        flags: [],
        startedAt: 0,
        minutes: 10,
        bank: 'v2',
        bankVersion: 2,
      },
    })
    expect(bankOf(tagged.attempts[0])).toBe('v2')
    expect(bankVersionOf(tagged.exams[0])).toBe(2)
    expect(tagged.activeDrill?.bank).toBe('v2')
    expect(tagged.activeExam?.bank).toBe('v2')
  })
  it('does not renumber pre-tag legacy history when a bank tag is added', () => {
    const legacy = { ...attempt, id: undefined }
    // Frozen: the id the pre-bank-tag algorithm assigned to this record.
    expect(identity(legacy)).toBe('legacy:100:536716e0c61b1ffe')
    expect(identity({ ...legacy, bank: 'v2' as const, bankVersion: 3 })).toBe(
      identity(legacy),
    )
  })
  it('does not resurrect duplicates when tagged history is re-imported', () => {
    const legacy = normalizeProgress({ attempts: [{ ...attempt, id: undefined }] })
    const tagged = normalizeProgress({
      attempts: [{ ...attempt, id: undefined, bank: 'original', bankVersion: 1 }],
    })
    expect(tagged.attempts[0].id).toBe(legacy.attempts[0].id)
    expect(mergeImport(legacy, tagged).attempts).toHaveLength(1)
    expect(
      applyChanges(legacy, changesBetween(emptyProgress(), tagged)).attempts,
    ).toHaveLength(1)
  })
  it('merges a hard-bank attempt alongside existing original history', () => {
    const base = normalizeProgress({ attempts: [attempt] })
    const next = {
      ...base,
      attempts: [
        ...base.attempts,
        { ...attempt, id: 'v2-1', qid: 'v2-001', bank: 'v2' as const, bankVersion: 1 },
      ],
    }
    const merged = applyChanges(base, changesBetween(base, next))
    expect(merged.attempts).toHaveLength(2)
    expect(merged.attempts.filter((a) => bankOf(a) === 'original')).toHaveLength(1)
    expect(merged.attempts.filter((a) => bankOf(a) === 'v2')).toHaveLength(1)
  })
})

class FakeStorage {
  private items = new Map<string, string>()
  get length() {
    return this.items.size
  }
  key(index: number) {
    return [...this.items.keys()][index] ?? null
  }
  getItem(name: string) {
    return this.items.get(name) ?? null
  }
  setItem(name: string, value: string) {
    this.items.set(name, String(value))
  }
  removeItem(name: string) {
    this.items.delete(name)
  }
  clear() {
    this.items.clear()
  }
}
const deferred = () => {
  let resolve = () => {}
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
const tick = () => new Promise((r) => setTimeout(r, 0))
const settle = async () => {
  for (let i = 0; i < 5; i++) await tick()
}
// Mimics /api/progress: one row per account, operation-id replay, field-level conflicts.
function fakeBackend() {
  const rows = new Map<
    string,
    { revision: number; data: Progress; seen: Set<string> }
  >()
  const row = (account: string) => {
    const existing = rows.get(account) ?? {
      revision: 0,
      data: emptyProgress(),
      seen: new Set<string>(),
    }
    rows.set(account, existing)
    return existing
  }
  const state = {
    account: 'user-1',
    offline: false,
    gate: null as Promise<void> | null,
    saves: [] as string[],
    row: (account?: string) => row(account ?? state.account),
  }
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status })
  const fetchImpl = async (_url: string, init?: RequestInit) => {
    const target = state.row()
    if (init?.method !== 'PUT')
      return reply(200, { revision: target.revision, data: target.data })
    const operation = JSON.parse(String(init.body))
    // `gate` holds the next save only, so a test can strand one request in flight.
    const gate = state.gate
    state.gate = null
    if (gate) await gate
    state.saves.push(operation.operationId)
    if (state.offline) throw new TypeError('Failed to fetch')
    if (target.seen.has(operation.operationId))
      return reply(200, { revision: target.revision, data: target.data })
    if (operation.revision > target.revision)
      return reply(409, {
        error: 'stale',
        paths: ['revision'],
        revision: target.revision,
        data: target.data,
      })
    try {
      target.data = applyChanges(target.data, operation.changes)
    } catch (error) {
      if (!(error instanceof ProgressConflict)) throw error
      return reply(409, {
        error: error.message,
        paths: error.paths,
        revision: target.revision,
        data: target.data,
      })
    }
    target.seen.add(operation.operationId)
    target.revision += 1
    return reply(200, { revision: target.revision, data: target.data })
  }
  return { state, fetchImpl }
}
describe('multi-tab recovery journals and session fencing', () => {
  let disk: FakeStorage
  let backend: ReturnType<typeof fakeBackend>
  const tabs = new Map<string, FakeStorage>()
  const openTab = (name: string) => {
    const session = tabs.get(name) ?? new FakeStorage()
    tabs.set(name, session)
    Object.assign(globalThis, { sessionStorage: session })
    vi.resetModules()
    return import('./store')
  }
  const journals = (account: string) =>
    Array.from({ length: disk.length }, (_, i) => disk.key(i)!).filter((key) =>
      key.startsWith(`saa.pending.v3.${account}.`),
    )
  const readJournal = (key: string) => JSON.parse(disk.getItem(key)!)
  const killTab = (key: string) =>
    disk.setItem(key, JSON.stringify({ ...readJournal(key), heartbeat: 0 }))
  beforeEach(() => {
    disk = new FakeStorage()
    tabs.clear()
    backend = fakeBackend()
    Object.assign(globalThis, {
      localStorage: disk,
      fetch: backend.fetchImpl,
      document: { documentElement: { classList: { toggle: () => {} } } },
    })
  })
  it('keeps one journal per tab so two tabs never clobber each other', async () => {
    const a = await openTab('a')
    await a.restoreFromDisk('user-1', true)
    backend.state.offline = true
    a.setNote('shared', 'from a')
    await settle()
    expect(journals('user-1')).toHaveLength(1)
    const b = await openTab('b')
    await b.restoreFromDisk('user-1', true)
    // The other tab is still writing heartbeats, so its queue stays its own.
    expect(b.getStore().notes.shared).toBeUndefined()
    b.setNote('other', 'from b')
    await settle()
    expect(journals('user-1')).toHaveLength(2)
    expect(readJournal(journals('user-1')[0]).tabId).not.toBe(
      readJournal(journals('user-1')[1]).tabId,
    )
  })
  it('adopts the queue of a tab that stopped writing heartbeats', async () => {
    const a = await openTab('a')
    await a.restoreFromDisk('user-1', true)
    backend.state.offline = true
    a.setNote('shared', 'from a')
    await settle()
    const [dead] = journals('user-1')
    killTab(dead)
    backend.state.offline = false
    const c = await openTab('c')
    await c.restoreFromDisk('user-1', true)
    await vi.waitFor(() =>
      expect(backend.state.row('user-1').data.notes.shared).toBe('from a'),
    )
    expect(c.getStore().notes.shared).toBe('from a')
    expect(journals('user-1')).toHaveLength(0)
  })
  it('lets only one tab adopt an orphaned journal', async () => {
    const b = await openTab('b')
    const c = await openTab('c')
    await b.restoreFromDisk('user-1', true)
    await c.restoreFromDisk('user-1', true)
    const orphan = {
      userId: 'user-1',
      tabId: 'dead-tab',
      heartbeat: 0,
      pending: [
        {
          operationId: 'orphan-operation',
          revision: backend.state.row('user-1').revision,
          changes: changesBetween(emptyProgress(), {
            ...emptyProgress(),
            notes: { orphan: 'unsaved work' },
          }),
        },
      ],
      state: { ...emptyProgress(), notes: { orphan: 'unsaved work' } },
    }
    disk.setItem('saa.pending.v3.user-1.dead-tab', JSON.stringify(orphan))
    await Promise.all([
      b.restoreFromDisk('user-1', true),
      c.restoreFromDisk('user-1', true),
    ])
    await vi.waitFor(() =>
      expect(backend.state.row('user-1').data.notes.orphan).toBe(
        'unsaved work',
      ),
    )
    expect(disk.getItem('saa.pending.v3.user-1.dead-tab')).toBeNull()
    expect(
      backend.state.saves.filter((id: string) => id === 'orphan-operation'),
    ).toHaveLength(1)
  })
  it('discards a progress load that lands after the session was cleared', async () => {
    const a = await openTab('a')
    backend.state.row('user-1').data = normalizeProgress({
      notes: { server: 'user-1 data' },
    })
    const loading = a.restoreFromDisk('user-1', true)
    const signedOut = a.clearSession()
    await expect(loading).rejects.toThrow(/account changed/i)
    expect(a.getStore().notes).toEqual({})
    expect(signedOut.unsaved).toBe(0)
  })
  it('discards a save that lands after another account signed in', async () => {
    const a = await openTab('a')
    await a.restoreFromDisk('user-1', true)
    await settle()
    const gate = deferred()
    backend.state.gate = gate.promise
    a.setNote('note', 'user-1 work')
    await tick()
    backend.state.account = 'user-2'
    await a.restoreFromDisk('user-2', true)
    await settle()
    gate.resolve()
    await settle()
    expect(a.getStore().notes).toEqual({})
    expect(backend.state.row('user-1').data.notes.note).toBe('user-1 work')
    // A clobbered revision from the discarded response would make this save conflict.
    a.setNote('second', 'user-2 work')
    await vi.waitFor(() =>
      expect(backend.state.row('user-2').data.notes.second).toBe('user-2 work'),
    )
  })
  it('keeps unsaved work adoptable after sign-out and clears an empty journal', async () => {
    const a = await openTab('a')
    await a.restoreFromDisk('user-1', true)
    backend.state.offline = true
    a.setNote('unsent', 'never saved')
    await settle()
    expect(journals('user-1')).toHaveLength(1)
    const signedOut = a.clearSession()
    expect(signedOut.unsaved).toBe(1)
    expect(JSON.parse(signedOut.recovery!).notes.unsent).toBe('never saved')
    const [kept] = journals('user-1')
    expect(readJournal(kept).heartbeat).toBe(0)
    backend.state.offline = false
    const b = await openTab('b')
    await b.restoreFromDisk('user-1', true)
    await vi.waitFor(() =>
      expect(backend.state.row('user-1').data.notes.unsent).toBe('never saved'),
    )
    expect(journals('user-1')).toHaveLength(0)
    const c = await openTab('c')
    await c.restoreFromDisk('user-1', true)
    expect(c.clearSession().unsaved).toBe(0)
    expect(journals('user-1')).toHaveLength(0)
  })
})
