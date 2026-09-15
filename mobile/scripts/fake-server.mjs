/**
 * The progress contract from app/src/app/api/progress/route.ts, in memory, for driving the
 * simulator without the real server. One hardcoded account, no database.
 *
 *   npx tsx scripts/fake-server.mjs            # http://localhost:8787
 *   EXPO_PUBLIC_SAA_SERVER=http://localhost:8787 npx expo run:ios
 *
 * GET /__debug reports the revision and the sizes, so a curl can prove a push landed.
 */
import { createServer } from 'node:http'
import {
  applyChanges,
  emptyProgress,
  normalizeProgress,
  ProgressConflict,
} from '../src/lib/progress.ts'

const PORT = Number(process.env.PORT ?? 8787)
const ORIGIN = process.env.FAKE_ORIGIN ?? `http://localhost:${PORT}`
const EMAIL = process.env.FAKE_EMAIL ?? 'mihai@example.com'
const PASSWORD = process.env.FAKE_PASSWORD ?? 'correct-horse'
const COOKIE = 'better-auth.session_token=fake-session-token.signature'

const state = { revision: 0, updatedAt: Date.now(), data: emptyProgress(), ops: new Set() }

const read = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => (raw += chunk))
    req.on('end', () => resolve(raw ? JSON.parse(raw) : undefined))
  })

const send = (res, status, payload, headers = {}) => {
  const body = JSON.stringify(payload)
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers })
  res.end(body)
  console.log(`  → ${status} ${body.length > 160 ? `${body.length} bytes` : body}`)
}

const snapshot = () => ({ revision: state.revision, updatedAt: state.updatedAt, data: state.data })
const authed = (req) => (req.headers.cookie ?? '').includes(COOKIE)

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, ORIGIN)
  console.log(`${req.method} ${pathname}`)
  const body = req.method === 'GET' ? undefined : await read(req)

  if (req.method !== 'GET' && req.headers.origin !== ORIGIN)
    return send(res, 403, { error: `Invalid origin: ${req.headers.origin}` })

  if (pathname === '/api/auth/sign-in/email')
    return body?.email === EMAIL && body?.password === PASSWORD
      ? send(res, 200, { user: { id: 'user-1', email: EMAIL } }, { 'Set-Cookie': `${COOKIE}; Path=/; HttpOnly; SameSite=Lax` })
      : send(res, 401, { error: 'Invalid email or password' })

  if (pathname === '/api/auth/sign-out') return send(res, 200, { success: true })

  if (pathname === '/api/auth/get-session')
    return send(res, 200, authed(req) ? { user: { id: 'user-1', email: EMAIL } } : null)

  if (pathname === '/__debug')
    return send(res, 200, {
      revision: state.revision,
      updatedAt: state.updatedAt,
      attempts: state.data.attempts.length,
      exams: state.data.exams.length,
      cards: Object.keys(state.data.cards).length,
      lectureRead: Object.keys(state.data.lectureRead).length,
      dailyGoal: state.data.dailyGoal,
      activity: state.data.activity,
    })

  if (pathname !== '/api/progress') return send(res, 404, { error: 'No such route' })
  if (!authed(req)) return send(res, 401, { error: 'Sign in to load your progress.' })
  if (req.method === 'GET') return send(res, 200, snapshot())
  if (req.method !== 'PUT') return send(res, 405, { error: 'Use GET or PUT' })

  if (state.ops.has(body.operationId)) return send(res, 200, snapshot())
  if (body.revision > state.revision)
    return send(res, 409, { error: 'Progress changed on another device.', paths: ['revision'], ...snapshot() })
  try {
    state.data = applyChanges(normalizeProgress(state.data), body.changes)
  } catch (error) {
    if (!(error instanceof ProgressConflict)) return send(res, 400, { error: String(error) })
    return send(res, 409, { error: error.message, paths: error.paths, ...snapshot() })
  }
  state.ops.add(body.operationId)
  state.revision += 1
  state.updatedAt = Date.now()
  send(res, 200, snapshot())
}).listen(PORT, () => console.log(`fake saa server on ${ORIGIN} — ${EMAIL} / ${PASSWORD}`))
