'use client'

import { useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/navigation'
import { domains, lectures, flashcards, banks, bankQuestions, exam, scaledScore, lectureNo } from '@/lib/content'
import { bankOf, type QuestionBank } from '@/lib/progress'
import { useStore, useMirror, resetProgress, exportStore, importStore, studyStreak, today } from '@/lib/store'
import { isDue } from '@/lib/srs'
import Readiness from '@/components/Readiness'
import { PageHeader, Stat, StatRow, Rows, Meter, Nothing, Choice } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogClose, AlertDialogPopup, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'

export default function Progress() {
  const store = useStore((s) => s)
  const mirror = useMirror()
  const fileRef = useRef<HTMLInputElement>(null)
  const [view, setView] = useState<QuestionBank>('original')

  // Results are read one bank at a time: easy practice must not flatter hard-mode readiness.
  const attempts = useMemo(
    () => store.attempts.filter((a) => bankOf(a) === view),
    [store.attempts, view],
  )
  const exams = useMemo(
    () => store.exams.filter((e) => bankOf(e) === view),
    [store.exams, view],
  )

  const stats = domains.map((d) => {
    const rel = attempts.filter((a) => a.domain === d.id)
    return { id: d.id, total: rel.length, correct: rel.filter((a) => a.correct).length }
  })

  const perLecture = useMemo(
    () =>
      lectures
        .map((l) => {
          const rel = attempts.filter((a) => a.lecture === l.id)
          const correct = rel.filter((a) => a.correct).length
          return { l, total: rel.length, correct, acc: rel.length ? correct / rel.length : 1 }
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => a.acc - b.acc),
    [attempts],
  )

  const days = useMemo(() => {
    const out: { key: string; n: number }[] = []
    const d = new Date()
    d.setDate(d.getDate() - 83)
    for (let i = 0; i < 84; i++) {
      const key = today(d)
      out.push({ key, n: store.activity[key] ?? 0 })
      d.setDate(d.getDate() + 1)
    }
    return out
  }, [store.activity])

  const rated = attempts.filter((a) => a.confidence)
  const calibration = (['sure', 'unsure', 'guess'] as const).map((c) => {
    const rel = rated.filter((a) => a.confidence === c)
    return { c, n: rel.length, acc: rel.length ? rel.filter((a) => a.correct).length / rel.length : null }
  })
  const timed = attempts.filter((a) => a.seconds != null)
  const avgSeconds = (mode: 'drill' | 'exam') => {
    const rel = timed.filter((a) => a.mode === mode)
    return rel.length ? Math.round(rel.reduce((x, a) => x + (a.seconds ?? 0), 0) / rel.length) : null
  }
  const total = attempts.length
  const acc = total ? attempts.filter((a) => a.correct).length / total : 0
  const dueCards = flashcards.filter((c) => isDue(store.cards[c.id])).length
  const maxDay = Math.max(1, ...days.map((w) => w.n))

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportStore()], { type: 'application/json' }))
    a.download = `aws-saa-progress-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Progress"
        description="Where you stand, and which lectures your wrong answers keep pointing at."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={download}>Export</Button>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Import</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try { importStore(await f.text()) } catch { alert('That file could not be read as a progress export.') }
                e.target.value = ''
              }}
            />
          </>
        }
      />

      <div className="mb-4">
        <Choice
          value={view}
          onChange={(v) => v && setView(v as QuestionBank)}
          options={banks.map((b) => ({ value: b.id, label: b.label }))}
        />
      </div>

      <StatRow>
        <Stat label="Accuracy" value={total ? `${Math.round(acc * 100)}%` : '—'} hint={total ? `≈ ${scaledScore(acc)} scaled` : 'no data yet'} />
        <Stat label="Answered" value={total} hint={`of ${bankQuestions(view).length}`} />
        <Stat label="Cards due" value={dueCards} hint={`${Object.keys(store.cards).length} started`} />
        <Stat label="Streak" value={studyStreak(store.activity)} hint="days" />
      </StatRow>

      <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader><CardTitle>All-time readiness</CardTitle></CardHeader>
          <CardContent><Readiness stats={stats} /></CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>Last 12 weeks</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
                {days.map((w) => (
                  <div
                    key={w.key}
                    title={`${w.key}: ${w.n}`}
                    className="size-2.5 rounded-[3px] bg-foreground"
                    style={{ opacity: w.n === 0 ? 0.06 : 0.25 + (w.n / maxDay) * 0.75 }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Calibration</CardTitle></CardHeader>
            <CardContent>
              {rated.length === 0 ? (
                <p className="text-sm text-muted-foreground">Rate how sure you are before checking in a drill, and this shows whether your confidence is worth anything.</p>
              ) : (
                <div className="grid gap-2 text-sm">
                  {calibration.map(({ c, n, acc }) => (
                    <div key={c} className="grid grid-cols-[72px_1fr_90px] items-center gap-3">
                      <span className="text-muted-foreground">{c === 'sure' ? 'Sure' : c === 'unsure' ? 'Think so' : 'Guessing'}</span>
                      <Meter value={acc ?? 0} color={c === 'sure' && acc != null && acc < 0.85 ? 'var(--bad)' : undefined} />
                      <span className="text-right text-xs text-muted-foreground tabular-nums">{acc == null ? '—' : `${Math.round(acc * 100)}%`} · {n}</span>
                    </div>
                  ))}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(() => {
                      const sure = calibration[0]
                      if (sure.n < 5) return 'Well-calibrated means "sure" lands near 90%+ and "guessing" near 25–50%.'
                      return sure.acc! < 0.85 ? `"Sure" is only ${Math.round(sure.acc! * 100)}% right — you are over-confident. Slow down on the qualifier before committing.` : '"Sure" holds up. Trust it in the exam and spend your time on the rest.'
                    })()}
                  </p>
                  {(avgSeconds('drill') != null || avgSeconds('exam') != null) && (
                    <p className="text-xs text-muted-foreground">
                      Pace: {avgSeconds('drill') != null && `${avgSeconds('drill')} s per drill question`}{avgSeconds('drill') != null && avgSeconds('exam') != null && ' · '}{avgSeconds('exam') != null && `${avgSeconds('exam')} s per exam question`} — the exam allows 120.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mock exams</CardTitle></CardHeader>
            <CardContent>
              {exams.length === 0 ? (
                <p className="text-sm text-muted-foreground">None yet. <Link to="/exam" className="underline underline-offset-4">Sit one</Link> after module 3.</p>
              ) : (
                <div className="grid gap-2">
                  {exams.slice().reverse().map((e, i) => {
                    const a = e.correct / e.total
                    const score = scaledScore(a)
                    const passed = score >= exam.passingScore
                    return (
                      <div key={i} className="grid grid-cols-[84px_1fr_90px] items-center gap-3 text-sm">
                        <span className="text-xs text-muted-foreground">{new Date(e.at).toLocaleDateString()}</span>
                        <Meter value={a} color={passed ? 'var(--good)' : 'var(--bad)'} />
                        <span className={cn('text-right tabular-nums', passed ? 'text-good' : 'text-bad')}>{score} · {e.correct}/{e.total}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium">Accuracy by lecture</h2>
        <p className="mt-0.5 mb-3 text-sm text-muted-foreground">Worst first. This is your re-reading order.</p>
        {perLecture.length === 0 ? (
          <Nothing title="Nothing measured yet">Answer some questions in a <Link to="/drill" className="underline underline-offset-4">drill</Link> first.</Nothing>
        ) : (
          <Rows>
            {perLecture.map(({ l, total, correct, acc }) => (
              <Link key={l.id} to={`/learn/${l.id}`} className="grid grid-cols-[28px_1fr_120px_56px] items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50">
                <span className="text-xs text-muted-foreground tabular-nums">{lectureNo(l.id)}</span>
                <span className="truncate">{l.title}</span>
                <Meter value={acc} color={acc >= 0.72 ? 'var(--good)' : acc >= 0.5 ? 'var(--domain-perf)' : 'var(--bad)'} />
                <span className="text-right text-xs text-muted-foreground tabular-nums">{correct}/{total}</span>
              </Link>
            ))}
          </Rows>
        )}
      </section>

      <section className="mt-10 border-t pt-5">
        <p className="mb-3 max-w-lg text-sm text-muted-foreground">
          Your progress is stored on your account, not in this browser.{' '}
          {mirror === 'error'
            ? 'The last save failed. Unsaved answers are held on this device until it succeeds — export a copy before clearing site data.'
            : mirror === 'conflict'
              ? 'Another device changed the same progress. Resolve that before relying on these numbers.'
              : mirror === 'saving'
                ? 'A save is in flight.'
                : 'Everything here is saved and will follow you to another browser.'}
        </p>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>Reset all progress</AlertDialogTrigger>
          <AlertDialogPopup>
            <AlertDialogHeader>
              <AlertDialogTitle>Erase everything?</AlertDialogTitle>
              <AlertDialogDescription>All attempts, card schedules, notes and exam history. Export first if you want a copy.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" />}>Keep</AlertDialogClose>
              <AlertDialogClose render={<Button variant="destructive" />} onClick={resetProgress}>Erase</AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogPopup>
        </AlertDialog>
      </section>
    </div>
  )
}
