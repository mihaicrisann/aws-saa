import { useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { questions, shuffle, sameSet, isMulti, lectureNo, questionHref, type Question, type DomainId } from '@/lib/content'
import { recordAttempt, useStore, type Confidence } from '@/lib/store'
import { ConfidencePicker, useTicker, fmtSeconds } from '@/components/Confidence'
import { useHotkeys } from '@/lib/hotkeys'
import QuestionView from '@/components/QuestionView'
import { Field, DomainPicker, LecturePicker, toggleChoice } from '@/components/Filters'
import { PageHeader, Nothing, Meter } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Kbd } from '@/components/ui/kbd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export default function Drill() {
  const [params, setParams] = useSearchParams()
  const attempts = useStore((s) => s.attempts)

  const [domain, setDomain] = useState<DomainId | 'all'>((params.get('domain') as DomainId) ?? 'all')
  const [lecture, setLecture] = useState(params.get('lecture') ?? 'all')
  const [count, setCount] = useState(10)
  const [unseen, setUnseen] = useState(false)

  const [set, setSet] = useState<Question[] | null>(null)
  const [i, setI] = useState(0)
  const [chosen, setChosen] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const [confidence, setConfidence] = useState<Confidence | undefined>()
  const [shownAt, setShownAt] = useState(Date.now())
  const [log, setLog] = useState<{ q: Question; ok: boolean; confidence?: Confidence; seconds: number }[]>([])

  const seen = useMemo(() => new Set(attempts.map((a) => a.qid)), [attempts])
  const elapsed = useTicker(shownAt, !!set && !revealed)
  const pool = useMemo(
    () =>
      questions.filter(
        (q) => (domain === 'all' || q.domain === domain) && (lecture === 'all' || q.lecture === lecture) && (!unseen || !seen.has(q.id)),
      ),
    [domain, lecture, unseen, seen],
  )

  const syncParams = (d: DomainId | 'all', l: string) => {
    const p = new URLSearchParams()
    if (d !== 'all') p.set('domain', d)
    if (l !== 'all') p.set('lecture', l)
    setParams(p, { replace: true })
  }

  const start = () => {
    setSet(shuffle(pool).slice(0, count))
    setI(0)
    setChosen([])
    setRevealed(false)
    setConfidence(undefined)
    setShownAt(Date.now())
    setLog([])
  }

  const current = set?.[i]

  const check = useCallback(() => {
    if (!current || revealed || !chosen.length) return
    const ok = sameSet(chosen, current.correct)
    const seconds = Math.round((Date.now() - shownAt) / 1000)
    setRevealed(true)
    setLog((l) => [...l, { q: current, ok, confidence, seconds }])
    recordAttempt({ qid: current.id, domain: current.domain, lecture: current.lecture, correct: ok, chosen, at: Date.now(), mode: 'drill', confidence, seconds })
  }, [current, revealed, chosen, confidence, shownAt])

  const advance = useCallback(() => {
    setI((n) => n + 1)
    setChosen([])
    setRevealed(false)
    setConfidence(undefined)
    setShownAt(Date.now())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useHotkeys(
    (e) => {
      if (!current) return
      if (e.key === 'Enter') {
        e.preventDefault()
        if (revealed) advance()
        else check()
        return
      }
      const n = Number(e.key)
      if (!revealed && n >= 1 && n <= current.options.length) setChosen((c) => toggleChoice(c, n - 1, isMulti(current)))
      if (!revealed && e.key === 's') setConfidence('sure')
      if (!revealed && e.key === 'u') setConfidence('unsure')
      if (!revealed && e.key === 'g') setConfidence('guess')
    },
    [current, revealed, check, advance],
  )

  if (!set) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Drill" description="Short sets with the reasoning right after each answer. Attack one domain or one lecture at a time." />
        <Card>
          <CardContent className="grid gap-5">
            <Field label="Domain">
              <DomainPicker value={domain} onChange={(v) => { setDomain(v); syncParams(v, lecture) }} />
            </Field>
            <Field label="Lecture">
              <LecturePicker value={lecture} onChange={(v) => { setLecture(v); syncParams(domain, v) }} />
            </Field>
            <Field label="Length">
              <ToggleGroup type="single" variant="outline" size="sm" value={String(count)} onValueChange={(v) => v && setCount(Number(v))}>
                {[5, 10, 20, 40].map((c) => <ToggleGroupItem key={c} value={String(c)}>{c}</ToggleGroupItem>)}
              </ToggleGroup>
            </Field>
            <Field label="Scope">
              <Label className="flex items-center gap-2 text-sm font-normal">
                <Checkbox checked={unseen} onCheckedChange={(v) => setUnseen(v === true)} />
                Only questions I haven't seen
              </Label>
            </Field>
          </CardContent>
          <CardFooter className="justify-between border-t">
            <span className="text-sm text-muted-foreground">{pool.length} match</span>
            <Button disabled={!pool.length} onClick={start}>Start</Button>
          </CardFooter>
        </Card>
        {!pool.length && (
          <div className="mt-4">
            <Nothing title="Nothing matches">Loosen the filters, or untick "only unseen".</Nothing>
          </div>
        )}
      </div>
    )
  }

  if (!current) {
    const right = log.filter((l) => l.ok).length
    const p = Math.round((right / log.length) * 100)
    const missed = log.filter((l) => !l.ok)
    const confidentWrong = missed.filter((l) => l.confidence === 'sure').length
    const avg = Math.round(log.reduce((a, l) => a + l.seconds, 0) / log.length)
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={`${right} of ${log.length} correct`} description={p >= 85 ? 'Solid. Move on.' : p >= 72 ? 'Around the pass line. Work the misses before adding new material.' : 'Below the pass line. Re-read the lectures behind the misses rather than doing more questions.'} />
        <p className="-mt-6 mb-6 text-sm text-muted-foreground">
          {fmtSeconds(avg)} per question on average{confidentWrong ? ` · ${confidentWrong} answered "sure" and wrong — those first` : ''}.
        </p>
        <div className="flex gap-2">
          <Button onClick={start}>Another {count}</Button>
          <Button variant="outline" onClick={() => setSet(null)}>Change filters</Button>
          <Button asChild variant="ghost"><Link to="/mistakes">Mistake log</Link></Button>
        </div>
        {missed.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-2 text-sm font-medium">Missed</h2>
            <div className="overflow-hidden rounded-2xl border">
              {missed.map(({ q, confidence: c }) => (
                <Link key={q.id} to={questionHref(q)} className="flex items-start gap-3 border-b px-4 py-3 text-sm transition-colors last:border-b-0 hover:bg-muted/50">
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{lectureNo(q.lecture)}</span>
                  <span className="line-clamp-2 text-muted-foreground">{q.stem}</span>
                  {c === 'sure' && <span className="ml-auto shrink-0 text-xs text-bad">sure</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const rightSoFar = log.filter((l) => l.ok).length
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-4 text-sm">
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setSet(null)}>End</button>
        <Meter value={i / set.length} className="flex-1" />
        <span className="text-muted-foreground tabular-nums">{i + 1}/{set.length} · {rightSoFar} right · {fmtSeconds(elapsed)}</span>
      </div>

      <Card key={current.id} className="rise">
        <CardContent>
          <QuestionView q={current!} chosen={chosen} revealed={revealed} onToggle={(idx) => setChosen((c) => toggleChoice(c, idx, isMulti(current!)))} />
          {!revealed && chosen.length > 0 && (
            <div className="rise mt-4">
              <ConfidencePicker value={confidence} onChange={setConfidence} />
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-between border-t">
          <span className="text-xs text-muted-foreground">
            {revealed ? <><Kbd>Enter</Kbd> next</> : <><Kbd>1</Kbd>–<Kbd>{current!.options.length}</Kbd> pick · <Kbd>Enter</Kbd> check</>}
          </span>
          {revealed ? (
            <Button onClick={advance}>{i + 1 === set.length ? 'Results' : 'Next'} <ArrowRight data-icon="inline-end" /></Button>
          ) : (
            <Button disabled={!chosen.length} onClick={check}>Check</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
