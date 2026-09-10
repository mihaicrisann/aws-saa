import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { db } from './db'
import * as schema from './schema'
import { MIN_PASSWORD_LENGTH } from '../password'
// Traefik appends the peer address to x-forwarded-for, so the rightmost hop outside these
// networks is the real client. Without them a directly reachable app would trust a spoof.
const trustedProxies = (
  process.env.TRUSTED_PROXIES ??
  '127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16'
)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
export const usesSecureCookies = (url = process.env.BETTER_AUTH_URL ?? '') =>
  url.startsWith('https://')
export function createAuth(provisioning = false) {
  const baseURL = process.env.BETTER_AUTH_URL
  return betterAuth({
    appName: 'AWS SAA',
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !provisioning,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    trustedOrigins: [
      ...(baseURL ? [new URL(baseURL).origin] : []),
      ...(process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:5180', 'http://127.0.0.1:5180']),
    ],
    advanced: {
      useSecureCookies: usesSecureCookies(baseURL),
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'], trustedProxies },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: { '/sign-in/email': { window: 60, max: 5 } },
    },
  })
}
export const auth = createAuth()
