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
        <PageHeader
          title="Cards"
          description={<>Recall, then rate yourself honestly. The rating decides when the card comes back. <span className="mono text-xs">{dueTotal}/{flashcards.length}</span> due.</>}
        />
        <div className="overflow-hidden rounded-xl border bg-card">
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
          <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-3">
            <span className="mono text-xs text-muted-foreground">{pool.length} cards</span>
            <Button disabled={!pool.length} onClick={start}>Start</Button>
          </div>
        </div>
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
        <PageHeader
          eyebrow="Deck done"
          title={<><span className="mono">{done}</span> card{done === 1 ? '' : 's'} reviewed</>}
          description="Cards rated Good or Easy come back in days, not minutes, so the deck shrinks as things stick."
        />
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
      <div className="mb-6 flex items-center gap-4">
        <button type="button" className="pressable text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setQueue(null)}>End</button>
        <Meter value={done / (done + queue.length)} className="flex-1" />
        <span className="mono text-xs text-muted-foreground">{queue.length} left</span>
      </div>

      <div style={{ perspective: 1600 }}>
        <div
          className="relative transition-transform duration-500 ease-(--ease-in-out) motion-reduce:transition-none"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateX(180deg)' : 'none' }}
        >
          <div className="rounded-xl border bg-card" style={{ backfaceVisibility: 'hidden' }}>
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="flex min-h-72 w-full flex-col justify-between px-7 py-6 text-left"
            >
              <div className="flex items-center gap-2">
                <DomainBadge id={current.domain} />
                <span className="mono text-[11px] text-muted-foreground">Lecture {lectureNo(current.lecture)}</span>
                {state.reps > 0 && <span className="mono ml-auto text-[11px] text-faint-foreground">seen {state.reps}×</span>}
              </div>
              <div className="my-8 text-[22px] leading-snug font-medium tracking-tight">{current.front}</div>
              <div className="eyebrow flex items-center gap-1.5"><Kbd>Space</Kbd> reveal</div>
            </button>
          </div>

          <div
            className="quiet-scroll absolute inset-0 flex flex-col overflow-y-auto rounded-xl border bg-card px-7 py-6"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateX(180deg)' }}
            aria-hidden={!flipped}
          >
            <div className="eyebrow mb-4 line-clamp-2 normal-case tracking-normal">{current.front}</div>
            <div className="text-[15px] leading-relaxed whitespace-pre-line">{current.back}</div>
            {current.note && (
              <div className="mt-5 rounded-lg border border-l-2 border-l-foreground/60 bg-muted/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Exam note. </span>{current.note}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        {flipped ? (
          <div className="rise grid grid-cols-4 gap-1.5">
            {GRADES.map((g) => (
              <Button key={g.g} variant="outline" className={cn('h-auto flex-col gap-0.5 py-2.5')} onClick={() => grade(g.g)}>
                <span className="flex items-center gap-1.5 text-[13px]"><Kbd>{g.key}</Kbd>{g.label}</span>
                <span className="mono text-[11px] text-muted-foreground">{describeInterval(state, g.g)}</span>
              </Button>
            ))}
          </div>
        ) : (
          <Button className="w-full" onClick={() => setFlipped(true)}>Show answer</Button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <QuietLink to={`/learn/${current.lecture}`} className="text-xs">Read the lecture</QuietLink>
        <span className="flex items-center gap-1">
          {flipped ? <><Kbd>1</Kbd><Kbd>2</Kbd><Kbd>3</Kbd><Kbd>4</Kbd> rate</> : <><Kbd>Space</Kbd> flip</>}
        </span>
      </div>
    </div>
  )
}
