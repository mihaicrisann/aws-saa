'use client'

import { Button } from '@/components/ui/button'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <p className="eyebrow">Error</p>
      <h1 className="display mt-4">This page could not load</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Try loading it again. Your saved progress is stored in your account.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  )
}
