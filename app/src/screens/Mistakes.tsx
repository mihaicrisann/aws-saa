'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react'
import { Link } from '@/lib/navigation'
import { findQuestion, lectureById, sameSet, isMulti, lectureNo, questionHref, type Question } from '@/lib/content'
import { useStore, setMistakeMeta, clearMistake, recordAttempt, type MistakeMeta, type Confidence } from '@/lib/store'
import { useHotkeys } from '@/lib/hotkeys'
import QuestionView from '@/components/QuestionView'
import { toggleChoice } from '@/components/Filters'
import { PageHeader, DomainBadge, DomainDot, Nothing, QuietLink, Choice } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Reason = NonNullable<MistakeMeta['reason']>
const REASONS: { id: Reason; label: string; hint: string }[] = [
  { id: 'knowledge', label: 'Knowledge gap', hint: "Didn't know the service or the fact" },
  { id: 'misread', label: 'Misread', hint: 'Missed the qualifier: cheapest, least overhead, most secure' },
  { id: 'distractor', label: 'Distractor', hint: 'The wrong option looked plausible' },
  { id: 'guess', label: 'Guessed', hint: 'Down to two, picked the wrong one' },
]

type Row = { q: Question; meta: MistakeMeta; chosen: number[]; confidence?: Confidence; at: number }
type View = 'open' | 'resolved'
type Sort = 'sure' | 'lecture' | 'newest'
type Slice = 'sure' | Reason | 'untagged'

const CONF_RANK: Record<string, number> = { sure: 0, unsure: 1, guess: 2 }
const rank = (c?: Confidence) => (c ? CONF_RANK[c] : 3)

export default function Mistakes() {
  const mistakes = useStore((s) => s.mistakes)
  const attempts = useStore((s) => s.attempts)
  const [view, setView] = useState<View>('open')
  const [sort, setSort] = useState<Sort>('sure')
  const [slice, setSlice] = useState<Slice | ''>('')
  const [selected, setSelected] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)

  const all = useMemo<Row[]>(() => {
    const lastWrong = new Map<string, { chosen: number[]; confidence?: Confidence; at: number }>()
    for (const a of attempts) if (!a.correct) lastWrong.set(a.qid, { chosen: a.chosen, confidence: a.confidence, at: a.at })
    return Object.entries(mistakes).flatMap(([qid, meta]) => {
      const q = findQuestion(qid)
      if (!q) return []
      const last = lastWrong.get(qid)
      return [{ q, meta, chosen: last?.chosen ?? [], confidence: last?.confidence, at: last?.at ?? 0 }]
    })
  }, [mistakes, attempts])

  const open = all.filter((r) => !r.meta.resolved)
  const counts = {
    open: open.length,
    resolved: all.length - open.length,
    sure: open.filter((r) => r.confidence === 'sure').length,
    untagged: open.filter((r) => !r.meta.reason).length,
    reason: Object.fromEntries(REASONS.map((r) => [r.id, open.filter((m) => m.meta.reason === r.id).length])) as Record<Reason, number>,
  }

  const rows = useMemo(() => {
    const base = all.filter((r) => (view === 'open' ? !r.meta.resolved : r.meta.resolved))
    const sliced = !slice || view !== 'open' ? base
      : slice === 'sure' ? base.filter((r) => r.confidence === 'sure')
        : slice === 'untagged' ? base.filter((r) => !r.meta.reason)
          : base.filter((r) => r.meta.reason === slice)
    const byNewest = (a: Row, b: Row) => b.at - a.at
    return [...sliced].sort(
      sort === 'newest' ? byNewest
        : sort === 'lecture' ? (a, b) => a.q.lecture.localeCompare(b.q.lecture) || byNewest(a, b)
          : (a, b) => rank(a.confidence) - rank(b.confidence) || byNewest(a, b),
    )
  }, [all, view, slice, sort])

  const index = rows.findIndex((r) => r.q.id === selected)
  // An item that just left the list (marked understood, answered right) stays on screen until you move on.
  const pinned = index < 0 ? all.find((r) => r.q.id === selected) : undefined
  const current = index >= 0 ? rows[index] : pinned

  const [lastIndex, setLastIndex] = useState(0)
  useEffect(() => {
    if (index >= 0) { setLastIndex(index); return }
    if (!pinned) setSelected(rows[Math.min(lastIndex, rows.length - 1)]?.q.id ?? null)
  }, [rows, index, lastIndex, pinned])

  const go = (delta: number) => {
    if (!rows.length) return
    const from = index >= 0 ? index + delta : Math.min(lastIndex, rows.length - 1) + (delta > 0 ? 0 : -1)
    setSelected(rows[Math.max(0, Math.min(rows.length - 1, from))].q.id)
  }
  const hasNext = index >= 0 ? index < rows.length - 1 : rows.length > 0
  const pick = (qid: string) => { setSelected(qid); setMobileDetail(true) }

  useHotkeys((e) => {
    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); go(1) }
    if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); go(-1) }
  }, [rows, index])

  if (all.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Mistakes" description="Every wrong answer lands here." />
        <Nothing title="Nothing logged yet">
          Wrong answers from drills and mocks land here on their own. <Link to="/drill" className="underline underline-offset-4">Run a drill</Link>.
        </Nothing>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Mistakes"
        description="Retry blind, tag why you missed it, mark it understood. The next one is up."
        actions={
          <>
            <Choice
              value={view}
              onChange={(v) => v && setView(v)}
              options={[
                { value: 'open' as const, label: <>Open <span className="mono text-muted-foreground">{counts.open}</span></> },
                { value: 'resolved' as const, label: <>Resolved <span className="mono text-muted-foreground">{counts.resolved}</span></> },
              ]}
            />
            <Choice
              value={sort}
              onChange={(v) => v && setSort(v)}
              options={[
                { value: 'sure' as const, label: 'Sure first' },
                { value: 'lecture' as const, label: 'By lecture' },
                { value: 'newest' as const, label: 'Newest' },
              ]}
            />
          </>
        }
      />

      {view === 'open' && counts.open > 0 && (
        <div className={cn('mb-4 flex flex-wrap items-center gap-2', mobileDetail && 'hidden lg:flex')}>
          <span className="eyebrow mr-1">Filter</span>
          <Choice
            allowEmpty
            value={slice}
            onChange={(v) => setSlice(v ?? '')}
            options={[
              { value: 'sure' as Slice, label: <><span className={cn(counts.sure && 'text-bad')}>Was sure</span> <span className="mono text-muted-foreground">{counts.sure}</span></> },
              ...REASONS.map((r) => ({ value: r.id as Slice, label: <>{r.label} <span className="mono text-muted-foreground">{counts.reason[r.id]}</span></> })),
              { value: 'untagged' as Slice, label: <>Untagged <span className="mono text-muted-foreground">{counts.untagged}</span></> },
            ]}
          />
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className={cn('overflow-hidden rounded-xl border bg-card', mobileDetail && 'hidden lg:block')}>
          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
              {view === 'resolved' ? 'Nothing resolved yet.' : slice ? 'Nothing in this slice.' : 'No open mistakes. Nice.'}
            </p>
          ) : (
            <ScrollArea scrollFade className="lg:h-[calc(100svh-17rem)]">
              <ol aria-label="Mistakes">
                {rows.map((r, i) => {
                  const on = r.q.id === selected
                  return (
                    <li key={r.q.id} className="border-b last:border-b-0">
                      <button
                        type="button"
                        onClick={() => pick(r.q.id)}
                        aria-current={on ? 'true' : undefined}
                        className={cn(
                          'grid w-full grid-cols-[28px_1fr] gap-2 px-3 py-2.5 text-left transition-colors duration-100',
                          on ? 'bg-accent' : 'hover:bg-accent/50',
                        )}
                      >
                        <span className="mono mt-0.5 text-[11px] text-faint-foreground">{lectureNo(r.q.lecture)}</span>
                        <span className="min-w-0">
                          <span className={cn('line-clamp-2 text-[13px] leading-snug', on && 'font-medium')}>{r.q.stem}</span>
                          <span className="mt-1 flex items-center gap-2">
                            <DomainDot id={r.q.domain} />
                            {r.confidence === 'sure' && <span className="eyebrow text-bad">sure</span>}
                            {r.confidence === 'guess' && <span className="eyebrow">guessed</span>}
                            {r.meta.reason && <span className="eyebrow text-faint-foreground">{REASONS.find((x) => x.id === r.meta.reason)?.label}</span>}
                            {r.meta.note?.trim() && <span aria-label="has note" className="size-1 rounded-full bg-foreground" />}
                            <span className="mono ml-auto text-[10px] text-faint-foreground">{i + 1}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </ScrollArea>
          )}
          <div className="hidden items-center justify-between border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground lg:flex">
            <span className="flex items-center gap-1"><Kbd>j</Kbd><Kbd>k</Kbd> move</span>
            <span className="mono">{rows.length ? `${index + 1}/${rows.length}` : '0'}</span>
          </div>
        </div>

        <div className={cn(!mobileDetail && 'hidden lg:block')}>
          {current ? (
            <Detail
              key={current.q.id}
              row={current}
              position={index >= 0 ? `${index + 1} of ${rows.length}` : `${rows.length} left`}
              hasNext={hasNext}
              onNext={() => go(1)}
              onBack={() => setMobileDetail(false)}
            />
          ) : (
            <Nothing title={view === 'resolved' ? 'Nothing resolved yet' : 'Inbox zero'}>
              {view === 'resolved' ? 'Mark a mistake understood and it moves here.' : <>Every logged mistake is understood. <Link to="/drill" className="underline underline-offset-4">Find new ones</Link>.</>}
            </Nothing>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({ row, position, hasNext, onNext, onBack }: { row: Row; position: string; hasNext: boolean; onNext: () => void; onBack: () => void }) {
  const { q, meta } = row
  const lec = lectureById[q.lecture]
  const [chosen, setChosen] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [outcome, setOutcome] = useState<'right' | 'wrong' | null>(null)

  const check = () => {
    if (!chosen.length || revealed) return
    const ok = sameSet(chosen, q.correct)
    setOutcome(ok ? 'right' : 'wrong')
    setRevealed(true)
    recordAttempt({ qid: q.id, domain: q.domain, lecture: q.lecture, correct: ok, chosen, at: Date.now(), mode: 'drill' })
  }
  const reveal = () => { setChosen(row.chosen); setRevealed(true) }
  const understood = () => { setMistakeMeta(q.id, { resolved: true }); onNext() }

  useHotkeys((e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (revealed) { if (hasNext) onNext() } else if (chosen.length) check(); else reveal(); return }
    if (e.key === 'u' && revealed && !meta.resolved) return understood()
    const n = Number(e.key)
    if (!revealed && n >= 1 && n <= q.options.length) setChosen((c) => toggleChoice(c, n - 1, isMulti(q)))
  }, [revealed, chosen, hasNext, meta.resolved])

  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-5 py-3">
        <button type="button" onClick={onBack} className="pressable -ml-1 flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground lg:hidden"><ArrowLeft className="size-3.5" /> List</button>
        <DomainBadge id={q.domain} />
        {lec && <QuietLink to={questionHref(q)} className="text-xs"><span className="mono">{lectureNo(q.lecture)}</span> {lec.title}</QuietLink>}
        {row.confidence === 'sure' && <span className="eyebrow text-bad">was sure</span>}
        {row.confidence === 'guess' && <span className="eyebrow">guessed</span>}
        {meta.resolved && <span className="eyebrow text-good">resolved</span>}
        <span className="ml-auto flex items-center gap-3">
          <span className="mono text-[11px] text-faint-foreground">{position}</span>
          <button type="button" className="pressable text-xs text-muted-foreground hover:text-foreground" onClick={() => clearMistake(q.id)}>Remove</button>
        </span>
      </div>

      <div className="p-5">
        <QuestionView q={q} chosen={chosen} revealed={revealed} showMeta={false} onToggle={(idx) => setChosen((c) => toggleChoice(c, idx, isMulti(q)))} />

        {!revealed ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!chosen.length} onClick={check}>Check</Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={reveal}>Show what I answered</Button>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground"><Kbd>1</Kbd>–<Kbd>{q.options.length}</Kbd> pick · <Kbd>↵</Kbd> {chosen.length ? 'check' : 'reveal'}</span>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 border-t pt-5">
            {outcome && (
              <p className={cn('flex items-center gap-1.5 text-[13px] font-medium', outcome === 'right' ? 'text-good' : 'text-bad')}>
                {outcome === 'right' ? <><Check className="size-3.5" strokeWidth={3} /> Got it this time. Marked understood.</> : <><RotateCcw className="size-3.5" /> Still wrong. Read the reasoning, tag it.</>}
              </p>
            )}
            <div className="eyebrow">Why did I miss it</div>
            <ToggleGroup
              variant="outline"
              size="sm"
              value={meta.reason ? [meta.reason] : []}
              onValueChange={(v) => setMistakeMeta(q.id, { reason: v[0] as MistakeMeta['reason'] })}
            >
              {REASONS.map((r) => (
                <Tooltip key={r.id}>
                  <TooltipTrigger render={<ToggleGroupItem value={r.id} className="px-2.5 text-[13px] font-normal data-pressed:font-medium" />}>{r.label}</TooltipTrigger>
                  <TooltipContent>{r.hint}</TooltipContent>
                </Tooltip>
              ))}
            </ToggleGroup>
            <Textarea
              value={meta.note ?? ''}
              onChange={(e) => setMistakeMeta(q.id, { note: e.target.value })}
              placeholder="What will you check for next time?"
              className="min-h-14 text-[13px]"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-2.5">
        {revealed && (
          meta.resolved
            ? <Button size="sm" variant="outline" onClick={() => setMistakeMeta(q.id, { resolved: false })}>Reopen</Button>
            : <Button size="sm" onClick={understood}><Check /> Understood <Kbd className="bg-transparent text-current opacity-70 dark:bg-transparent">u</Kbd></Button>
        )}
        <Button render={<Link to={`/drill?lecture=${q.lecture}`} />} size="sm" variant="ghost" className="text-muted-foreground">Drill this lecture</Button>
        <Button size="sm" variant="ghost" className="ml-auto" disabled={!hasNext} onClick={onNext}>Next <ArrowRight /></Button>
      </div>
    </article>
  )
}
