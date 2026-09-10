import { readFile, readdir } from 'node:fs/promises'
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock(728311)')
  await client.query(
    'CREATE TABLE IF NOT EXISTS study_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  )
  const files = (await readdir(new URL('../drizzle/', import.meta.url)))
    .filter((f) => f.endsWith('.sql'))
    .sort()
  for (const name of files) {
    const existing = await client.query(
      'SELECT name FROM study_migrations WHERE name=$1',
      [name],
    )
    if (existing.rowCount) continue
    await client.query(
      await readFile(new URL(`../drizzle/${name}`, import.meta.url), 'utf8'),
    )
    await client.query('INSERT INTO study_migrations(name) VALUES($1)', [name])
    console.log(`Applied ${name}`)
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await pool.end()
}
