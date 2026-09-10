'use client'

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from '@/lib/navigation'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { lectures, lectureById, questionsByLecture, cardsByLecture, lectureNo } from '@/lib/content'
import { useStore, markLectureRead } from '@/lib/store'
import Notes from '@/components/Notes'
import { useHotkeys } from '@/lib/hotkeys'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Badge } from '@/components/ui/badge'
import { DomainBadge, QuietLink } from '@/components/parts'

export default function LectureReader({ html, sections }: { html: string; sections: { id: string; title: string }[] }) {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const lec = lectureById[id]
  const idx = lectures.findIndex((l) => l.id === id)
  const prev = lectures[idx - 1]
  const next = lectures[idx + 1]

  const note = useStore((s) => s.notes[id] ?? '')
  const readAt = useStore((s) => s.lectureRead[id])
  const [notesOpen, setNotesOpen] = useState(false)

  const markAndAdvance = () => {
    markLectureRead(id)
    if (next) nav(`/learn/${next.id}`)
  }

  const onKey = (key: string) => {
    if (key === 'n') markAndAdvance()
    if (key === 'ArrowLeft' && prev) nav(`/learn/${prev.id}`)
    if (key === 'ArrowRight' && next) nav(`/learn/${next.id}`)
  }
  useHotkeys((e) => onKey(e.key), [id])

  useEffect(() => {
    const jump = () => {
      const hash = window.location.hash.slice(1)
      if (hash) document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: 'start' })
    }
    const frame = requestAnimationFrame(jump)
    window.addEventListener('hashchange', jump)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('hashchange', jump) }
  }, [id])

  if (!lec) {
    return (
      <p className="text-sm text-muted-foreground">
        No lecture with that id. <QuietLink to="/learn">Back to the list</QuietLink>.
      </p>
    )
  }

  const qCount = questionsByLecture(id).length
  const hardCount = questionsByLecture(id, 'v2').length
  const cCount = cardsByLecture(id).length

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <QuietLink to="/learn">Learn</QuietLink>
        <span className="text-muted-foreground">/</span>
        <span className="text-muted-foreground">{lectureNo(id)}</span>
        <span className="font-medium">{lec.title}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setNotesOpen((v) => !v)}>
            Notes{note.trim() ? ' •' : ''}
          </Button>
          {qCount > 0 && (
            <Button render={<Link to={`/drill?lecture=${id}`} />} variant="outline" size="sm">Drill {qCount}</Button>
          )}
          {hardCount > 0 && (
            <Button render={<Link to={`/drill?lecture=${id}&bank=v2`} />} variant="outline" size="sm">Hard {hardCount}</Button>
          )}
          {cCount > 0 && (
            <Button render={<Link to={`/cards?lecture=${id}`} />} variant="outline" size="sm">Cards {cCount}</Button>
          )}
          <Button size="sm" variant={readAt ? 'secondary' : 'default'} onClick={markAndAdvance}>
            {readAt ? <><Check /> Read</> : next ? 'Mark read, next' : 'Mark read'}
            <Kbd className="ml-1">n</Kbd>
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {lec.domains.map((d) => <DomainBadge key={d} id={d} />)}
        {lec.tags.map((t) => <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>)}
        <span className="ml-auto text-xs text-muted-foreground">{lec.minutes} min</span>
      </div>

      {notesOpen && (
        <div className="rise mb-4">
          <Notes
            noteKey={id}
            label={`Notes on ${lec.title}`}
            placeholder="Your notes on this lecture. Saved as you type."
            className="min-h-36"
          />
        </div>
      )}

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_180px]">
        <article className="min-w-0">
          <header className="border-b pb-6">
            <h1 className="text-3xl font-semibold tracking-tight">{lec.title}</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lec.standfirst}</p>
          </header>
          <div className="lecture-prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
        <aside className="sticky top-6 hidden xl:block">
          <p className="mb-3 text-xs font-medium text-muted-foreground">In this lecture</p>
          <nav aria-label="Lecture sections" className="space-y-2 border-l pl-3">
            {sections.map((section) => <a key={section.id} href={`#${section.id}`} className="block text-xs leading-relaxed text-muted-foreground hover:text-foreground">{section.title}</a>)}
          </nav>
        </aside>
      </div>

      <nav className="mt-6 flex items-center justify-between gap-3">
        {prev ? (
          <Button render={<Link to={`/learn/${prev.id}`} />} variant="ghost" className="max-w-[48%]"><ArrowLeft /> <span className="truncate">{prev.title}</span></Button>
        ) : <span />}
        {next ? (
          <Button render={<Link to={`/learn/${next.id}`} />} variant="ghost" className="max-w-[48%]"><span className="truncate">{next.title}</span> <ArrowRight /></Button>
        ) : (
          <Button render={<Link to="/exam" />}>Sit a mock exam <ArrowRight /></Button>
        )}
      </nav>
    </div>
  )
}
