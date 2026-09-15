import { beforeEach, describe, expect, it, vi } from 'vitest'

const disk = new Map<string, string>()

vi.mock('expo-sqlite/kv-store', () => ({
  default: {
    getItemSync: (k: string) => disk.get(k) ?? null,
    setItemSync: (k: string, v: string) => {
      disk.set(k, v)
    },
    removeItemSync: (k: string) => {
      disk.delete(k)
    },
  },
}))

type StoreModule = typeof import('./store')

const load = async (): Promise<StoreModule> => {
  vi.resetModules()
  return import('./store')
}

const attempt = (over: Partial<import('./store').Attempt> = {}) => ({
  qid: 'q1',
  domain: 'secure' as const,
  lecture: '02-iam',
  correct: true,
  chosen: [0],
  at: Date.now(),
  mode: 'drill' as const,
  ...over,
})

beforeEach(() => {
  disk.clear()
  vi.useRealTimers()
})

describe('store', () => {
  it('starts empty when storage is empty', async () => {
    const s = await load()
    expect(s.getStore().attempts).toEqual([])
    expect(s.getStore().theme).toBe('light')
  })

  it('loads synchronously from storage at module init', async () => {
    disk.set('saa.progress', JSON.stringify({ theme: 'dark', dailyGoal: 200, lectureRead: { '02-iam': 5 } }))
    const s = await load()
    expect(s.getStore().theme).toBe('dark')
    expect(s.getStore().dailyGoal).toBe(200)
    expect(s.getStore().lectureRead['02-iam']).toBe(5)
  })

  it('falls back to an empty store when storage holds junk', async () => {
    disk.set('saa.progress', 'not json')
    const s = await load()
    expect(s.getStore().attempts).toEqual([])
  })

  it('writes through, debounced', async () => {
    vi.useFakeTimers()
    const s = await load()
    s.setDailyGoal(300)
    expect(disk.get('saa.progress')).toBeUndefined()
    vi.advanceTimersByTime(200)
    expect(JSON.parse(disk.get('saa.progress')!).dailyGoal).toBe(300)
  })

  it('flush writes immediately', async () => {
    vi.useFakeTimers()
    const s = await load()
    s.setDailyGoal(120)
    s.flush()
    expect(JSON.parse(disk.get('saa.progress')!).dailyGoal).toBe(120)
  })

  it('records an attempt, counts activity and tracks the mistake', async () => {
    const s = await load()
    s.recordAttempt(attempt({ correct: false }))
    const state = s.getStore()
    expect(state.attempts).toHaveLength(1)
    expect(state.attempts[0].id).toBeTruthy()
    expect(state.activity[s.today()]).toBe(1)
    expect(state.mistakes.q1).toEqual({ resolved: false })

    s.recordAttempt(attempt({ qid: 'q1', correct: true }))
    expect(s.getStore().mistakes.q1).toEqual({ resolved: true })
    expect(s.getStore().activity[s.today()]).toBe(2)
  })

  it('does not record the same attempt id twice', async () => {
    const s = await load()
    s.recordAttempt(attempt({ id: 'fixed' }))
    s.recordAttempt(attempt({ id: 'fixed' }))
    expect(s.getStore().attempts).toHaveLength(1)
  })

  it('records a drill attempt together with the active drill', async () => {
    const s = await load()
    const drill = {
      id: 'd1',
      ids: ['q1', 'q2'],
      index: 1,
      chosen: [],
      revealed: false,
      shownAt: Date.now(),
      log: [{ qid: 'q1', ok: true, seconds: 8 }],
      domain: 'all',
      lecture: 'all',
      count: 2,
      unseen: false,
    }
    s.recordDrillAttempt(attempt(), drill)
    expect(s.getStore().activeDrill?.index).toBe(1)
    expect(s.getStore().attempts).toHaveLength(1)
  })

  it('finishes an exam once, clearing the active exam', async () => {
    const s = await load()
    s.setActiveExam({
      id: 'e1',
      ids: ['q1'],
      answers: {},
      flags: [],
      startedAt: Date.now(),
      minutes: 130,
    })
    const result = {
      id: 'e1',
      at: Date.now(),
      total: 1,
      correct: 1,
      seconds: 60,
      byDomain: { secure: { total: 1, correct: 1 } },
      wrongIds: [],
    }
    s.finishExam([attempt()], result)
    expect(s.getStore().exams).toHaveLength(1)
    expect(s.getStore().activeExam).toBeNull()

    s.finishExam([attempt({ id: 'other' })], result)
    expect(s.getStore().exams).toHaveLength(1)
    expect(s.getStore().attempts).toHaveLength(1)
  })

  it('grades a card and counts it as activity', async () => {
    const s = await load()
    s.setCard('c1', { ease: 2.5, interval: 1, due: 0, reps: 1, lapses: 0 })
    expect(s.getStore().cards.c1.reps).toBe(1)
    expect(s.getStore().activity[s.today()]).toBe(1)
  })

  it('marks a lecture read and stores a note', async () => {
    const s = await load()
    s.markLectureRead('02-iam')
    s.setNote('02-iam', 'roles over users')
    expect(s.getStore().lectureRead['02-iam']).toBeGreaterThan(0)
    expect(s.getStore().notes['02-iam']).toBe('roles over users')
  })

  it('keeps the theme through a reset', async () => {
    const s = await load()
    s.setTheme('dark')
    s.recordAttempt(attempt())
    s.resetProgress()
    expect(s.getStore().theme).toBe('dark')
    expect(s.getStore().attempts).toEqual([])
  })

  it('exports and re-imports without duplicating history', async () => {
    const s = await load()
    s.recordAttempt(attempt({ id: 'a1' }))
    const json = s.exportStore()
    s.importStore(json)
    expect(s.getStore().attempts).toHaveLength(1)
  })

  it('merges an import from another device', async () => {
    const s = await load()
    s.recordAttempt(attempt({ id: 'mine' }))
    s.importStore(
      JSON.stringify({ attempts: [attempt({ id: 'theirs', qid: 'q9' })], activity: { '2026-01-01': 4 } }),
    )
    expect(s.getStore().attempts.map((a) => a.id).sort()).toEqual(['mine', 'theirs'])
    expect(s.getStore().activity['2026-01-01']).toBe(4)
  })

  it('drops fields it does not know instead of rejecting the file, and reports the counts', async () => {
    const s = await load()
    s.recordAttempt(attempt({ id: 'mine' }))
    const result = s.importStore(
      JSON.stringify({
        attempts: [attempt({ id: 'theirs', qid: 'q9' })],
        cards: { c1: { ease: 2.5, interval: 1, due: 0, reps: 1, lapses: 0 } },
        syncedAt: 1,
        featureFlags: { beta: true },
      }),
    )
    expect(result).toEqual({ attempts: 2, cards: 1, exams: 0, added: 1 })
    expect(s.getStore().attempts.map((a) => a.id).sort()).toEqual(['mine', 'theirs'])
  })

  it('rejects an import that is not valid progress', async () => {
    const s = await load()
    expect(() => s.importStore('{"attempts":"nope"}')).toThrow()
    expect(() => s.importStore('[1,2,3]')).toThrow()
    expect(s.getStore().attempts).toEqual([])
  })

  it('counts a study streak back from today', async () => {
    const s = await load()
    const day = (back: number) => {
      const d = new Date()
      d.setDate(d.getDate() - back)
      return s.today(d)
    }
    expect(s.studyStreak({ [day(0)]: 3, [day(1)]: 1, [day(3)]: 9 })).toBe(2)
    expect(s.studyStreak({ [day(1)]: 1, [day(2)]: 1 })).toBe(2)
    expect(s.studyStreak({})).toBe(0)
  })
})
