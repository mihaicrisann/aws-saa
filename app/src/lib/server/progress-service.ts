import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { progress, progressOperation } from './schema'
import {
  applyChanges,
  emptyProgress,
  normalizeProgress,
  ProgressConflict,
  type Change,
} from '../progress'
export async function readProgress(userId: string) {
  await db
    .insert(progress)
    .values({ userId, data: emptyProgress() })
    .onConflictDoNothing()
  const [row] = await db
    .select()
    .from(progress)
    .where(eq(progress.userId, userId))
  return { revision: row.revision, data: normalizeProgress(row.data) }
}
export async function saveProgress(
  userId: string,
  operationId: string,
  revision: number,
  changes: Change[],
) {
  return db.transaction(async (tx) => {
    await tx
      .insert(progress)
      .values({ userId, data: emptyProgress() })
      .onConflictDoNothing()
    const [row] = await tx
      .select()
      .from(progress)
      .where(eq(progress.userId, userId))
      .for('update')
    const [duplicate] = await tx
      .select()
      .from(progressOperation)
      .where(
        and(
          eq(progressOperation.userId, userId),
          eq(progressOperation.id, operationId),
        ),
      )
    if (duplicate)
      return { revision: row.revision, data: normalizeProgress(row.data) }
    if (revision > row.revision) throw new ProgressConflict(['revision'])
    const data = applyChanges(normalizeProgress(row.data), changes)
    await tx
      .update(progress)
      .set({ data, revision: row.revision + 1, updatedAt: new Date() })
      .where(eq(progress.userId, userId))
    await tx.insert(progressOperation).values({ userId, id: operationId })
    return { revision: row.revision + 1, data }
  })
}
