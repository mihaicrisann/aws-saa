import * as SecureStore from 'expo-secure-store'
import { normalizeProgress, type Change, type Progress } from '../progress'

/** The deployed web app. `EXPO_PUBLIC_SAA_SERVER` points the app at a local server instead. */
export const SERVER = (process.env.EXPO_PUBLIC_SAA_SERVER ?? 'https://saa.mihais-vps.xyz').replace(/\/$/, '')

/**
 * better-auth checks Origin on every write against its trustedOrigins, which hold the
 * server's own origin only — so the app has to claim that origin explicitly.
 */
export const ORIGIN = SERVER

const TIMEOUT_MS = 10_000
const TOKEN_KEY = 'saa.session.cookie'

/** The request never left the device, or never came back. Retryable, queue survives. */
export class Offline extends Error {
  name = 'Offline'
  constructor(message = 'No connection.') {
    super(message)
  }
}

/** The server answered and refused. */
export class HttpError extends Error {
  name = 'HttpError'
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface Snapshot {
  revision: number
  /** Absent until the server ships the field; the engine falls back to activity stamps. */
  updatedAt?: number
  data: Progress
}

/** A 409: the server sends its current snapshot back with the colliding paths. */
export class Conflict extends Error {
  name = 'Conflict'
  constructor(
    public snapshot: Snapshot,
    public paths: string[],
  ) {
    super('Progress changed on another device.')
  }
}

export interface Operation {
  operationId: string
  revision: number
  changes: Change[]
}

let token: string | null = null

/** Reads the keychain once at launch, and never over a session signed in since. */
export async function loadToken() {
  try {
    const stored = await SecureStore.getItemAsync(TOKEN_KEY)
    if (!token) token = stored
  } catch {}
  return token
}

export const currentToken = () => token

async function setToken(value: string | null) {
  token = value
  try {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value)
    else await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {}
}

const COOKIE = /(?:^|[,\s])((?:__Secure-|__Host-)?better-auth\.session_token=[^;,\s]+)/

/**
 * RN joins repeated Set-Cookie headers with commas, and an Expires attribute carries one
 * too, so the token is found by name rather than by splitting.
 */
export function parseSessionCookie(header: string | null): string | null {
  return header?.match(COOKIE)?.[1] ?? null
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(`${SERVER}${path}`, {
      ...init,
      // The native cookie jar would send its own copy alongside the explicit header.
      credentials: 'omit',
      signal: controller.signal,
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
        ...(token ? { Cookie: token } : {}),
        ...init.headers,
      },
    })
  } catch (error) {
    throw new Offline(error instanceof Error && error.name === 'AbortError' ? 'The server took too long.' : 'No connection.')
  } finally {
    clearTimeout(timer)
  }
}

async function body(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

const said = (payload: Record<string, unknown> | null, fallback: string) =>
  typeof payload?.error === 'string' ? payload.error : fallback

export interface Account {
  id: string
  email: string
}

export async function signIn(email: string, password: string): Promise<Account> {
  const response = await request('/api/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const payload = await body(response)
  if (!response.ok)
    throw new HttpError(
      response.status,
      response.status === 401 || response.status === 403
        ? 'That email and password do not match.'
        : said(payload, 'Sign in failed.'),
    )
  const cookie = parseSessionCookie(response.headers.get('set-cookie'))
  if (!cookie) throw new HttpError(500, 'The server did not send a session.')
  await setToken(cookie)
  const user = payload?.user as { id?: string; email?: string } | undefined
  if (user?.id) return { id: user.id, email: user.email ?? email }
  const session = await getSession()
  if (!session) throw new HttpError(500, 'The session did not stick.')
  return session
}

export async function getSession(): Promise<Account | null> {
  if (!token) return null
  const response = await request('/api/auth/get-session')
  if (response.status === 401) return null
  if (!response.ok) throw new HttpError(response.status, said(await body(response), 'Session check failed.'))
  const payload = await body(response)
  const user = payload?.user as { id?: string; email?: string } | undefined
  return user?.id ? { id: user.id, email: user.email ?? '' } : null
}

export async function signOut() {
  try {
    if (token) await request('/api/auth/sign-out', { method: 'POST' })
  } catch {}
  await setToken(null)
}

/** Dropped without a server round trip when the session is already gone. */
export async function forgetToken() {
  await setToken(null)
}

function snapshotOf(payload: Record<string, unknown> | null): Snapshot {
  if (!payload || typeof payload.revision !== 'number' || !payload.data)
    throw new HttpError(500, 'The server sent an unreadable reply.')
  return {
    revision: payload.revision,
    updatedAt: typeof payload.updatedAt === 'number' ? payload.updatedAt : undefined,
    data: normalizeProgress(payload.data),
  }
}

export async function readProgress(): Promise<Snapshot> {
  const response = await request('/api/progress')
  if (response.status === 401) throw new HttpError(401, 'Signed out.')
  const payload = await body(response)
  if (!response.ok) throw new HttpError(response.status, said(payload, 'Unable to load your progress.'))
  return snapshotOf(payload)
}

export async function saveProgress(op: Operation): Promise<Snapshot> {
  const response = await request('/api/progress', { method: 'PUT', body: JSON.stringify(op) })
  if (response.status === 401) throw new HttpError(401, 'Signed out.')
  const payload = await body(response)
  if (response.status === 409)
    throw new Conflict(snapshotOf(payload), Array.isArray(payload?.paths) ? (payload.paths as string[]) : [])
  if (!response.ok) throw new HttpError(response.status, said(payload, 'Unable to save your progress.'))
  return snapshotOf(payload)
}

/** Hermes has no crypto.randomUUID and the server's schema wants a real v4. */
export function newUuid() {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else if (i === 19) out += hex[8 + Math.floor(Math.random() * 4)]
    else out += hex[Math.floor(Math.random() * 16)]
  }
  return out
}
