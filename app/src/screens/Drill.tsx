'use client'
import { useMemo, useState, useCallback } from 'react'
import { Link, useSearchParams } from '@/lib/navigation'
import { ArrowRight } from 'lucide-react'
import {
  banks,
  bankQuestions,
  bankVersion,
  findQuestion,
  shuffle,
  sameSet,
  isMulti,
  lectureNo,
  questionHref,
  type Question,
  type DomainId,
} from '@/lib/content'
import type { QuestionBank } from '@/lib/progress'
import {
  recordDrillAttempt,
  setActiveDrill,
  getStore,
  useStore,
  type Confidence,
  type ActiveDrill,
} from '@/lib/store'
import { ConfidencePicker, useTicker, fmtSeconds } from '@/components/Confidence'
import { useHotkeys } from '@/lib/hotkeys'
import QuestionView from '@/components/QuestionView'
import { Field, DomainPicker, LecturePicker, toggleChoice } from '@/components/Filters'
import { PageHeader, Nothing, Meter, Rows, Choice, StatRow, Stat, SectionTitle } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Kbd } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

export default function Drill() {
  const [params, setParams] = useSearchParams()
  const attempts = useStore((s) => s.attempts)

  const [domain, setDomain] = useState<DomainId | 'all'>((params.get('domain') as DomainId) ?? 'all')
  const [lecture, setLecture] = useState(params.get('lecture') ?? 'all')
  const [bank, setBank] = useState<QuestionBank>(params.get('bank') === 'v2' ? 'v2' : 'original')
  const [count, setCount] = useState(10)
  const [unseen, setUnseen] = useState(false)

  const active = useStore((s) => s.activeDrill)
  const activeIds = active?.ids
  const set = useMemo(
    () => (activeIds ? activeIds.map(findQuestion).filter((q): q is Question => !!q) : null),
    [activeIds],
  )
  const i = active?.index ?? 0
  const chosen = active?.chosen ?? []
  const revealed = active?.revealed ?? false
  const confidence = active?.confidence
  const shownAt = active?.shownAt ?? Date.now()
  const log = useMemo(
    () =>
      (active?.log ?? []).flatMap((item) => {
        const q = findQuestion(item.qid)
        return q ? [{ ...item, q }] : []
      }),
    [active?.log],
  )
  const edit = (fn: (s: ActiveDrill) => ActiveDrill) => {
    const current = getStore().activeDrill
    if (current) setActiveDrill(fn(current))
  }
  const setChosen = (fn: (c: number[]) => number[]) => edit((s) => ({ ...s, chosen: fn(s.chosen) }))
  const setConfidence = (value: Confidence | undefined) => edit((s) => ({ ...s, confidence: value }))
  const setSet = (_value: null) => setActiveDrill(null)

  const seen = useMemo(() => new Set(attempts.map((a) => a.qid)), [attempts])
  const elapsed = useTicker(shownAt, !!set && !revealed)
  const pool = useMemo(
    () =>
      bankQuestions(bank).filter(
        (q) =>
          (domain === 'all' || q.domain === domain) &&
          (lecture === 'all' || q.lecture === lecture) &&
          (!unseen || !seen.has(q.id)),
      ),
    [bank, domain, lecture, unseen, seen],
  )

  const syncParams = (d: DomainId | 'all', l: string, b: QuestionBank) => {
    const p = new URLSearchParams()
    if (d !== 'all') p.set('domain', d)
    if (l !== 'all') p.set('lecture', l)
    if (b !== 'original') p.set('bank', b)
    setParams(p, { replace: true })
  }

  const start = () => {
    setActiveDrill({
      id: crypto.randomUUID(),
      ids: shuffle(pool).slice(0, count).map((q) => q.id),
      index: 0,
      chosen: [],
      revealed: false,
      shownAt: Date.now(),
      log: [],
      domain,
      lecture,
      count,
      unseen,
      bank,
      bankVersion: bankVersion(bank),
    })
  }

  const current = set?.[i]

  const check = useCallback(() => {
    const session = getStore().activeDrill
    if (!current || !session || session.revealed || !session.chosen.length) return
    const ok = sameSet(session.chosen, current.correct)
    const seconds = Math.round((Date.now() - session.shownAt) / 1000)
    recordDrillAttempt(
      {
        id: `${session.id}:${current.id}`,
        qid: current.id,
        domain: current.domain,
        lecture: current.lecture,
        correct: ok,
        chosen: session.chosen,
        at: Date.now(),
        mode: 'drill',
        confidence: session.confidence,
        seconds,
        bank: session.bank ?? 'original',
        bankVersion: session.bankVersion ?? 0,
      },
      {
        ...session,
        revealed: true,
        log: [...session.log, { qid: current.id, ok, confidence: session.confidence, seconds }],
      },
    )
  }, [current])

  const advance = useCallback(() => {
    const session = getStore().activeDrill
    if (!session) return
    setActiveDrill({
      ...session,
      index: session.index + 1,
      chosen: [],
      revealed: false,
      confidence: undefined,
      shownAt: Date.now(),
    })
    window.scrollTo({ top: 0 })
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
        <PageHeader
          title="Drill"
          description="Short sets with the reasoning right after each answer. Attack one domain or one lecture at a time."
        />
        <div className="overflow-hidden rounded-xl border bg-card">
          <Field label="Bank">
            <Choice
              value={bank}
              onChange={(v) => {
                if (!v) return
                const next = v as QuestionBank
                setBank(next)
                syncParams(domain, lecture, next)
              }}
              options={banks.map((b) => ({ value: b.id, label: b.label }))}
            />
            <p className="basis-full text-xs text-muted-foreground sm:basis-auto">{banks.find((b) => b.id === bank)?.blurb}</p>
          </Field>
          <Field label="Domain">
            <DomainPicker value={domain} onChange={(v) => { setDomain(v); syncParams(v, lecture, bank) }} />
          </Field>
          <Field label="Lecture">
            <LecturePicker value={lecture} onChange={(v) => { setLecture(v); syncParams(domain, v, bank) }} />
          </Field>
          <Field label="Length">
            <Choice
              value={String(count)}
              onChange={(v) => v && setCount(Number(v))}
              options={[5, 10, 20, 40].map((c) => ({ value: String(c), label: <span className="mono">{c}</span> }))}
            />
          </Field>
          <Field label="Scope">
            <Label className="flex items-center gap-2 text-[13px] font-normal">
              <Checkbox checked={unseen} onCheckedChange={(v) => setUnseen(v === true)} />
              Only questions I haven't seen
            </Label>
          </Field>
          <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-3">
            <span className="mono text-xs text-muted-foreground">{pool.length} match</span>
            <Button disabled={!pool.length} onClick={start}>Start</Button>
          </div>
        </div>
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
    const verdict = p >= 85 ? 'Solid. Move on.' : p >= 72 ? 'Around the pass line. Work the misses before adding new material.' : 'Below the pass line. Re-read the lectures behind the misses rather than doing more questions.'
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Set complete"
          title={<><span className={cn('mono', p >= 72 ? 'text-good' : 'text-bad')}>{right}</span><span className="text-faint-foreground"> / {log.length}</span> correct</>}
          description={verdict}
        />
        <StatRow className="grid-cols-3 sm:grid-cols-3">
          <Stat label="Accuracy" value={`${p}%`} tone={p >= 72 ? 'good' : 'bad'} />
          <Stat label="Per question" value={fmtSeconds(avg)} hint="exam allows 2:00" />
          <Stat label="Sure, wrong" value={confidentWrong} hint={confidentWrong ? 'those first' : 'none'} tone={confidentWrong ? 'bad' : undefined} />
        </StatRow>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={start}>Another {count}</Button>
          <Button variant="outline" onClick={() => setSet(null)}>Change filters</Button>
          <Button render={<Link to="/mistakes" />} variant="ghost" className="text-muted-foreground">Mistake log</Button>
        </div>
        {missed.length > 0 && (
          <div className="mt-10">
            <SectionTitle>Missed</SectionTitle>
            <Rows>
              {missed.map(({ q, confidence: c }) => (
                <Link key={q.id} to={questionHref(q)} className="flex items-start gap-3 px-4 py-3 text-[13px] transition-colors duration-100 hover:bg-accent/50">
                  <span className="mono mt-0.5 shrink-0 text-xs text-faint-foreground">{lectureNo(q.lecture)}</span>
                  <span className="line-clamp-2 text-muted-foreground">{q.stem}</span>
                  {c === 'sure' && <span className="eyebrow ml-auto mt-0.5 shrink-0 text-bad">sure</span>}
                </Link>
              ))}
            </Rows>
          </div>
        )}
      </div>
    )
  }

  const rightSoFar = log.filter((l) => l.ok).length
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <button type="button" className="pressable text-[13px] text-muted-foreground hover:text-foreground" onClick={() => setSet(null)}>End</button>
        <Meter value={i / set.length} className="flex-1" />
        <span className="mono text-xs text-muted-foreground">
          {i + 1}/{set.length} · {rightSoFar} right · {fmtSeconds(elapsed)}
        </span>
      </div>

      <div key={current.id} className="rise overflow-hidden rounded-xl border bg-card">
        <div className="p-5 sm:p-6">
          <QuestionView
            q={current}
            chosen={chosen}
            revealed={revealed}
            onToggle={(idx) => setChosen((c) => toggleChoice(c, idx, isMulti(current)))}
          />
          {!revealed && chosen.length > 0 && (
            <div className="rise mt-5">
              <ConfidencePicker value={confidence} onChange={setConfidence} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-muted/40 px-5 py-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {revealed ? (
              <><Kbd>↵</Kbd> next</>
            ) : (
              <><Kbd>1</Kbd>–<Kbd>{current.options.length}</Kbd> pick <span className="mx-1 text-faint-foreground">·</span> <Kbd>↵</Kbd> check</>
            )}
          </span>
          {revealed ? (
            <Button onClick={advance}>
              {i + 1 === set.length ? 'Results' : 'Next'} <ArrowRight />
            </Button>
          ) : (
            <Button disabled={!chosen.length} onClick={check}>Check</Button>
          )}
        </div>
      </div>
    </div>
  )
}
