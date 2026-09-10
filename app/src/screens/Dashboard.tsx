'use client'

import { Link } from '@/lib/navigation'
import { ArrowRight, ArrowUpRight, Flame } from 'lucide-react'
import { useStore, studyStreak } from '@/lib/store'
import { isDue } from '@/lib/srs'
import { lectures, modules, flashcards, domains, exam, lectureNo, scaledScore, shortDomain, bankById } from '@/lib/content'
import { bankOf } from '@/lib/progress'
import Readiness, { type DomainStat } from '@/components/Readiness'
import { PageHeader, Stat, StatRow, Meter, Panel, DomainDot } from '@/components/parts'
import { TodayPanel } from '@/components/Game'
import { cn } from '@/lib/utils'

export default function Dashboard() {
  const store = useStore((s) => s)
  const streak = studyStreak(store.activity)

  // The dial estimates a real exam score, so it reads only the exam-calibrated bank.
  const scored = store.attempts.filter((a) => bankOf(a) === 'original')
  const stats: DomainStat[] = domains.map((d) => {
    const rel = scored.filter((a) => a.domain === d.id)
    return { id: d.id, total: rel.length, correct: rel.filter((a) => a.correct).length }
  })

  const read = Object.keys(store.lectureRead).length
  const dueCards = flashcards.filter((c) => isDue(store.cards[c.id])).length
  const openMistakes = Object.values(store.mistakes).filter((m) => !m.resolved).length
  const lastExam = store.exams.at(-1)
  const lastExamBank = lastExam ? bankById[bankOf(lastExam)] : null
  const nextLecture = lectures.find((l) => !store.lectureRead[l.id])

  const DAY = 86_400_000
  const now = Date.now()
  const thisWeek = store.attempts.filter((a) => now - a.at < 7 * DAY)
  const lastWeek = store.attempts.filter((a) => now - a.at >= 7 * DAY && now - a.at < 14 * DAY)
  const acc = (xs: typeof thisWeek) => (xs.length ? xs.filter((a) => a.correct).length / xs.length : null)
  const dueSoon = flashcards.filter((c) => { const st = store.cards[c.id]; return st && st.due > now && st.due < now + 7 * DAY }).length
  const weakLecture = lectures
    .map((l) => { const rel = thisWeek.filter((a) => a.lecture === l.id); return { l, n: rel.length, acc: acc(rel) } })
    .filter((x) => x.n >= 3 && x.acc != null)
    .sort((a, b) => a.acc! - b.acc!)[0]
  const focus = weakLecture && weakLecture.acc! < 0.72
    ? { text: `Re-read ${lectureNo(weakLecture.l.id)} ${weakLecture.l.title}, ${Math.round(weakLecture.acc! * 100)}% this week`, to: `/learn/${weakLecture.l.id}` }
    : openMistakes ? { text: `Close out the ${openMistakes} open mistakes`, to: '/mistakes' } : nextLecture ? { text: 'Keep reading in order', to: `/learn/${nextLecture.id}` } : { text: 'Sit a mock', to: '/exam' }

  const next = nextLecture
    ? { title: `Read lecture ${lectureNo(nextLecture.id)}, ${nextLecture.title}`, to: `/learn/${nextLecture.id}`, why: `${nextLecture.minutes} min. Everything after it assumes it.` }
    : openMistakes
      ? { title: `Work through ${openMistakes} open mistake${openMistakes === 1 ? '' : 's'}`, to: '/mistakes', why: 'Your own errors are worth more than new questions.' }
      : dueCards
        ? { title: `Review ${dueCards} due cards`, to: '/cards', why: 'Spaced repetition only works if you show up.' }
        : { title: 'Sit a full mock exam', to: '/exam', why: `${exam.questions} questions, ${exam.minutes} minutes, no feedback until the end.` }

  const lastScore = lastExam ? scaledScore(lastExam.correct / lastExam.total) : null

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Overview"
        description={<span className="mono text-xs">{exam.code} · {exam.questions} questions · {exam.minutes} min · pass {exam.passingScore}</span>}
      />

      <div className="grid gap-3 md:grid-cols-[1fr_272px]">
      <Link
        to={next.to}
        className="group pressable flex items-center justify-between gap-6 rounded-xl border bg-card px-5 py-4 hover:border-border-strong"
      >
        <div className="min-w-0">
          <div className="eyebrow">Next up</div>
          <div className="mt-2 text-[15px] font-medium tracking-tight">{next.title}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">{next.why}</div>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full border text-muted-foreground transition-[transform,color,border-color] duration-200 ease-(--ease-out) group-hover:translate-x-0.5 group-hover:border-border-strong group-hover:text-foreground">
          <ArrowRight className="size-4" />
        </span>
      </Link>
      <TodayPanel />
      </div>

      <StatRow className="mt-3">
        <Stat label="Lectures read" value={<>{read}<span className="text-faint-foreground">/{lectures.length}</span></>} />
        <Stat label="Cards due" value={dueCards} hint={`of ${flashcards.length}`} />
        <Stat label="Open mistakes" value={openMistakes} tone={openMistakes ? undefined : 'good'} />
        <Stat label="Streak" value={<span className="inline-flex items-center gap-1.5">{streak}{streak >= 2 && <Flame className="size-4 fill-current text-(--domain-perf)" />}</span>} hint={streak === 1 ? 'day' : 'days'} />
      </StatRow>

      <div className="mt-3 grid gap-3 md:grid-cols-[272px_1fr]">
        <Panel title="Readiness" hint="Arc is exam weight, fill is your accuracy." bodyClassName="p-4 pt-5">
          <Readiness stats={stats} />
        </Panel>

        <div className="grid content-start gap-3">
          <Panel
            title="Curriculum"
            action={<Link to="/learn" className="pressable flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">All lectures <ArrowUpRight className="size-3" /></Link>}
            bodyClassName="p-0"
          >
            {modules.map((m) => {
              const ls = lectures.filter((l) => l.module === m.id)
              const done = ls.filter((l) => store.lectureRead[l.id]).length
              const first = ls.find((l) => !store.lectureRead[l.id]) ?? ls[0]
              return (
                <Link key={m.id} to={first ? `/learn/${first.id}` : '/learn'} className="grid grid-cols-[1fr_112px_44px] items-center gap-4 border-b px-4 py-2.5 text-[13px] transition-colors duration-100 last:border-b-0 hover:bg-accent/50">
                  <span className="truncate">{m.name}</span>
                  <Meter value={ls.length ? done / ls.length : 0} />
                  <span className="mono text-right text-xs text-muted-foreground">{done}/{ls.length}</span>
                </Link>
              )
            })}
          </Panel>

          <Panel
            title="This week"
            hint={`${thisWeek.length} questions${lastWeek.length ? ` · last week ${lastWeek.length}` : ''} · ${dueSoon} cards due in 7 days`}
            bodyClassName="p-0"
          >
            {domains.map((d) => {
              const a = acc(thisWeek.filter((x) => x.domain === d.id))
              const b = acc(lastWeek.filter((x) => x.domain === d.id))
              const delta = a != null && b != null ? Math.round((a - b) * 100) : null
              return (
                <div key={d.id} className="grid grid-cols-[1fr_112px_72px] items-center gap-4 border-b px-4 py-2.5 text-[13px]">
                  <span className="flex items-center gap-2 truncate text-muted-foreground"><DomainDot id={d.id} />{shortDomain(d.id)}</span>
                  <Meter value={a ?? 0} color={a != null && a < 0.72 ? 'var(--bad)' : undefined} />
                  <span className="mono text-right text-xs text-muted-foreground">
                    {a == null ? '—' : `${Math.round(a * 100)}%`}
                    {delta != null && delta !== 0 && <span className={cn('ml-1', delta > 0 ? 'text-good' : 'text-bad')}>{delta > 0 ? '+' : ''}{delta}</span>}
                  </span>
                </div>
              )
            })}
            <Link to={focus.to} className="group flex items-center justify-between gap-3 px-4 py-3 text-[13px] transition-colors duration-100 hover:bg-accent/50">
              <span><span className="eyebrow mr-2">Focus</span>{focus.text}</span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" />
            </Link>
          </Panel>

          <Panel title="Last mock exam">
            {lastExam && lastScore != null ? (
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className={cn('mono text-3xl font-medium tracking-tight', lastScore >= exam.passingScore ? 'text-good' : 'text-bad')}>{lastScore}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{lastScore >= exam.passingScore ? 'pass' : 'below the line'} · pass mark {exam.passingScore}</div>
                </div>
                <div className="mono text-right text-xs text-muted-foreground">
                  {lastExam.correct}/{lastExam.total}<br />{lastExamBank?.label} · {new Date(lastExam.at).toLocaleDateString()}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">None yet. Sit one after module 3.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
