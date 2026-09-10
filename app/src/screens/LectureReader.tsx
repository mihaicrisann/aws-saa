'use client'

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from '@/lib/navigation'
import { ArrowLeft, ArrowRight, Check, NotebookPen } from 'lucide-react'
import { lectures, lectureById, questionsByLecture, cardsByLecture, lectureNo, shortDomain } from '@/lib/content'
import { useStore, markLectureRead } from '@/lib/store'
import Notes from '@/components/Notes'
import { useHotkeys } from '@/lib/hotkeys'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { DomainDot, QuietLink } from '@/components/parts'
import { cn } from '@/lib/utils'

function useActiveSection(sections: { id: string }[]) {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el)
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [sections])
  return active
}

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
  const activeSection = useActiveSection(sections)

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
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <QuietLink to="/learn" className="flex items-center gap-1"><ArrowLeft className="size-3" /> Learn</QuietLink>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setNotesOpen((v) => !v)} aria-pressed={notesOpen}>
            <NotebookPen /> Notes{note.trim() ? <span className="ml-0.5 size-1.5 rounded-full bg-foreground" aria-label="has notes" /> : null}
          </Button>
          {qCount > 0 && <Button render={<Link to={`/drill?lecture=${id}`} />} variant="outline" size="sm">Drill <span className="mono text-muted-foreground">{qCount}</span></Button>}
          {hardCount > 0 && <Button render={<Link to={`/drill?lecture=${id}&bank=v2`} />} variant="outline" size="sm">Hard <span className="mono text-muted-foreground">{hardCount}</span></Button>}
          {cCount > 0 && <Button render={<Link to={`/cards?lecture=${id}`} />} variant="outline" size="sm">Cards <span className="mono text-muted-foreground">{cCount}</span></Button>}
          <Button size="sm" variant={readAt ? 'secondary' : 'default'} onClick={markAndAdvance}>
            {readAt ? <><Check /> Read</> : next ? 'Mark read, next' : 'Mark read'}
            <Kbd className="ml-0.5 bg-transparent text-current opacity-70 dark:bg-transparent">n</Kbd>
          </Button>
        </div>
      </div>

      {notesOpen && (
        <div className="rise mb-8">
          <Notes
            noteKey={id}
            label={`Notes on ${lec.title}`}
            placeholder="Notes. Saved as you type."
            className="min-h-36"
          />
        </div>
      )}

      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_200px]">
        <article className="min-w-0">
          <header className="border-b pb-8">
            <div className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-faint-foreground">Lecture {lectureNo(id)}</span>
              <span>{lec.minutes} min</span>
              {lec.domains.map((d) => (
                <span key={d} className="flex items-center gap-1.5"><DomainDot id={d} />{shortDomain(d)}</span>
              ))}
            </div>
            <h1 className="display-lg mt-5">{lec.title}</h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">{lec.standfirst}</p>
            {lec.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {lec.tags.map((t) => <span key={t} className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">{t}</span>)}
              </div>
            )}
          </header>
          <div className="lecture-prose" dangerouslySetInnerHTML={{ __html: html }} />
          <div aria-hidden className="pointer-events-none sticky bottom-12 h-20 bg-[linear-gradient(to_bottom,transparent,var(--background)_75%)] md:bottom-0" />
        </article>

        <aside className="sticky top-8 hidden xl:block">
          <p className="eyebrow mb-3">On this page</p>
          <nav aria-label="Lecture sections" className="grid gap-px">
            {sections.map((section, i) => {
              const on = activeSection === section.id
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={cn(
                    'grid grid-cols-[20px_1fr] gap-2 rounded-md px-2 py-1.5 text-xs leading-snug transition-colors duration-100',
                    on ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span className={cn('mono', on ? 'text-foreground' : 'text-faint-foreground')}>{String(i + 1).padStart(2, '0')}</span>
                  {section.title}
                </a>
              )
            })}
          </nav>
        </aside>
      </div>

      <nav className="mt-2 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
        {prev ? (
          <Link to={`/learn/${prev.id}`} className="group bg-card px-5 py-4 transition-colors duration-100 hover:bg-accent/50">
            <div className="eyebrow flex items-center gap-1.5"><ArrowLeft className="size-3 transition-transform duration-200 ease-(--ease-out) group-hover:-translate-x-0.5" /> Previous</div>
            <div className="mt-2 truncate text-sm font-medium">{lectureNo(prev.id)} {prev.title}</div>
          </Link>
        ) : <span className="hidden bg-card sm:block" />}
        {next ? (
          <Link to={`/learn/${next.id}`} className="group bg-card px-5 py-4 text-right transition-colors duration-100 hover:bg-accent/50">
            <div className="eyebrow flex items-center justify-end gap-1.5">Next <ArrowRight className="size-3 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" /></div>
            <div className="mt-2 truncate text-sm font-medium">{lectureNo(next.id)} {next.title}</div>
          </Link>
        ) : (
          <Link to="/exam" className="group bg-card px-5 py-4 text-right transition-colors duration-100 hover:bg-accent/50">
            <div className="eyebrow flex items-center justify-end gap-1.5">Done <ArrowRight className="size-3" /></div>
            <div className="mt-2 text-sm font-medium">Sit a mock exam</div>
          </Link>
        )}
      </nav>
    </div>
  )
}
