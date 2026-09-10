export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl" role="status" aria-label="Loading page">
      <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 h-20 animate-pulse rounded-xl border bg-muted/40" />
      <div className="mt-3 h-64 animate-pulse rounded-xl border bg-muted/40" />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
