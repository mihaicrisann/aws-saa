import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { notFound } from 'next/navigation'
import { lectures } from '@/lib/content'
import LectureReader from '@/screens/LectureReader'

export function generateStaticParams() { return lectures.map(({ id }) => ({ id })) }
export const metadata = { title: 'Learn' }

async function getLecture(id: string) {
  'use cache'
  // These generated files are trusted, versioned course content, never user HTML.
  const page = await readFile(path.join(process.cwd(), '../lectures', `${id}.html`), 'utf8')
  const html = page.split('</header>')[1]?.split('<nav class="lec-nav">')[0]
  if (!html) throw new Error(`Lecture content is missing: ${id}`)
  const sections = [...html.matchAll(/<h2[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map((match) => ({ id: match[1], title: match[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') }))
  return { html, sections }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!lectures.some((lecture) => lecture.id === id)) notFound()
  const content = await getLecture(id)
  return <LectureReader {...content} />
}
