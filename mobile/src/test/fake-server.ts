import { vi } from 'vitest'
import { applyChanges, emptyProgress, normalizeProgress, ProgressConflict, type Change, type Progress } from '@/lib/progress'

export const ORIGIN = 'https://saa.mihais-vps.xyz'
export const COOKIE = '__Secure-better-auth.session_token=tok-123.sig'

export interface Recorded {
  method: string
  path: string
  headers: Record<string, string>
  body: { operationId?: string; revision?: number; changes?: Change[] } | undefined
}

/** The progress contract, in memory, wired into globalThis.fetch. */
export function fakeServer(seed: Partial<Progress> = {}) {
  const s = {
    revision: 0,
    data: normalizeProgress({ ...emptyProgress(), ...seed }),
    updatedAt: 1_000,
    ops: new Set<string>(),
    offline: false,
    unauthorized: false,
    requests: [] as Recorded[],
    /** Another device writing, so the next client push meets a moved server. */
    write(next: Partial<Progress>, at = 2_000) {
      s.data = normalizeProgress({ ...s.data, ...next })
      s.revision += 1
      s.updatedAt = at
    },
  }

  const json = (status: number, payload: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    })

  const handler = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const path = String(url).slice(ORIGIN.length)
    const headers = (init.headers ?? {}) as Record<string, string>
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    s.requests.push({ method, path, headers, body })
    if (s.offline) throw new TypeError('Network request failed')
    if (method !== 'GET' && headers.Origin !== ORIGIN) return json(403, { error: 'Invalid origin' })

    if (path === '/api/auth/sign-in/email')
      return body?.email === 'mihai@example.com' && body?.password === 'correct-horse'
        ? json(200, { user: { id: 'user-1', email: body.email } }, { 'set-cookie': `${COOKIE}; Path=/; Expires=Wed, 01 Oct 2026 10:00:00 GMT; HttpOnly` })
        : json(401, { error: 'Invalid email or password' })
    if (path === '/api/auth/sign-out') return json(200, { success: true })

    const authed = headers.Cookie === COOKIE && !s.unauthorized
    if (path === '/api/auth/get-session')
      return authed ? json(200, { user: { id: 'user-1', email: 'mihai@example.com' } }) : json(200, null)
    if (!authed) return json(401, { error: 'Sign in to load your progress.' })

    const snapshot = () => ({ revision: s.revision, updatedAt: s.updatedAt, data: s.data })
    if (path === '/api/progress' && method === 'GET') return json(200, snapshot())
    if (path === '/api/progress' && method === 'PUT') {
      if (s.ops.has(body.operationId)) return json(200, snapshot())
      if (body.revision > s.revision) return json(409, { paths: ['revision'], ...snapshot() })
      try {
        s.data = applyChanges(s.data, body.changes)
      } catch (error) {
        if (error instanceof ProgressConflict) return json(409, { paths: error.paths, ...snapshot() })
        throw error
      }
      s.ops.add(body.operationId)
      s.revision += 1
      s.updatedAt += 1_000
      return json(200, snapshot())
    }
    return json(404, { error: 'No such route' })
  })

  globalThis.fetch = handler as unknown as typeof fetch
  return s
}
