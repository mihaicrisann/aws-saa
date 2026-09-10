'use client'

import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from '@/lib/navigation'
import { flashcards, shuffle, lectureNo, type DomainId } from '@/lib/content'
import { useStore, setCard } from '@/lib/store'
import { freshCard, isDue, schedule, describeInterval, type Grade } from '@/lib/srs'
import { useHotkeys } from '@/lib/hotkeys'
import { Field, DomainPicker, LecturePicker } from '@/components/Filters'
import { PageHeader, DomainBadge, Nothing, Meter, QuietLink, Choice } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Frame, FramePanel } from '@/components/ui/frame'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

const GRADES: { g: Grade; label: string; key: string }[] = [
  { g: 0, label: 'Again', key: '1' },
  { g: 1, label: 'Hard', key: '2' },
  { g: 2, label: 'Good', key: '3' },
  { g: 3, label: 'Easy', key: '4' },
]

export default function Cards() {
  const [params, setParams] = useSearchParams()
  const cards = useStore((s) => s.cards)

  const [domain, setDomain] = useState<DomainId | 'all'>((params.get('domain') as DomainId) ?? 'all')
  const [lecture, setLecture] = useState(params.get('lecture') ?? 'all')
  const [dueOnly, setDueOnly] = useState(true)
  const [queue, setQueue] = useState<string[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [done, setDone] = useState(0)

  const pool = useMemo(
    () => flashcards.filter((c) => (domain === 'all' || c.domain === domain) && (lecture === 'all' || c.lecture === lecture) && (!dueOnly || isDue(cards[c.id]))),
    [domain, lecture, dueOnly, cards],
  )

  const syncParams = (d: DomainId | 'all', l: string) => {
    const p = new URLSearchParams()
    if (d !== 'all') p.set('domain', d)
    if (l !== 'all') p.set('lecture', l)
    setParams(p, { replace: true })
  }

  const start = () => {
    setQueue(shuffle(pool).map((c) => c.id))
    setFlipped(false)
    setDone(0)
  }

  const current = queue?.[0] ? flashcards.find((c) => c.id === queue[0]) : undefined

  const grade = useCallback(
    (g: Grade) => {
      if (!current) return
      setCard(current.id, schedule(cards[current.id] ?? freshCard(), g))
      setQueue((qu) => {
        if (!qu) return qu
        const [head, ...rest] = qu
        return g === 0 ? [...rest.slice(0, 3), head, ...rest.slice(3)] : rest
      })
      setFlipped(false)
      setDone((d) => d + 1)
    },
    [current, cards],
  )

  useHotkeys(
    (e) => {
      if (!current) return
      if (e.code === 'Space') {
        e.preventDefault()
        setFlipped((f) => !f)
        return
      }
      if (!flipped) return
      const g = GRADES.find((x) => x.key === e.key)
      if (g) grade(g.g)
    },
    [current, flipped, grade],
  )

  const dueTotal = flashcards.filter((c) => isDue(cards[c.id])).length

  if (!queue) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Cards" description={`Recall, then rate yourself honestly — the rating decides when the card comes back. ${dueTotal} of ${flashcards.length} due.`} />
        <Frame>
          <FramePanel className="grid gap-5">
            <Field label="Domain"><DomainPicker value={domain} onChange={(v) => { setDomain(v); syncParams(v, lecture) }} /></Field>
            <Field label="Lecture"><LecturePicker value={lecture} onChange={(v) => { setLecture(v); syncParams(domain, v) }} /></Field>
            <Field label="Scope">
              <Choice
                value={dueOnly ? 'due' : 'all'}
                onChange={(v) => v && setDueOnly(v === 'due')}
                options={[
                  { value: 'due', label: 'Due now' },
                  { value: 'all', label: 'Everything' },
                ]}
              />
            </Field>
          </FramePanel>
          <FramePanel className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-muted-foreground">{pool.length} cards</span>
            <Button disabled={!pool.length} onClick={start}>Start</Button>
          </FramePanel>
        </Frame>
        {!pool.length && (
          <div className="mt-4">
            <Nothing title="Nothing due here">Come back tomorrow, or switch to "Everything" to work ahead.</Nothing>
          </div>
        )}
      </div>
    )
  }

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={`${done} card${done === 1 ? '' : 's'} reviewed`} description="Cards rated Good or Easy come back in days, not minutes, so the deck shrinks as things stick." />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQueue(null)}>Pick another slice</Button>
          <Button render={<Link to="/drill" />}>Drill questions</Button>
        </div>
      </div>
    )
  }

  const state = cards[current.id] ?? freshCard()

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-4 text-sm">
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setQueue(null)}>End</button>
        <Meter value={done / (done + queue.length)} className="flex-1" />
        <span className="text-muted-foreground tabular-nums">{queue.length} left</span>
      </div>

      <Frame style={{ perspective: 1400 }}>
        <div
          className="relative transition-transform duration-500 ease-[cubic-bezier(.22,.61,.36,1)] motion-reduce:transition-none"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateX(180deg)' : 'none' }}
        >
          <FramePanel className="p-0" style={{ backfaceVisibility: 'hidden' }}>
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="flex min-h-64 w-full flex-col justify-center px-8 py-8 text-left"
            >
              <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                <DomainBadge id={current.domain} />
                <span>Lecture {lectureNo(current.lecture)}</span>
                {state.reps > 0 && <span>· seen {state.reps}×</span>}
              </div>
              <div className="text-xl leading-snug font-medium">{current.front}</div>
            </button>
          </FramePanel>

          <FramePanel
            className="absolute inset-0 flex flex-col justify-center overflow-y-auto px-8 py-8"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
            aria-hidden={!flipped}
          >
            <div className="mb-2 text-xs text-muted-foreground">{current.front}</div>
            <div className="text-[15px] leading-relaxed whitespace-pre-line">{current.back}</div>
            {current.note && (
              <div className="mt-4 rounded-xl border-l-2 border-foreground/40 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Exam note. </span>{current.note}
              </div>
            )}
          </FramePanel>
        </div>
      </Frame>

      <div className="mt-4">
        {flipped ? (
          <div className="rise grid grid-cols-4 gap-2">
            {GRADES.map((g) => (
              <Button key={g.g} variant="outline" className={cn('h-auto flex-col gap-0 py-2')} onClick={() => grade(g.g)}>
                <span className="text-sm">{g.label}</span>
                <span className="text-xs text-muted-foreground">{describeInterval(state, g.g)}</span>
              </Button>
            ))}
          </div>
        ) : (
          <Button className="w-full" onClick={() => setFlipped(true)}>Show answer <Kbd className="ml-1">Space</Kbd></Button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <QuietLink to={`/learn/${current.lecture}`}>Read the lecture</QuietLink>
        <span className="flex items-center gap-1">
          {flipped ? <><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd><Kbd>4</Kbd> rate</> : <><Kbd>Space</Kbd> flip</>}
        </span>
      </div>
    </div>
  )
}
