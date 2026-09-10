import { createAuth } from '../src/lib/server/auth'
import { pool, db } from '../src/lib/server/db'
import { session } from '../src/lib/server/schema'
import { eq } from 'drizzle-orm'
const email = process.env.OWNER_EMAIL?.trim().toLowerCase(),
  password = process.env.OWNER_PASSWORD
if (!email || !password || password.length < 12)
  throw new Error(
    'Set OWNER_EMAIL and OWNER_PASSWORD (at least 12 characters).',
  )
try {
  const auth = createAuth(true),
    ctx = await auth.$context
  const existing = await ctx.internalAdapter.findUserByEmail(email)
  if (existing) {
    await ctx.internalAdapter.updatePassword(
      existing.user.id,
      await ctx.password.hash(password),
    )
    await db.delete(session).where(eq(session.userId, existing.user.id))
    console.log('Owner password updated; previous sessions revoked.')
  } else {
    await auth.api.signUpEmail({
      body: { email, password, name: process.env.OWNER_NAME ?? 'Mihai' },
    })
    console.log('Owner account created. Public signup remains disabled.')
  }
} finally {
  await pool.end()
}
