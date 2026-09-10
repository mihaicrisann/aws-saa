import { connection } from 'next/server'
import { sql } from 'drizzle-orm'
import { db } from '@/lib/server/db'
export async function GET() {
  await connection()
  try {
    await db.execute(sql`select 1 from progress limit 1`)
    return Response.json(
      { status: 'ok' },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 })
  }
}
