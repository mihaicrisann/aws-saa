import Link from 'next/link'
export default function NotFound() {
  return <div className="mx-auto max-w-md px-6 py-24"><h1 className="text-xl font-semibold">Page not found</h1><Link href="/" className="mt-4 inline-block text-sm underline">Back to your study workspace</Link></div>
}
