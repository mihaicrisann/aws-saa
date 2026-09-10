'use client'

import { useMemo, useState } from 'react'
import { Link } from '@/lib/navigation'
import { findQuestion, lectureById, sameSet, isMulti, lectureNo, questionHref } from '@/lib/content'
import { useStore, setMistakeMeta, clearMistake, recordAttempt, type MistakeMeta, type Confidence } from '@/lib/store'
import QuestionView from '@/components/QuestionView'
import { toggleChoice } from '@/components/Filters'
import { PageHeader, DomainBadge, Nothing, QuietLink, Stat, StatRow } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const REASONS: { id: NonNullable<MistakeMeta['reason']>; label: string; hint: string }[] = [
  { id: 'knowledge', label: 'Knowledge gap', hint: "Didn't know the service or the fact" },
  { id: 'misread', label: 'Misread', hint: 'Missed the qualifier: cheapest, least overhead, most secure' },
  { id: 'distractor', label: 'Distractor', hint: 'The wrong option looked plausible' },
  { id: 'guess', label: 'Guessed', hint: 'Down to two, picked the wrong one' },
]

export default function Mistakes() {
  const mistakes = useStore((s) => s.mistakes)
  const attempts = useStore((s) => s.attempts)
  const [view, setView] = useState<'open' | 'all'>('open')
  const [retrying, setRetrying] = useState<string | null>(null)
  const [chosen, setChosen] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)

  const rows = useMemo(() => {
    const lastWrong = new Map<string, { chosen: number[]; confidence?: Confidence }>()
    for (const a of attempts) if (!a.correct) lastWrong.set(a.qid, { chosen: a.chosen, confidence: a.confidence })
    const rank = (c?: Confidence) => (c === 'sure' ? 0 : c === 'unsure' ? 1 : 2)
    return Object.entries(mistakes)
      .map(([qid, meta]) => ({ q: findQuestion(qid)!, meta, chosen: lastWrong.get(qid)?.chosen ?? [], confidence: lastWrong.get(qid)?.confidence }))
      .filter((r) => r.q && (view === 'all' || !r.meta.resolved))
      .reverse()
      .sort((a, b) => rank(a.confidence) - rank(b.confidence))
  }, [mistakes, attempts, view])

  const openCount = Object.values(mistakes).filter((m) => !m.resolved).length
  const sureWrong = rows.filter((r) => !r.meta.resolved && r.confidence === 'sure').length
  const byReason = REASONS.map((r) => ({ ...r, n: Object.values(mistakes).filter((m) => !m.resolved && m.reason === r.id).length }))

  const stopRetry = () => { setRetrying(null); setRevealed(false); setChosen([]) }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Mistakes"
        description="Every wrong answer lands here. Tag why you missed it, re-read the lecture, retry blind. Reviewing your own errors beats new questions."
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as 'open' | 'all')}>
            <TabsList>
              <TabsTrigger value="open">Open {openCount}</TabsTrigger>
              <TabsTrigger value="all">All {Object.keys(mistakes).length}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {sureWrong > 0 && (
        <p className="mb-4 rounded-2xl border border-bad/40 bg-bad/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-bad">{sureWrong} answered "sure" and wrong.</span> Those are listed first — a confident wrong answer on the real exam costs the same as a guess but you won't flag it for review.
        </p>
      )}
      {openCount > 0 && (
        <StatRow className="mb-6">
          {byReason.map((r) => (
            <Stat key={r.id} label={r.label} value={r.n} />
          ))}
        </StatRow>
      )}

      {rows.length === 0 ? (
        <Nothing title={view === 'all' ? 'Nothing logged yet' : 'No open mistakes'}>
          Wrong answers from drills and mocks land here on their own. <Link to="/drill" className="underline underline-offset-4">Run a drill</Link>.
        </Nothing>
      ) : (
        <div className="grid gap-3">
          {rows.map(({ q, meta, chosen: prevChosen, confidence }) => {
            const lec = lectureById[q.lecture]
            const isRetrying = retrying === q.id
            return (
              <Card key={q.id} className={cn(meta.resolved && 'opacity-60')}>
                <CardContent>
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                    <DomainBadge id={q.domain} />
                    {lec && <QuietLink to={questionHref(q)} className="text-xs">{lectureNo(q.lecture)} {lec.title}</QuietLink>}
                    {confidence === 'sure' && <span className="text-bad">was sure</span>}
                    {confidence === 'guess' && <span className="text-muted-foreground">guessed</span>}
                    {meta.resolved && <span className="text-good">resolved</span>}
                    <button type="button" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => clearMistake(q.id)}>Remove</button>
                  </div>

                  {isRetrying ? (
                    <QuestionView q={q} chosen={chosen} revealed={revealed} showMeta={false} onToggle={(idx) => setChosen((c) => toggleChoice(c, idx, isMulti(q)))} />
                  ) : (
                    <>
                      <p className="text-sm leading-relaxed">{q.stem}</p>
                      <details className="group mt-3">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Show answer and reasoning</summary>
                        <div className="rise mt-3">
                          <QuestionView q={q} chosen={prevChosen} revealed onToggle={() => {}} showMeta={false} />
                        </div>
                      </details>

                      <div className="mt-4 grid gap-3 border-t pt-4">
                        <div className="text-xs text-muted-foreground">Why did I miss it?</div>
                        <ToggleGroup
                          variant="outline"
                          size="sm"
                          value={meta.reason ? [meta.reason] : []}
                          onValueChange={(v) => setMistakeMeta(q.id, { reason: v[0] as MistakeMeta['reason'] })}
                        >
                          {REASONS.map((r) => (
                            <Tooltip key={r.id}>
                              <TooltipTrigger render={<ToggleGroupItem value={r.id} />}>{r.label}</TooltipTrigger>
                              <TooltipContent>{r.hint}</TooltipContent>
                            </Tooltip>
                          ))}
                        </ToggleGroup>
                        <Textarea
                          value={meta.note ?? ''}
                          onChange={(e) => setMistakeMeta(q.id, { note: e.target.value })}
                          placeholder="One line: what will you check for next time?"
                          className="min-h-14"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
                <CardFooter className="gap-2 border-t">
                  {isRetrying ? (
                    <>
                      <Button variant="outline" size="sm" onClick={stopRetry}>Close</Button>
                      {!revealed && (
                        <Button size="sm" disabled={!chosen.length} onClick={() => {
                          const ok = sameSet(chosen, q.correct)
                          setRevealed(true)
                          recordAttempt({ qid: q.id, domain: q.domain, lecture: q.lecture, correct: ok, chosen, at: Date.now(), mode: 'drill' })
                        }}>Check</Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setRetrying(q.id); setChosen([]); setRevealed(false) }}>Retry blind</Button>
                      <Button render={<Link to={`/drill?lecture=${q.lecture}`} />} size="sm" variant="ghost">Drill this lecture</Button>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setMistakeMeta(q.id, { resolved: !meta.resolved })}>
                        {meta.resolved ? 'Reopen' : 'Mark understood'}
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
