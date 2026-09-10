'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@/lib/navigation'
import { ArrowLeft, ArrowRight, Flag } from 'lucide-react'
import {
  exam,
  domains,
  weightedDraw,
  sameSet,
  isMulti,
  banks,
  bankQuestions,
  bankVersion,
  findQuestion,
  scaledScore,
  shortDomain,
  lectureById,
  lectureNo,
  type Question,
  type DomainId,
} from '@/lib/content'
import {
  finishExam,
  setActiveExam,
  getStore,
  useStore,
  type Attempt,
  type ActiveExam,
} from '@/lib/store'
import { useHotkeys } from '@/lib/hotkeys'
import { useCountUp } from '@/lib/count-up'
import QuestionView from '@/components/QuestionView'
import Readiness from '@/components/Readiness'
import { toggleChoice } from '@/components/Filters'
import { PageHeader, QuietLink, Choice, Panel, StatRow, Stat } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import {
  Progress,
  ProgressIndicator,
  ProgressTrack,
} from '@/components/ui/progress'
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogPopup,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import type { QuestionBank } from '@/lib/progress'

type Session = ActiveExam

function BigScore({ score, passed }: { score: number; passed: boolean }) {
  const shown = useCountUp(score, 900)
  return <div className={cn('mono mt-3 text-7xl font-medium tracking-tighter', passed ? 'text-good' : 'text-foreground')}>{shown}</div>
}

const fmt = (s: number) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

export default function Exam() {
  const nav = useNavigate()
  const savedSession = useStore((s) => s.activeExam)
  const [session, setSession] = useState<Session | null>(
    () => getStore().activeExam,
  )
  const [i, setIndex] = useState(() => getStore().activeExam?.index ?? 0)
  const [phase, setPhase] = useState<'intro' | 'run' | 'review' | 'done'>(() =>
    getStore().activeExam ? 'run' : 'intro',
  )
  const [now, setNow] = useState(Date.now())
  const [confirming, setConfirming] = useState(false)
  const [pick, setPick] = useState<QuestionBank>('original')
  const shownAt = useRef(Date.now())
  const timeSpent = useRef<Record<string, number>>({})
  const [result, setResult] = useState<null | {
    correct: number
    total: number
    seconds: number
    byDomain: Record<string, { total: number; correct: number }>
    wrong: Question[]
  }>(null)
  const submitted = useRef(false)

  useEffect(() => {
    if (savedSession) {
      setSession(savedSession)
      setIndex(savedSession.index ?? 0)
      if (phase === 'intro') setPhase('run')
    } else if (phase === 'run' && !submitted.current) {
      setSession(null)
      setPhase('intro')
    }
  }, [savedSession, phase])

  useEffect(() => {
    if (phase !== 'run') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const qs = useMemo(
    () =>
      session
        ? session.ids
            .map(findQuestion)
            .filter((q): q is Question => !!q)
        : [],
    [session],
  )
  const remaining = session
    ? Math.round((session.startedAt + session.minutes * 60_000 - now) / 1000)
    : 0

  const persist = (s: Session) => {
    s = { ...s, time: timeSpent.current }
    setSession(s)
    setActiveExam(s)
  }

  const finish = useCallback(() => {
    if (!session || submitted.current) return
    submitted.current = true
    const byDomain: Record<string, { total: number; correct: number }> = {}
    domains.forEach((d) => (byDomain[d.id] = { total: 0, correct: 0 }))
    const wrong: Question[] = []
    const attempts: Attempt[] = []
    const finishedAt = Math.min(
      Date.now(),
      session.startedAt + session.minutes * 60_000,
    )
    let correct = 0
    const cur = qs[i]
    const spent = (id: string) =>
      (timeSpent.current[id] ?? 0) +
      (id === cur?.id ? Math.round((Date.now() - shownAt.current) / 1000) : 0)
    for (const qq of qs) {
      const chosen = session.answers[qq.id] ?? []
      const ok = chosen.length > 0 && sameSet(chosen, qq.correct)
      byDomain[qq.domain].total += 1
      if (ok) {
        byDomain[qq.domain].correct += 1
        correct += 1
      } else wrong.push(qq)
      attempts.push({
        id: `${session.id}:${qq.id}`,
        qid: qq.id,
        domain: qq.domain,
        lecture: qq.lecture,
        correct: ok,
        chosen,
        at: finishedAt,
        mode: 'exam',
        seconds: spent(qq.id),
        bank: session.bank ?? 'original',
        bankVersion: session.bankVersion ?? 0,
      })
    }
    const seconds = Math.round((finishedAt - session.startedAt) / 1000)
    finishExam(attempts, {
      id: session.id,
      at: finishedAt,
      total: qs.length,
      correct,
      seconds,
      byDomain,
      wrongIds: wrong.map((w) => w.id),
      bank: session.bank ?? 'original',
      bankVersion: session.bankVersion ?? 0,
    })
    setResult({ correct, total: qs.length, seconds, byDomain, wrong })
    setPhase('done')
    setConfirming(false)
    window.scrollTo({ top: 0 })
  }, [session, qs, i])

  useEffect(() => {
    if (phase === 'run' && session && remaining <= 0) finish()
  }, [phase, remaining, session, finish])

  const begin = (count: number, minutes: number) => {
    submitted.current = false
    timeSpent.current = {}
    persist({
      id: crypto.randomUUID(),
      index: 0,
      ids: weightedDraw(count, bankQuestions(pick)).map((q) => q.id),
      answers: {},
      flags: [],
      startedAt: Date.now(),
      minutes,
      bank: pick,
      bankVersion: bankVersion(pick),
    })
    setIndex(0)
    setPhase('run')
    setNow(Date.now())
  }

  const setI = (index: number) => {
    if (!session) return
    const current = qs[i]
    if (current)
      timeSpent.current[current.id] =
        (timeSpent.current[current.id] ?? 0) +
        Math.round((Date.now() - shownAt.current) / 1000)
    shownAt.current = Date.now()
    setIndex(index)
    persist({ ...session, index })
  }

  const q = qs[i]
  const chosen = (q && session?.answers[q.id]) ?? []

  useEffect(() => {
    shownAt.current = Date.now()
    if (session?.time)
      timeSpent.current = { ...session.time, ...timeSpent.current }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id, phase])

  const toggle = (idx: number) => {
    if (!session || !q) return
    persist({
      ...session,
      answers: {
        ...session.answers,
        [q.id]: toggleChoice(chosen, idx, isMulti(q)),
      },
    })
  }
  const toggleFlag = () => {
    if (!session || !q) return
    persist({
      ...session,
      flags: session.flags.includes(q.id)
        ? session.flags.filter((f) => f !== q.id)
        : [...session.flags, q.id],
    })
  }

  useHotkeys(
    (e) => {
      if (phase !== 'run' || !q || confirming) return
      if (e.key === 'ArrowLeft' && i > 0) setI(i - 1)
      if (e.key === 'ArrowRight' && i + 1 < qs.length) setI(i + 1)
      if (e.key === 'f') toggleFlag()
      const n = Number(e.key)
      if (n >= 1 && n <= q.options.length) toggle(n - 1)
    },
    [phase, q, i, qs.length, chosen, session, confirming],
  )

  if (phase === 'intro') {
    const pool = bankQuestions(pick)
    const full = Math.min(exam.questions, pool.length)
    const half = Math.min(30, pool.length)
    const quick = Math.min(15, pool.length)
    const facts: [string, string][] = [
      ['Questions', `${full}, drawn from ${pool.length}`],
      ['Time', `${exam.minutes} minutes, about 2 per question`],
      ['Mix', domains.map((d) => `${shortDomain(d.id)} ${d.weight}%`).join(' · ')],
      ['Pass', `${exam.passingScore} of ${exam.scaleMax}, scaled. No per-domain minimum`],
      ['Rules', 'Answer everything, flag doubts. No penalty for guessing.'],
    ]
    return (
      <div className="mx-auto max-w-2xl px-5 py-10 md:py-14">
        <QuietLink to="/" className="inline-flex items-center gap-1"><ArrowLeft className="size-3" /> Overview</QuietLink>
        <PageHeader
          className="mt-6"
          eyebrow="Timed"
          title="Mock exam"
          description="Timed. No feedback until you submit, full review at the end."
        />
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <Choice
              value={pick}
              onChange={(v) => v && setPick(v as QuestionBank)}
              options={banks.map((b) => ({ value: b.id, label: b.label }))}
            />
            <p className="mt-2.5 text-xs text-muted-foreground">
              {banks.find((b) => b.id === pick)?.blurb}
            </p>
          </div>
          <dl className="grid gap-3 px-5 py-4 text-[13px]">
            {facts.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[88px_1fr] gap-3">
                <dt className="eyebrow pt-0.5">{k}</dt>
                <dd className="leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2 border-t bg-muted/40 px-5 py-3">
            <Button onClick={() => begin(full, exam.minutes)}>
              Full <span className="mono opacity-70">{full}q · {exam.minutes}m</span>
            </Button>
            <Button variant="outline" onClick={() => begin(half, 60)}>
              Half <span className="mono text-muted-foreground">{half}q · 60m</span>
            </Button>
            <Button variant="outline" onClick={() => begin(quick, 30)}>
              Quick <span className="mono text-muted-foreground">{quick}q · 30m</span>
            </Button>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{exam.note}</p>
      </div>
    )
  }

  if (phase === 'done' && result) {
    const acc = result.correct / result.total
    const score = scaledScore(acc)
    const passed = score >= exam.passingScore
    const byLecture = Object.entries(
      result.wrong.reduce<Record<string, number>>((a, w) => ((a[w.lecture] = (a[w.lecture] ?? 0) + 1), a), {}),
    ).sort((a, b) => b[1] - a[1])
    return (
      <div className="mx-auto max-w-3xl px-5 py-10 md:py-14">
        <div className="mb-8">
          <div className={cn('eyebrow', passed ? 'text-good' : 'text-bad')}>{passed ? 'Pass' : 'Below the line'}</div>
          <BigScore score={score} passed={passed} />
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {passed
              ? 'Sit another in two days on a fresh draw. Two in a row is the real signal.'
              : 'Re-read the lectures behind the misses before the next one.'}
          </p>
        </div>

        <StatRow className="mb-3">
          <Stat label="Score" value={`${Math.round(acc * 100)}%`} hint={`${result.correct}/${result.total} correct`} />
          <Stat label="Pass mark" value={exam.passingScore} hint="scaled" />
          <Stat label="Time used" value={fmt(result.seconds)} />
          <Stat label="Per question" value={fmt(Math.round(result.seconds / result.total))} hint="exam allows 2:00" />
        </StatRow>

        <div className="grid gap-3 md:grid-cols-[272px_1fr]">
          <Panel title="By domain" bodyClassName="p-4 pt-5">
            <Readiness
              stats={domains.map((d) => ({
                id: d.id as DomainId,
                total: result.byDomain[d.id]?.total ?? 0,
                correct: result.byDomain[d.id]?.correct ?? 0,
              }))}
              hideScore
            />
          </Panel>
          <Panel title={`${result.wrong.length} missed`} hint="Re-read these, worst first." bodyClassName="p-0">
            {byLecture.length === 0 ? (
              <p className="p-4 text-[13px] text-muted-foreground">Nothing missed.</p>
            ) : (
              byLecture.map(([lec, n]) => (
                <Link
                  key={lec}
                  to={`/learn/${lec}`}
                  className="flex items-center justify-between gap-3 border-b px-4 py-2.5 text-[13px] transition-colors duration-100 last:border-b-0 hover:bg-accent/50"
                >
                  <span><span className="mono mr-2 text-xs text-faint-foreground">{lectureNo(lec)}</span>{lectureById[lec]?.title ?? lec}</span>
                  <span className="mono text-xs text-bad">{n}</span>
                </Link>
              ))
            )}
            <div className="flex flex-wrap gap-2 border-t bg-muted/40 px-4 py-2.5">
              <Button size="sm" onClick={() => setPhase('review')}>Review every question</Button>
              <Button render={<Link to="/mistakes" />} size="sm" variant="outline">Mistake log</Button>
              <Button render={<Link to="/" />} size="sm" variant="ghost" className="text-muted-foreground">Overview</Button>
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  if (phase === 'review' && session) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-10 md:py-14">
        <PageHeader
          eyebrow="Mock exam"
          title="Review"
          actions={
            <>
              <Button variant="outline" onClick={() => setPhase('done')}>Results</Button>
              <Button onClick={() => nav('/')}>Done</Button>
            </>
          }
        />
        <div className="grid gap-3">
          {qs.map((qq, n) => {
            const c = session.answers[qq.id] ?? []
            const ok = c.length > 0 && sameSet(c, qq.correct)
            return (
              <article key={qq.id} className="rounded-xl border bg-card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="mono text-xs text-muted-foreground">Q{n + 1}</span>
                  <span className={cn('eyebrow', ok ? 'text-good' : 'text-bad')}>{ok ? 'correct' : c.length ? 'wrong' : 'blank'}</span>
                  {timeSpent.current[qq.id] != null && (
                    <span className="mono ml-auto text-xs text-faint-foreground">{fmt(timeSpent.current[qq.id])}</span>
                  )}
                </div>
                <QuestionView q={qq} chosen={c} revealed onToggle={() => {}} />
              </article>
            )
          })}
        </div>
      </div>
    )
  }

  if (!session || !q) return null

  const answered = Object.values(session.answers).filter((a) => a.length).length
  const blank = qs.length - answered
  const low = remaining < 600
  const flagged = session.flags.includes(q.id)

  return (
    <div className="min-h-svh pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-2.5 text-[13px]">
          <span className="mono">
            <span className="font-medium">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-faint-foreground"> / {qs.length}</span>
          </span>
          <span className="mono text-xs text-muted-foreground">{answered} answered</span>
          <span className={cn('mono ml-auto text-base font-medium tracking-tight', low && 'text-bad')}>{fmt(remaining)}</span>
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Submit</Button>
        </div>
        <Progress value={(1 - remaining / (session.minutes * 60)) * 100} aria-label="Time used">
          <ProgressTrack className="h-px rounded-none bg-transparent">
            <ProgressIndicator className={cn('transition-[width] duration-1000 ease-linear', low && 'bg-bad')} />
          </ProgressTrack>
        </Progress>
      </header>

      <div className="mx-auto grid max-w-4xl gap-5 px-5 py-6 lg:grid-cols-[1fr_188px]">
        <div key={q.id} className="rise overflow-hidden rounded-xl border bg-card">
          <div className="p-5 sm:p-6">
            <QuestionView q={q} chosen={chosen} revealed={false} onToggle={toggle} showMeta={false} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-5 py-2.5">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
              <ArrowLeft /> Previous
            </Button>
            <Button variant={flagged ? 'secondary' : 'ghost'} size="sm" onClick={toggleFlag} aria-pressed={flagged} className={cn(!flagged && 'text-muted-foreground')}>
              <Flag className={cn(flagged && 'fill-current')} /> {flagged ? 'Flagged' : 'Flag'} <Kbd>f</Kbd>
            </Button>
            <Button size="sm" className="ml-auto" onClick={() => (i + 1 < qs.length ? setI(i + 1) : setConfirming(true))}>
              {i + 1 < qs.length ? <>Next <ArrowRight /></> : 'Finish'}
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-16 lg:self-start">
          <div className="grid grid-cols-8 gap-1 lg:grid-cols-5">
            {qs.map((qq, n) => {
              const done = (session.answers[qq.id] ?? []).length > 0
              const fl = session.flags.includes(qq.id)
              return (
                <button
                  key={qq.id}
                  type="button"
                  onClick={() => setI(n)}
                  aria-label={`Question ${n + 1}${done ? ', answered' : ''}${fl ? ', flagged' : ''}`}
                  className={cn(
                    'pressable mono relative flex h-7 items-center justify-center rounded-md border text-[11px]',
                    n === i
                      ? 'border-foreground bg-foreground text-background'
                      : done
                        ? 'border-border bg-muted text-foreground'
                        : 'border-border text-faint-foreground hover:border-border-strong hover:text-foreground',
                  )}
                >
                  {n + 1}
                  {fl && <span className="absolute top-1 right-1 size-1 rounded-full bg-(--domain-perf)" />}
                </button>
              )
            })}
          </div>
          <div className="mono mt-3 grid gap-1 text-[11px] text-muted-foreground">
            <div>{answered} answered</div>
            <div>{session.flags.length} flagged</div>
            <div className={cn(blank && 'text-bad')}>{blank} blank</div>
          </div>
        </aside>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit the exam?</AlertDialogTitle>
            <AlertDialogDescription>
              {blank > 0
                ? `${blank} question${blank === 1 ? ' is' : 's are'} still blank. There is no penalty for a wrong answer, so guess before submitting.`
                : 'Everything is answered. You can review afterwards.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              Keep working
            </AlertDialogClose>
            <AlertDialogClose render={<Button />} onClick={finish}>
              Submit
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  )
}
