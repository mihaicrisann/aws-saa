export default function Loading() {
  return <div className="mx-auto max-w-4xl space-y-5 py-6" role="status" aria-label="Loading page"><div className="h-8 w-40 animate-pulse rounded-lg bg-muted" /><div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" /><div className="h-64 animate-pulse rounded-2xl border bg-muted/40" /><span className="sr-only">Loading…</span></div>
}
