import { z } from 'zod'
import { auth } from '@/lib/server/auth'
import { readProgress, saveProgress } from '@/lib/server/progress-service'
import { InvalidProgress, ProgressConflict } from '@/lib/progress'
const requestSchema = z.object({
  operationId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  changes: z
    .array(
      z.object({
        path: z.array(z.string().max(250)).min(1).max(2),
        before: z.unknown(),
        after: z.unknown(),
      }),
    )
    .max(10000),
})
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session)
    return Response.json(
      { error: 'Sign in to load your progress.' },
      { status: 401 },
    )
  return Response.json(await readProgress(session.user.id), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session)
    return Response.json(
      { error: 'Sign in to save your progress.' },
      { status: 401 },
    )
  // Session cookies authenticate writes; same-origin checks also prevent CSRF.
  // Deriving the expected origin from the request would trust the Host header.
  const expected = process.env.BETTER_AUTH_URL
  if (!expected)
    return Response.json({ error: 'Server is misconfigured.' }, { status: 500 })
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(expected).origin)
    return Response.json({ error: 'Invalid origin' }, { status: 403 })
  if (Number(request.headers.get('content-length')) > 10_000_000)
    return Response.json({ error: 'Import is too large.' }, { status: 413 })
  try {
    const raw = await request.text()
    if (raw.length > 10_000_000)
      return Response.json({ error: 'Import is too large.' }, { status: 413 })
    const input = requestSchema.parse(JSON.parse(raw))
    return Response.json(
      await saveProgress(
        session.user.id,
        input.operationId,
        input.revision,
        input.changes,
      ),
    )
  } catch (error) {
    if (error instanceof ProgressConflict)
      return Response.json(
        {
          error: error.message,
          paths: error.paths,
          ...(await readProgress(session.user.id)),
        },
        { status: 409 },
      )
    if (
      error instanceof z.ZodError ||
      error instanceof SyntaxError ||
      error instanceof InvalidProgress
    )
      return Response.json({ error: 'Invalid progress data.' }, { status: 400 })
    console.error(
      'Progress save failed',
      error instanceof Error ? error.message : 'unknown',
    )
    return Response.json(
      { error: 'Progress could not be saved. Retry shortly.' },
      { status: 500 },
    )
  }
}
