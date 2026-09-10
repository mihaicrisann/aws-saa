import assert from 'node:assert/strict'
import { eq } from 'drizzle-orm'
import { db, pool } from '../src/lib/server/db'
import { user } from '../src/lib/server/schema'
import { readProgress, saveProgress } from '../src/lib/server/progress-service'
import { changesBetween } from '../src/lib/progress'
const first = crypto.randomUUID(),
  second = crypto.randomUUID()
try {
  await db.insert(user).values([
    { id: first, name: 'Persistence test', email: `${first}@example.invalid` },
    { id: second, name: 'Isolation test', email: `${second}@example.invalid` },
  ])
  const base = await readProgress(first),
    next = { ...base.data, notes: { test: 'one' } }
  const op = crypto.randomUUID(),
    changes = changesBetween(base.data, next)
  const saved = await saveProgress(first, op, 0, changes),
    repeated = await saveProgress(first, op, 0, changes)
  assert.equal(saved.revision, 1)
  assert.equal(repeated.revision, 1)
  const concurrent = await Promise.all([
    saveProgress(
      first,
      crypto.randomUUID(),
      0,
      changesBetween(base.data, { ...base.data, notes: { left: 'L' } }),
    ),
    saveProgress(
      first,
      crypto.randomUUID(),
      0,
      changesBetween(base.data, { ...base.data, notes: { right: 'R' } }),
    ),
  ])
  assert.equal(Math.max(...concurrent.map((s) => s.revision)), 3)
  const merged = await readProgress(first)
  assert.deepEqual(merged.data.notes, { test: 'one', left: 'L', right: 'R' })
  await assert.rejects(
    saveProgress(
      first,
      crypto.randomUUID(),
      0,
      changesBetween(base.data, { ...base.data, notes: { test: 'conflict' } }),
    ),
  )
  assert.deepEqual((await readProgress(second)).data.notes, {})
  const current = await readProgress(first)
  const tagged = {
    ...current.data,
    attempts: [
      {
        id: 'v2-attempt',
        qid: 'v2-001',
        domain: 'perf' as const,
        lecture: '11-performance',
        correct: true,
        chosen: [0],
        at: 1,
        mode: 'drill' as const,
        bank: 'v2' as const,
        bankVersion: 1,
      },
    ],
  }
  await saveProgress(
    first,
    crypto.randomUUID(),
    current.revision,
    changesBetween(current.data, tagged),
  )
  const [attempt] = (await readProgress(first)).data.attempts
  assert.equal(attempt.bank, 'v2')
  assert.equal(attempt.bankVersion, 1)
  console.log(
    'PostgreSQL transactions: duplicate retries, concurrent merge, conflicts, account isolation and bank-tagged attempts passed.',
  )
} finally {
  await db.delete(user).where(eq(user.id, first))
  await db.delete(user).where(eq(user.id, second))
  await pool.end()
}
