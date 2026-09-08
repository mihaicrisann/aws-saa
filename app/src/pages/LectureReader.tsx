import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { lectures, lectureById, questionsByLecture, cardsByLecture, lectureNo } from '@/lib/content'
import { useStore, markLectureRead, setNote } from '@/lib/store'
import { useHotkeys } from '@/lib/hotkeys'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Kbd } from '@/components/ui/kbd'
import { Badge } from '@/components/ui/badge'
import { DomainBadge, QuietLink } from '@/components/parts'

export default function LectureReader() {
  const { id = '' } = useParams()
  const { hash } = useLocation()
  const nav = useNavigate()
  const frame = useRef<HTMLIFrameElement>(null)
  const lec = lectureById[id]
  const idx = lectures.findIndex((l) => l.id === id)
  const prev = lectures[idx - 1]
  const next = lectures[idx + 1]

  const note = useStore((s) => s.notes[id] ?? '')
  const readAt = useStore((s) => s.lectureRead[id])
  const [height, setHeight] = useState(2400)
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
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'lecture:height' && typeof e.data.height === 'number') setHeight(Math.max(600, e.data.height + 24))
      if (e.data?.type === 'lecture:key' && typeof e.data.key === 'string') onKey(e.data.key)
      if (e.data?.type === 'lecture:scrollTo' && typeof e.data.top === 'number' && frame.current) {
        const frameTop = frame.current.getBoundingClientRect().top + window.scrollY
        window.scrollTo({ top: frameTop + e.data.top - 24, behavior: 'smooth' })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!hash) window.scrollTo({ top: 0 })
    setHeight(2400)
  }, [id, hash])

  if (!lec) {
    return (
      <p className="text-sm text-muted-foreground">
        No lecture with that id. <QuietLink to="/learn">Back to the list</QuietLink>.
      </p>
    )
  }

  const qCount = questionsByLecture(id).length
  const cCount = cardsByLecture(id).length

  return (
    <div className="mx-auto max-w-3xl">
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
          <Textarea
            value={note}
            onChange={(e) => setNote(id, e.target.value)}
            placeholder="Your notes on this lecture. Saved as you type."
            className="min-h-36"
          />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border bg-card">
        <iframe ref={frame} title={lec.title} src={`/lectures/${lec.id}.html${hash}`} className="w-full border-0" style={{ height }} />
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
