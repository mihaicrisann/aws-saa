import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { auth, createAuth, usesSecureCookies } from '../src/lib/server/auth'
import { db, pool } from '../src/lib/server/db'
import { user } from '../src/lib/server/schema'
import { GET, PUT } from '../src/app/api/progress/route'
import { MIN_PASSWORD_LENGTH } from '../src/lib/password'
const origin = process.env.BETTER_AUTH_URL!,
  email = `auth-${crypto.randomUUID()}@example.invalid`,
  password = crypto.randomUUID() + crypto.randomUUID(),
  nextPassword = crypto.randomUUID() + crypto.randomUUID()
const owner = '203.0.113.10',
  burst = '203.0.113.77',
  bystander = '198.51.100.20'
// Better Auth limits sensitive paths to three requests per ten seconds per client,
// so each password-change probe below comes from its own device address.
const device = (n: number) => ({ 'x-forwarded-for': `203.0.113.${n}` })
const cookiesOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
const authRequest = (
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) =>
  auth.handler(
    new Request(`${origin}/api/auth${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin,
        'x-forwarded-for': owner,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  )
const progressPut = (body: unknown, cookie: string) =>
  PUT(
    new Request(`${origin}/api/progress`, {
      method: 'PUT',
      headers: { cookie, origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
let id: string | undefined
try {
  const signed = await createAuth(true).api.signUpEmail({
    body: { email, password, name: 'Auth test' },
  })
  id = signed.user.id
  const unauthorized = await GET(new Request(`${origin}/api/progress`))
  assert.equal(unauthorized.status, 401)
  const disabled = await authRequest('/sign-up/email', {
    email: `blocked-${email}`,
    password,
    name: 'Blocked',
  })
  assert.ok(disabled.status >= 400)
  const response = await authRequest('/sign-in/email', { email, password })
  assert.equal(response.status, 200)
  let cookie = cookiesOf(response)
  assert.ok(cookie)
  const [sessionCookie] = response.headers
    .getSetCookie()
    .filter((value) => value.includes('session_token'))
  assert.match(sessionCookie, /HttpOnly/i)
  assert.match(sessionCookie, /SameSite=Lax/i)
  assert.match(sessionCookie, /Path=\//i)
  assert.equal(usesSecureCookies('https://saa.mihais-vps.xyz'), true)
  assert.equal(usesSecureCookies('http://localhost:5180'), false)
  const authenticated = await GET(
    new Request(`${origin}/api/progress`, { headers: { cookie } }),
  )
  assert.equal(authenticated.status, 200)
  const badOrigin = await PUT(
    new Request(`${origin}/api/progress`, {
      method: 'PUT',
      headers: {
        cookie,
        origin: 'https://invalid.example',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }),
  )
  assert.equal(badOrigin.status, 403)
  const invalid = await progressPut(
    {
      operationId: crypto.randomUUID(),
      revision: 0,
      changes: [{ path: ['notes', 'a'], before: null, after: 123 }],
    },
    cookie,
  )
  assert.equal(invalid.status, 400)
  const unroutable = await progressPut(
    {
      operationId: crypto.randomUUID(),
      revision: 0,
      changes: [{ path: ['attempts', '0'], before: null, after: null }],
    },
    cookie,
  )
  assert.equal(unroutable.status, 400)

  // Password change: a second device signs in, then loses its session on success.
  const second = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })
  const secondCookie = cookiesOf(second)
  assert.ok(secondCookie)
  assert.equal(
    (
      await GET(
        new Request(`${origin}/api/progress`, {
          headers: { cookie: secondCookie },
        }),
      )
    ).status,
    200,
  )
  const anonymousChange = await authRequest(
    '/change-password',
    {
      currentPassword: password,
      newPassword: nextPassword,
      revokeOtherSessions: true,
    },
    device(21),
  )
  assert.equal(anonymousChange.status, 401)
  const wrongCurrent = await authRequest(
    '/change-password',
    {
      currentPassword: `${password}-wrong`,
      newPassword: nextPassword,
      revokeOtherSessions: true,
    },
    { cookie, ...device(22) },
  )
  assert.equal(wrongCurrent.status, 400)
  const tooShort = await authRequest(
    '/change-password',
    {
      currentPassword: password,
      newPassword: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
      revokeOtherSessions: true,
    },
    { cookie, ...device(23) },
  )
  assert.equal(tooShort.status, 400)
  const changed = await authRequest(
    '/change-password',
    {
      currentPassword: password,
      newPassword: nextPassword,
      revokeOtherSessions: true,
    },
    { cookie, ...device(24) },
  )
  assert.equal(changed.status, 200)
  cookie = cookiesOf(changed)
  assert.ok(cookie)
  assert.equal(
    (
      await GET(
        new Request(`${origin}/api/progress`, {
          headers: { cookie: secondCookie },
        }),
      )
    ).status,
    401,
  )
  assert.equal(
    (await GET(new Request(`${origin}/api/progress`, { headers: { cookie } })))
      .status,
    200,
  )
  await assert.rejects(auth.api.signInEmail({ body: { email, password } }))
  assert.ok(
    (await auth.api.signInEmail({ body: { email, password: nextPassword } }))
      .user,
  )

  // Rate limiting buckets per client IP, and a spoofed forwarded header cannot escape it.
  const attempt = (forwarded: string) =>
    authRequest(
      '/sign-in/email',
      { email, password: 'wrong-password-entirely' },
      { 'x-forwarded-for': forwarded },
    )
  for (let i = 0; i < 5; i++)
    assert.notEqual((await attempt(burst)).status, 429)
  assert.equal((await attempt(burst)).status, 429)
  assert.notEqual((await attempt(bystander)).status, 429)
  assert.equal((await attempt(`${bystander}, ${burst}`)).status, 429)
  console.log(
    'Auth API: login/session, cookie attributes, public signup disabled, unauthenticated access, cross-origin write rejection, invalid import rejection, password change (anonymous/wrong current/too short/revoked sessions) and per-client-IP rate limiting passed.',
  )
} finally {
  if (id) await db.delete(user).where(eq(user.id, id))
  await pool.end()
}
