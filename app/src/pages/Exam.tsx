import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Flag } from 'lucide-react'
import { exam, domains, weightedDraw, sameSet, isMulti, questions as bank, scaledScore, shortDomain, lectureById, lectureNo, type Question, type DomainId } from '@/lib/content'
import { recordAttempt, recordExam } from '@/lib/store'
import { useHotkeys } from '@/lib/hotkeys'
import QuestionView from '@/components/QuestionView'
import Readiness from '@/components/Readiness'
import { toggleChoice } from '@/components/Filters'
import { PageHeader, QuietLink } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Frame, FramePanel } from '@/components/ui/frame'
import { Kbd } from '@/components/ui/kbd'
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress'
import {
  AlertDialog, AlertDialogClose, AlertDialogPopup, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

const ACTIVE_KEY = 'saa.exam.active.v1'

interface Session {
  ids: string[]
  answers: Record<string, number[]>
  flags: string[]
  startedAt: number
  minutes: number
  time?: Record<string, number>
}

const fmt = (s: number) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

export default function Exam() {
  const nav = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<'intro' | 'run' | 'review' | 'done'>('intro')
  const [now, setNow] = useState(Date.now())
  const [confirming, setConfirming] = useState(false)
  const shownAt = useRef(Date.now())
  const timeSpent = useRef<Record<string, number>>({})
  const [result, setResult] = useState<null | { correct: number; total: number; seconds: number; byDomain: Record<string, { total: number; correct: number }>; wrong: Question[] }>(null)
  const submitted = useRef(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY)
      if (!raw) return
      const s = JSON.parse(raw) as Session
      if (Date.now() - s.startedAt < s.minutes * 60_000) {
        setSession(s)
        setPhase('run')
      } else localStorage.removeItem(ACTIVE_KEY)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (phase !== 'run') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const qs = useMemo(() => (session ? session.ids.map((id) => bank.find((q) => q.id === id)!).filter(Boolean) : []), [session])
  const remaining = session ? Math.round((session.startedAt + session.minutes * 60_000 - now) / 1000) : 0

  const persist = (s: Session) => {
    s = { ...s, time: timeSpent.current }
    setSession(s)
    try { localStorage.setItem(ACTIVE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
  }

  const finish = useCallback(() => {
    if (!session || submitted.current) return
    submitted.current = true
    const byDomain: Record<string, { total: number; correct: number }> = {}
    domains.forEach((d) => (byDomain[d.id] = { total: 0, correct: 0 }))
    const wrong: Question[] = []
    let correct = 0
    const cur = qs[i]
    const spent = (id: string) => (timeSpent.current[id] ?? 0) + (id === cur?.id ? Math.round((Date.now() - shownAt.current) / 1000) : 0)
    for (const qq of qs) {
      const chosen = session.answers[qq.id] ?? []
      const ok = chosen.length > 0 && sameSet(chosen, qq.correct)
      byDomain[qq.domain].total += 1
      if (ok) { byDomain[qq.domain].correct += 1; correct += 1 } else wrong.push(qq)
      recordAttempt({ qid: qq.id, domain: qq.domain, lecture: qq.lecture, correct: ok, chosen, at: Date.now(), mode: 'exam', seconds: spent(qq.id) })
    }
    const seconds = Math.round((Date.now() - session.startedAt) / 1000)
    recordExam({ at: Date.now(), total: qs.length, correct, seconds, byDomain, wrongIds: wrong.map((w) => w.id) })
    setResult({ correct, total: qs.length, seconds, byDomain, wrong })
    setPhase('done')
    setConfirming(false)
    localStorage.removeItem(ACTIVE_KEY)
    window.scrollTo({ top: 0 })
  }, [session, qs, i])

  useEffect(() => {
    if (phase === 'run' && session && remaining <= 0) finish()
  }, [phase, remaining, session, finish])

  const begin = (count: number, minutes: number) => {
    submitted.current = false
    persist({ ids: weightedDraw(count).map((q) => q.id), answers: {}, flags: [], startedAt: Date.now(), minutes })
    setI(0)
    setPhase('run')
    setNow(Date.now())
  }

  const q = qs[i]
  const chosen = (q && session?.answers[q.id]) ?? []

  useEffect(() => {
    shownAt.current = Date.now()
    if (session?.time) timeSpent.current = { ...session.time, ...timeSpent.current }
    return () => {
      if (!q) return
      timeSpent.current[q.id] = (timeSpent.current[q.id] ?? 0) + Math.round((Date.now() - shownAt.current) / 1000)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id, phase])

  const toggle = (idx: number) => {
    if (!session || !q) return
    persist({ ...session, answers: { ...session.answers, [q.id]: toggleChoice(chosen, idx, isMulti(q)) } })
  }
  const toggleFlag = () => {
    if (!session || !q) return
    persist({ ...session, flags: session.flags.includes(q.id) ? session.flags.filter((f) => f !== q.id) : [...session.flags, q.id] })
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
    const full = Math.min(exam.questions, bank.length)
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <QuietLink to="/"><ArrowLeft className="mr-1 inline size-3.5" />Overview</QuietLink>
        <PageHeader title="Mock exam" description="A countdown, no feedback until you submit, and a full review at the end. Questions are drawn to the exam's real domain weights." />
        <Frame>
          <FramePanel className="grid gap-3 text-sm">
            {[
              ['Questions', `${full}, drawn from ${bank.length}`],
              ['Time', `${exam.minutes} minutes — about 2 per question`],
              ['Mix', domains.map((d) => `${shortDomain(d.id)} ${d.weight}%`).join(' · ')],
              ['Pass', `${exam.passingScore} scaled, roughly 72% correct`],
              ['Rules', 'Flag what you are unsure of, answer everything, review at the end. No penalty for guessing.'],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[90px_1fr] gap-3">
                <span className="text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </FramePanel>
          <FramePanel className="flex flex-wrap gap-2 px-5 py-4">
            <Button onClick={() => begin(full, exam.minutes)}>Full · {full} q / {exam.minutes} min</Button>
            <Button variant="outline" onClick={() => begin(30, 60)}>Half · 30 q / 60 min</Button>
            <Button variant="outline" onClick={() => begin(15, 30)}>Quick · 15 q / 30 min</Button>
          </FramePanel>
        </Frame>
        <p className="mt-4 text-xs text-muted-foreground">{exam.note}</p>
      </div>
    )
  }

  if (phase === 'done' && result) {
    const acc = result.correct / result.total
    const score = scaledScore(acc)
    const passed = score >= exam.passingScore
    const byLecture = Object.entries(result.wrong.reduce<Record<string, number>>((a, w) => ((a[w.lecture] = (a[w.lecture] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1])
    return (
      <div className="mx-auto max-w-3xl px-5 py-12">
        <div className="mb-8">
          <div className={cn('text-xs font-medium', passed ? 'text-good' : 'text-bad')}>{passed ? 'Pass' : 'Below the line'}</div>
          <div className="mt-1 text-6xl font-semibold tracking-tight tabular-nums">{score}</div>
          <div className="mt-2 text-sm text-muted-foreground">
            {result.correct}/{result.total} correct · {Math.round(acc * 100)}% · {fmt(result.seconds)} used · {fmt(Math.round(result.seconds / result.total))} per question · pass mark {exam.passingScore}
          </div>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">
            {passed
              ? 'Sit another mock in two days on a fresh draw. Consistency across two is the real signal.'
              : 'Re-read the lectures behind the misses before another mock. A handful of confusions cause most of the loss.'}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Card>
            <CardHeader><CardTitle>By domain</CardTitle></CardHeader>
            <CardContent>
              <Readiness stats={domains.map((d) => ({ id: d.id as DomainId, total: result.byDomain[d.id]?.total ?? 0, correct: result.byDomain[d.id]?.correct ?? 0 }))} hideScore />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{result.wrong.length} missed — re-read these</CardTitle></CardHeader>
            <CardContent>
              {byLecture.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing missed.</p>
              ) : (
                <div className="-mx-2 grid gap-0.5">
                  {byLecture.map(([lec, n]) => (
                    <Link key={lec} to={`/learn/${lec}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                      <span><span className="mr-2 text-muted-foreground tabular-nums">{lectureNo(lec)}</span>{lectureById[lec]?.title ?? lec}</span>
                      <span className="text-bad tabular-nums">{n}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-wrap gap-2 border-t">
              <Button onClick={() => setPhase('review')}>Review every question</Button>
              <Button render={<Link to="/mistakes" />} variant="outline">Mistake log</Button>
              <Button render={<Link to="/" />} variant="ghost">Overview</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (phase === 'review' && session) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-12">
        <PageHeader
          title="Review"
          actions={<><Button variant="outline" onClick={() => setPhase('done')}>Results</Button><Button onClick={() => nav('/')}>Done</Button></>}
        />
        <div className="grid gap-4">
          {qs.map((qq, n) => {
            const c = session.answers[qq.id] ?? []
            const ok = c.length > 0 && sameSet(c, qq.correct)
            return (
              <Card key={qq.id}>
                <CardContent>
                  <div className="mb-3 flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Q{n + 1}</span>
                    <span className={ok ? 'text-good' : 'text-bad'}>{ok ? 'correct' : c.length ? 'wrong' : 'blank'}</span>
                    {timeSpent.current[qq.id] != null && <span className="ml-auto text-muted-foreground tabular-nums">{fmt(timeSpent.current[qq.id])}</span>}
                  </div>
                  <QuestionView q={qq} chosen={c} revealed onToggle={() => {}} />
                </CardContent>
              </Card>
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
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-5 py-2.5 text-sm">
          <span>Question <span className="font-medium tabular-nums">{i + 1}</span> <span className="text-muted-foreground">/ {qs.length}</span></span>
          <span className="text-muted-foreground tabular-nums">{answered} answered</span>
          <span className={cn('ml-auto text-base font-medium tabular-nums', low && 'text-bad')}>{fmt(remaining)}</span>
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Submit</Button>
        </div>
        <Progress value={(1 - remaining / (session.minutes * 60)) * 100} aria-label="Time used">
          <ProgressTrack className="h-0.5 rounded-none bg-transparent">
            <ProgressIndicator className={cn(low && 'bg-bad')} />
          </ProgressTrack>
        </Progress>
      </header>

      <div className="mx-auto grid max-w-4xl gap-5 px-5 py-6 lg:grid-cols-[1fr_180px]">
        <Card key={q.id} className="rise">
          <CardContent>
            <QuestionView q={q} chosen={chosen} revealed={false} onToggle={toggle} showMeta={false} />
          </CardContent>
          <CardFooter className="flex-wrap gap-2 border-t">
            <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}><ArrowLeft /> Previous</Button>
            <Button variant={flagged ? 'secondary' : 'ghost'} size="sm" onClick={toggleFlag} aria-pressed={flagged}>
              <Flag className={cn(flagged && 'fill-current')} /> {flagged ? 'Flagged' : 'Flag'} <Kbd>f</Kbd>
            </Button>
            <Button size="sm" className="ml-auto" onClick={() => (i + 1 < qs.length ? setI(i + 1) : setConfirming(true))}>
              {i + 1 < qs.length ? <>Next <ArrowRight /></> : 'Finish'}
            </Button>
          </CardFooter>
        </Card>

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
                    'relative flex h-7 items-center justify-center rounded-md border text-xs tabular-nums transition-colors',
                    n === i ? 'border-foreground bg-foreground text-background' : done ? 'bg-muted' : 'text-muted-foreground',
                  )}
                >
                  {n + 1}
                  {fl && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-[var(--domain-perf)]" />}
                </button>
              )
            })}
          </div>
          <div className="mt-3 grid gap-0.5 text-xs text-muted-foreground tabular-nums">
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
            <AlertDialogClose render={<Button variant="outline" />}>Keep working</AlertDialogClose>
            <AlertDialogClose render={<Button />} onClick={finish}>Submit</AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  )
}
