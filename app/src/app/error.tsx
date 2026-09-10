'use client'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-md px-6 py-24"><h1 className="text-xl font-semibold">This page could not load</h1><p className="mt-2 text-sm text-muted-foreground">Try loading it again. Your saved progress is stored in your account.</p><button className="mt-5 rounded-xl border px-4 py-2 text-sm" onClick={reset}>Try again</button></div>
}
