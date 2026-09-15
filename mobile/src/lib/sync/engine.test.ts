import { beforeEach, describe, expect, it, vi } from 'vitest'
import { COOKIE, fakeServer, ORIGIN } from '@/test/fake-server'

type Store = typeof import('../store')
type Engine = typeof import('./engine')

async function boot() {
  vi.resetModules()
  const store: Store = await import('../store')
  const engine: Engine = await import('./engine')
  return { store, engine }
}

const attempt = (id: string, at = 1_500) => ({
  id,
  qid: `q-${id}`,
  domain: 'secure' as const,
  lecture: '02-iam',
  correct: true,
  chosen: [0],
  at,
  mode: 'drill' as const,
})

const signedIn = async (engine: Engine) => engine.signIn('mihai@example.com', 'correct-horse')

const puts = (server: ReturnType<typeof fakeServer>) =>
  server.requests.filter((r) => r.method === 'PUT' && r.path === '/api/progress')

beforeEach(() => {
  vi.useRealTimers()
})

describe('sync engine', () => {
  it('signs in, stores the token and sends Cookie and Origin on every later request', async () => {
    const server = fakeServer()
    const { engine } = await boot()
    await signedIn(engine)

    const signIn = server.requests[0]
    expect(signIn.path).toBe('/api/auth/sign-in/email')
    expect(signIn.headers.Origin).toBe(ORIGIN)
    expect(signIn.headers.Cookie).toBeUndefined()

    await engine.pull()
    const after = server.requests.slice(1)
    expect(after.length).toBeGreaterThan(0)
    for (const r of after) {
      expect(r.headers.Cookie).toBe(COOKIE)
      expect(r.headers.Origin).toBe(ORIGIN)
      expect(r.headers['Content-Type']).toBe('application/json')
    }
    expect(engine.getSyncStatus()).toMatchObject({ state: 'synced', email: 'mihai@example.com' })
  })

  it('refuses a wrong password without storing a session', async () => {
    fakeServer()
    const { engine } = await boot()
    await expect(engine.signIn('mihai@example.com', 'nope')).rejects.toThrow(/do not match/)
    expect(engine.getSyncStatus().state).toBe('off')
  })

  it('merges this device into the account on the first sign-in', async () => {
    const server = fakeServer({ attempts: [attempt('theirs')] })
    const { store, engine } = await boot()
    store.recordAttempt(attempt('mine'))
    await signedIn(engine)

    expect(server.data.attempts.map((a) => a.id).sort()).toEqual(['mine', 'theirs'])
    expect(store.getStore().attempts.map((a) => a.id).sort()).toEqual(['mine', 'theirs'])
    expect(engine.getSyncStatus()).toMatchObject({ state: 'synced', pendingCount: 0 })
  })

  it('queues edits while offline and flushes them in order when the network returns', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)

    server.offline = true
    store.setDailyGoal(300)
    store.setNote('02-iam', 'roles over users')
    await engine.flush()

    expect(engine.getSyncStatus()).toMatchObject({ state: 'offline', pendingCount: 2 })
    expect(server.data.dailyGoal).toBe(100)
    expect(store.getStore().dailyGoal).toBe(300)

    server.offline = false
    await engine.flush()

    const sent = puts(server).filter((r) => r.body?.changes?.length)
    expect(sent[sent.length - 2].body?.changes?.[0].path).toEqual(['dailyGoal'])
    expect(sent[sent.length - 1].body?.changes?.[0].path).toEqual(['notes', '02-iam'])
    expect(server.data.dailyGoal).toBe(300)
    expect(server.data.notes['02-iam']).toBe('roles over users')
    expect(engine.getSyncStatus()).toMatchObject({ state: 'synced', pendingCount: 0 })
  })

  it('resolves a 409 and re-pushes exactly one operation', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)

    // Another device moved the same key while this one was writing.
    server.write({ dailyGoal: 200, notes: { '05-s3': 'from the web' } })
    store.setDailyGoal(300)
    const before = puts(server).length
    await engine.flush()

    const conflicted = puts(server).slice(before)
    expect(conflicted).toHaveLength(2)
    expect(conflicted[1].body?.operationId).not.toBe(conflicted[0].body?.operationId)
    // Latest wins on the collided key; the other device's untouched key survives.
    expect(server.data.dailyGoal).toBe(300)
    expect(server.data.notes['05-s3']).toBe('from the web')
    expect(store.getStore().dailyGoal).toBe(300)
    expect(engine.getSyncStatus()).toMatchObject({ state: 'synced', pendingCount: 0 })
  })

  it('keeps the queue and the local state when the session expires mid-flush', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)

    server.unauthorized = true
    store.setDailyGoal(300)
    await engine.flush()

    expect(engine.getSyncStatus()).toMatchObject({ state: 'error', pendingCount: 1, needsSignIn: true })
    expect(store.getStore().dailyGoal).toBe(300)
    expect(server.data.dailyGoal).toBe(100)

    // Signing in again resumes the same queue rather than starting over.
    server.unauthorized = false
    await signedIn(engine)
    expect(server.data.dailyGoal).toBe(300)
    expect(engine.getSyncStatus()).toMatchObject({ state: 'synced', pendingCount: 0, needsSignIn: false })
  })

  it('adopts the server copy on pull when nothing is queued', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)

    server.write({ dailyGoal: 200, attempts: [attempt('from-web')] })
    await engine.pull()

    expect(store.getStore().dailyGoal).toBe(200)
    expect(store.getStore().attempts.map((a) => a.id)).toEqual(['from-web'])
    expect(engine.getSyncStatus().state).toBe('synced')
  })

  it('ignores a duplicate operation id', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)
    store.setDailyGoal(300)
    await engine.flush()
    const revision = server.revision
    const op = puts(server).at(-1)!.body!
    await import('./api').then((api) => api.saveProgress(op as never))
    expect(server.revision).toBe(revision)
  })

  it('signs out only once the queue is empty, and keeps the progress on the phone', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)

    server.offline = true
    store.setDailyGoal(300)
    await engine.flush()
    expect(await engine.signOut()).toEqual({ unsaved: 1 })
    expect(engine.getSyncStatus().state).toBe('offline')

    expect(await engine.signOut({ force: true })).toEqual({ unsaved: 0 })
    expect(engine.getSyncStatus()).toMatchObject({ state: 'off', pendingCount: 0 })
    expect(store.getStore().dailyGoal).toBe(300)

    // Signed out, edits stay purely local: nothing is queued and nothing is sent.
    server.offline = false
    const before = server.requests.length
    store.setDailyGoal(50)
    await engine.flush()
    expect(server.requests.length).toBe(before)
  })

  it('debounces a local edit into a flush about a second later', async () => {
    const server = fakeServer()
    const { store, engine } = await boot()
    await signedIn(engine)
    vi.useFakeTimers()
    store.setDailyGoal(300)
    expect(engine.getSyncStatus()).toMatchObject({ state: 'syncing', pendingCount: 1 })
    const before = puts(server).length
    await vi.advanceTimersByTimeAsync(1_100)
    expect(puts(server).length).toBeGreaterThan(before)
  })
})
