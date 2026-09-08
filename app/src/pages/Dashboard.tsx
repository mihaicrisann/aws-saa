import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useStore, studyStreak } from '@/lib/store'
import { isDue } from '@/lib/srs'
import { lectures, modules, flashcards, domains, exam, lectureNo, scaledScore, shortDomain } from '@/lib/content'
import Readiness, { type DomainStat } from '@/components/Readiness'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, Stat, StatRow, Meter } from '@/components/parts'

export default function Dashboard() {
  const store = useStore((s) => s)
  const streak = studyStreak(store.activity)

  const stats: DomainStat[] = domains.map((d) => {
    const rel = store.attempts.filter((a) => a.domain === d.id)
    return { id: d.id, total: rel.length, correct: rel.filter((a) => a.correct).length }
  })

  const read = Object.keys(store.lectureRead).length
  const dueCards = flashcards.filter((c) => isDue(store.cards[c.id])).length
  const openMistakes = Object.values(store.mistakes).filter((m) => !m.resolved).length
  const lastExam = store.exams.at(-1)
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
    ? { text: `Re-read ${lectureNo(weakLecture.l.id)} ${weakLecture.l.title} — ${Math.round(weakLecture.acc! * 100)}% this week`, to: `/learn/${weakLecture.l.id}` }
    : openMistakes ? { text: `Close out the ${openMistakes} open mistakes`, to: '/mistakes' } : nextLecture ? { text: 'Keep reading in order', to: `/learn/${nextLecture.id}` } : { text: 'Sit a mock', to: '/exam' }

  const next = nextLecture
    ? { title: `Read lecture ${lectureNo(nextLecture.id)} — ${nextLecture.title}`, to: `/learn/${nextLecture.id}`, why: `${nextLecture.minutes} min. Everything after it assumes it.` }
    : openMistakes
      ? { title: `Work through ${openMistakes} open mistake${openMistakes === 1 ? '' : 's'}`, to: '/mistakes', why: 'Your own errors are worth more than new questions.' }
      : dueCards
        ? { title: `Review ${dueCards} due cards`, to: '/cards', why: 'Spaced repetition only works if you show up.' }
        : { title: 'Sit a full mock exam', to: '/exam', why: `${exam.questions} questions, ${exam.minutes} minutes, no feedback until the end.` }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Overview" description={`${exam.code} · ${exam.questions} questions · ${exam.minutes} minutes · pass ${exam.passingScore}`} />

      <Link
        to={next.to}
        className="group flex items-center justify-between gap-4 rounded-2xl border bg-card px-5 py-4 transition-colors hover:bg-muted/50"
      >
        <div>
          <div className="text-xs text-muted-foreground">Next</div>
          <div className="mt-0.5 font-medium">{next.title}</div>
          <div className="text-sm text-muted-foreground">{next.why}</div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <StatRow className="mt-4">
        <Stat label="Lectures read" value={`${read}/${lectures.length}`} />
        <Stat label="Cards due" value={dueCards} hint={`of ${flashcards.length}`} />
        <Stat label="Open mistakes" value={openMistakes} />
        <Stat label="Streak" value={streak} hint={streak === 1 ? 'day' : 'days'} />
      </StatRow>

      <div className="mt-4 grid gap-4 md:grid-cols-[260px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Readiness</CardTitle>
            <CardDescription>Arc length is exam weight; fill is your accuracy.</CardDescription>
          </CardHeader>
          <CardContent>
            <Readiness stats={stats} />
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Curriculum</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {modules.map((m) => {
                const ls = lectures.filter((l) => l.module === m.id)
                const done = ls.filter((l) => store.lectureRead[l.id]).length
                return (
                  <div key={m.id} className="grid grid-cols-[1fr_120px_40px] items-center gap-3 text-sm">
                    <span className="truncate">{m.name}</span>
                    <Meter value={ls.length ? done / ls.length : 0} />
                    <span className="text-right text-xs text-muted-foreground tabular-nums">{done}/{ls.length}</span>
                  </div>
                )
              })}
              <Button render={<Link to="/learn" />} variant="ghost" size="sm" className="mt-1 w-fit -ml-2">All lectures <ArrowRight /></Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
              <CardDescription>{thisWeek.length} questions{lastWeek.length ? ` (last week ${lastWeek.length})` : ''} · {dueSoon} cards due in the next 7 days</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {domains.map((d) => {
                const a = acc(thisWeek.filter((x) => x.domain === d.id))
                const b = acc(lastWeek.filter((x) => x.domain === d.id))
                const delta = a != null && b != null ? Math.round((a - b) * 100) : null
                return (
                  <div key={d.id} className="grid grid-cols-[1fr_120px_72px] items-center gap-3">
                    <span className="truncate text-muted-foreground">{shortDomain(d.id)}</span>
                    <Meter value={a ?? 0} color={a != null && a < 0.72 ? 'var(--bad)' : undefined} />
                    <span className="text-right text-xs text-muted-foreground tabular-nums">
                      {a == null ? '—' : `${Math.round(a * 100)}%`}{delta != null && delta !== 0 && <span className={delta > 0 ? 'text-good' : 'text-bad'}> {delta > 0 ? '+' : ''}{delta}</span>}
                    </span>
                  </div>
                )
              })}
              <Link to={focus.to} className="mt-1 flex items-center justify-between rounded-lg border px-3 py-2 transition-colors hover:bg-accent">
                <span><span className="text-muted-foreground">Focus · </span>{focus.text}</span>
                <ArrowRight className="size-3.5 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Last mock exam</CardTitle>
            </CardHeader>
            <CardContent>
              {lastExam ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-2xl font-semibold tabular-nums">{scaledScore(lastExam.correct / lastExam.total)}</span>
                  <span className="text-muted-foreground">
                    {lastExam.correct}/{lastExam.total} · {new Date(lastExam.at).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None yet. Sit one after module 3 to calibrate.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
