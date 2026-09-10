import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <p className="eyebrow">404</p>
      <h1 className="display mt-4">Page not found</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to your study workspace</Link>
    </div>
  )
}
