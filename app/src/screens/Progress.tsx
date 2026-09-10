'use client'

import { useMemo, useRef, useState } from 'react'
import { Link } from '@/lib/navigation'
import { domains, lectures, flashcards, banks, bankQuestions, exam, scaledScore, lectureNo } from '@/lib/content'
import { bankOf, type QuestionBank } from '@/lib/progress'
import { useStore, useMirror, resetProgress, exportStore, importStore, studyStreak, today, setDailyGoal } from '@/lib/store'
import { achievements, bestStreak, levelFor, levelLabel, levelThreshold, totalXp, xpPerDay, LEVELS } from '@/lib/game'
import { GoalRing, LevelMeter, fmtXp } from '@/components/Game'
import { Lock, Award } from 'lucide-react'
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
  const xp = useMemo(() => totalXp(store), [store])
  const level = levelFor(xp)
  const perDay = useMemo(() => xpPerDay(store), [store])
  const earnedToday = perDay[today()] ?? 0
  const goalDays = days.filter((w) => (perDay[w.key] ?? 0) >= store.dailyGoal).length
  const badges = useMemo(() => achievements(store), [store])
  const unlocked = badges.filter((b) => b.unlocked).length
  const groups = [
    { id: 'milestones', title: 'Milestones' },
    { id: 'streaks', title: 'Streaks and runs' },
    { id: 'mastery', title: 'Mastery' },
  ] as const

  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([exportStore()], { type: 'application/json' }))
    a.download = `aws-saa-progress-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const sure = calibration[0]
  const calibrationNote = sure.n < 5
    ? 'Calibrated means "sure" lands near 90% and "guessing" near 25–50%.'
    : sure.acc! < 0.85
      ? `"Sure" is only ${Math.round(sure.acc! * 100)}% right. Slow down on the qualifier.`
      : '"Sure" holds up. Trust it and spend the time elsewhere.'

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
        <Stat label="Streak" value={studyStreak(store.activity)} hint={`days · best ${bestStreak(store.activity)}`} />
      </StatRow>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title={levelLabel(level)} hint={level.next ? `${fmtXp(level.span - level.into)} xp to ${level.next}` : 'Top of the ladder.'} action={<span className="mono text-xs text-muted-foreground">{fmtXp(xp)} xp</span>}>
          <LevelMeter level={level} />
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {LEVELS.map((name, i) => (
              <span key={name} className={cn('mono text-[11px]', i < level.index ? 'text-muted-foreground line-through decoration-border-strong' : i === level.index ? 'text-foreground' : 'text-faint-foreground')} title={`${fmtXp(levelThreshold(i))} xp`}>
                {name}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="Daily goal" hint={`${goalDays} of the last 84 days hit it`} action={
          <Choice
            value={String(store.dailyGoal)}
            onChange={(v) => v && setDailyGoal(Number(v))}
            options={[50, 100, 200, 300].map((n) => ({ value: String(n), label: <span className="mono">{n}</span> }))}
          />
        }>
          <div className="flex items-center gap-4">
            <GoalRing value={earnedToday / store.dailyGoal} size={48}>
              <span className="mono text-[10px] text-muted-foreground">{Math.min(999, Math.round((earnedToday / store.dailyGoal) * 100))}%</span>
            </GoalRing>
            <div className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="mono text-foreground">{fmtXp(earnedToday)}</span> of <span className="mono">{fmtXp(store.dailyGoal)}</span> xp today.
              A right answer is 10, a card 4, a lecture 50, a mock 100.
            </div>
          </div>
        </Panel>
      </div>

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
              <p className="text-[13px] leading-relaxed text-muted-foreground">Rate how sure you are in drills and this fills in.</p>
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
              <p className="text-[13px] text-muted-foreground">None yet. <Link to="/exam" className="underline underline-offset-4">Sit one</Link>.</p>
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
        <SectionTitle hint={`${unlocked} of ${badges.length} unlocked.`}>Achievements</SectionTitle>
        <div className="grid gap-3">
          {groups.map((g) => (
            <Rows key={g.id} className="grid grid-cols-1 *:border-b sm:grid-cols-2 sm:*:border-r sm:*:nth-[2n]:border-r-0 sm:*:nth-last-[-n+2]:border-b-0 lg:grid-cols-3 lg:*:nth-[2n]:border-r lg:*:nth-[3n]:border-r-0 lg:*:nth-last-[-n+2]:border-b lg:*:nth-last-[-n+3]:border-b-0">
              {badges.filter((b) => b.group === g.id).map((b) => (
                <div key={b.id} className={cn('flex items-start gap-3 px-4 py-3', !b.unlocked && 'text-muted-foreground')}>
                  <span className={cn('mt-0.5 grid size-6 shrink-0 place-items-center rounded-full', b.unlocked ? 'bg-foreground text-background' : 'border border-dashed border-border-strong text-faint-foreground')}>
                    {b.unlocked ? <Award className="size-3.5" /> : <Lock className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium tracking-tight">{b.title}</span>
                    <span className="block text-xs text-muted-foreground">{b.how}</span>
                  </span>
                </div>
              ))}
            </Rows>
          ))}
        </div>
      </section>

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
          Saved to your account.{' '}
          {mirror === 'error'
            ? 'The last save failed. Unsaved answers stay on this device until it succeeds. Export a copy first.'
            : mirror === 'conflict'
              ? 'Another device changed the same progress. Resolve that before relying on these numbers.'
              : mirror === 'saving'
                ? 'A save is in flight.'
                : 'It follows you to any browser.'}
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
