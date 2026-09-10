'use client'

import { useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/navigation'
import { domains, lectures, flashcards, banks, bankQuestions, exam, scaledScore, lectureNo } from '@/lib/content'
import { bankOf, type QuestionBank } from '@/lib/progress'
import { useStore, useMirror, resetProgress, exportStore, importStore, studyStreak, today } from '@/lib/store'
import { isDue } from '@/lib/srs'
import Readiness from '@/components/Readiness'
import { PageHeader, Stat, StatRow, Rows, Meter, Nothing, Choice, Panel, SectionTitle } from '@/components/parts'
import { Button } from '@/components/ui/button'
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
  const attempts = useMemo(() => store.attempts.filter((a) => bankOf(a) === view), [store.attempts, view])
  const exams = useMemo(() => store.exams.filter((e) => bankOf(e) === view), [store.exams, view])

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
  const activeDays = days.filter((w) => w.n > 0).length

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportStore()], { type: 'application/json' }))
    a.download = `aws-saa-progress-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const sure = calibration[0]
  const calibrationNote = sure.n < 5
    ? 'Well-calibrated means "sure" lands near 90%+ and "guessing" near 25–50%.'
    : sure.acc! < 0.85
      ? `"Sure" is only ${Math.round(sure.acc! * 100)}% right. You are over-confident: slow down on the qualifier before committing.`
      : '"Sure" holds up. Trust it in the exam and spend your time on the rest.'

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Progress"
        description="Where you stand, and which lectures your wrong answers keep pointing at."
        actions={
          <>
            <Choice
              value={view}
              onChange={(v) => v && setView(v as QuestionBank)}
              options={banks.map((b) => ({ value: b.id, label: b.label }))}
            />
            <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
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

      <StatRow>
        <Stat label="Accuracy" value={total ? `${Math.round(acc * 100)}%` : '—'} hint={total ? `≈ ${scaledScore(acc)} scaled` : 'no data yet'} tone={total ? (acc >= 0.72 ? 'good' : 'bad') : undefined} />
        <Stat label="Answered" value={total} hint={`of ${bankQuestions(view).length}`} />
        <Stat label="Cards due" value={dueCards} hint={`${Object.keys(store.cards).length} started`} />
        <Stat label="Streak" value={studyStreak(store.activity)} hint="days" />
      </StatRow>

      <div className="mt-3 grid gap-3 md:grid-cols-[272px_1fr]">
        <Panel title="All-time readiness" bodyClassName="p-4 pt-5">
          <Readiness stats={stats} />
        </Panel>

        <div className="grid content-start gap-3">
          <Panel title="Last 12 weeks" hint={`${activeDays} active day${activeDays === 1 ? '' : 's'}`}>
            <div className="grid w-fit grid-flow-col grid-rows-7 gap-[3px]">
              {days.map((w) => (
                <div
                  key={w.key}
                  title={`${w.key}: ${w.n}`}
                  className={cn('size-2.5 rounded-[2px]', w.n === 0 ? 'bg-muted' : 'bg-foreground')}
                  style={w.n ? { opacity: 0.3 + (w.n / maxDay) * 0.7 } : undefined}
                />
              ))}
            </div>
          </Panel>

          <Panel title="Calibration" hint="Whether your confidence is worth anything.">
            {rated.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">Rate how sure you are before checking in a drill, and this shows whether your confidence is worth anything.</p>
            ) : (
              <div className="grid gap-2.5">
                {calibration.map(({ c, n, acc }) => (
                  <div key={c} className="grid grid-cols-[72px_1fr_90px] items-center gap-3 text-[13px]">
                    <span className="text-muted-foreground">{c === 'sure' ? 'Sure' : c === 'unsure' ? 'Think so' : 'Guessing'}</span>
                    <Meter value={acc ?? 0} color={c === 'sure' && acc != null && acc < 0.85 ? 'var(--bad)' : undefined} />
                    <span className="mono text-right text-xs text-muted-foreground">{acc == null ? '—' : `${Math.round(acc * 100)}%`} · {n}</span>
                  </div>
                ))}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{calibrationNote}</p>
                {(avgSeconds('drill') != null || avgSeconds('exam') != null) && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Pace: {avgSeconds('drill') != null && <span className="mono">{avgSeconds('drill')}s</span>}{avgSeconds('drill') != null && ' per drill question'}{avgSeconds('drill') != null && avgSeconds('exam') != null && ' · '}{avgSeconds('exam') != null && <span className="mono">{avgSeconds('exam')}s</span>}{avgSeconds('exam') != null && ' per exam question'}. The exam allows 120.
                  </p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Mock exams" bodyClassName={exams.length ? 'p-0' : undefined}>
            {exams.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">None yet. <Link to="/exam" className="underline underline-offset-4">Sit one</Link> after module 3.</p>
            ) : (
              exams.slice().reverse().map((e, i) => {
                const a = e.correct / e.total
                const score = scaledScore(a)
                const passed = score >= exam.passingScore
                return (
                  <div key={i} className="grid grid-cols-[84px_1fr_96px] items-center gap-3 border-b px-4 py-2.5 text-[13px] last:border-b-0">
                    <span className="mono text-xs text-muted-foreground">{new Date(e.at).toLocaleDateString()}</span>
                    <Meter value={a} color={passed ? 'var(--good)' : 'var(--bad)'} />
                    <span className={cn('mono text-right text-xs', passed ? 'text-good' : 'text-bad')}>{score} · {e.correct}/{e.total}</span>
                  </div>
                )
              })
            )}
          </Panel>
        </div>
      </div>

      <section className="mt-10">
        <SectionTitle hint="Worst first. This is your re-reading order.">Accuracy by lecture</SectionTitle>
        {perLecture.length === 0 ? (
          <Nothing title="Nothing measured yet">Answer some questions in a <Link to="/drill" className="underline underline-offset-4">drill</Link> first.</Nothing>
        ) : (
          <Rows>
            {perLecture.map(({ l, total, correct, acc }) => (
              <Link key={l.id} to={`/learn/${l.id}`} className="grid grid-cols-[28px_1fr_120px_56px] items-center gap-3 px-4 py-2.5 text-[13px] transition-colors duration-100 hover:bg-accent/50">
                <span className="mono text-xs text-faint-foreground">{lectureNo(l.id)}</span>
                <span className="truncate">{l.title}</span>
                <Meter value={acc} color={acc >= 0.72 ? 'var(--good)' : acc >= 0.5 ? 'var(--domain-perf)' : 'var(--bad)'} />
                <span className="mono text-right text-xs text-muted-foreground">{correct}/{total}</span>
              </Link>
            ))}
          </Rows>
        )}
      </section>

      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t pt-6">
        <p className="max-w-lg text-[13px] leading-relaxed text-muted-foreground">
          Progress is stored on your account, not in this browser.{' '}
          {mirror === 'error'
            ? 'The last save failed. Unsaved answers are held on this device until it succeeds. Export a copy before clearing site data.'
            : mirror === 'conflict'
              ? 'Another device changed the same progress. Resolve that before relying on these numbers.'
              : mirror === 'saving'
                ? 'A save is in flight.'
                : 'Everything here is saved and will follow you to another browser.'}
        </p>
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive-outline" size="sm" />}>Reset all progress</AlertDialogTrigger>
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
