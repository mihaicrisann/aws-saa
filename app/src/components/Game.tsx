'use client'

import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link } from '@/lib/navigation'
import { Check, Flame } from 'lucide-react'
import { useStore, studyStreak } from '@/lib/store'
import { achievements, dailyQuests, lastDays, levelFor, levelLabel, totalXp, xpToday, type Level } from '@/lib/game'
import { toast } from '@/components/Toast'
import { Meter } from '@/components/parts'
import { cn } from '@/lib/utils'

export const fmtXp = (n: number) => n.toLocaleString('en-US')

/** Fires once per unlock or level while the app is open. History loaded at sign-in stays quiet. */
export function useGameToasts() {
  const store = useStore((s) => s)
  const xp = useMemo(() => totalXp(store), [store])
  const unlocked = useMemo(() => achievements(store).filter((a) => a.unlocked), [store])
  const level = levelFor(xp)
  const seen = useRef<{ level: number; ids: Set<string> } | null>(null)
  useEffect(() => {
    const ids = new Set(unlocked.map((a) => a.id))
    if (!seen.current) {
      seen.current = { level: level.index, ids }
      return
    }
    if (level.index > seen.current.level)
      toast({ eyebrow: 'Level up', title: levelLabel(level), detail: level.next ? `Next: ${level.next}` : 'Top of the ladder.' })
    for (const a of unlocked)
      if (!seen.current.ids.has(a.id)) toast({ eyebrow: 'Achievement', title: a.title, detail: a.how })
    seen.current = { level: level.index, ids }
  }, [level, unlocked])
}

export function LevelMeter({ level, className }: { level: Level; className?: string }) {
  return <Meter value={level.span ? level.into / level.span : 1} className={className} />
}

/** Sidebar card: where you are on the ladder and whether this week has held up. */
export function LevelCard() {
  const store = useStore((s) => s)
  const xp = useMemo(() => totalXp(store), [store])
  const level = levelFor(xp)
  const streak = studyStreak(store.activity)
  const week = lastDays(store.activity)
  const met = xpToday(store) >= store.dailyGoal
  return (
    <Link to="/progress" className="group mt-4 block rounded-md border border-sidebar-border bg-background/60 px-2.5 py-2 transition-colors duration-100 hover:bg-background dark:bg-background/40">
      <div className="flex items-baseline justify-between gap-2">
        <span className="eyebrow text-foreground">{levelLabel(level)}</span>
        <span className="mono text-[11px] text-muted-foreground">{fmtXp(xp)} xp</span>
      </div>
      <LevelMeter level={level} className="mt-2" />
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex gap-1" aria-label={`${week.filter((d) => d.active).length} of the last 7 days active`}>
          {week.map((d) => (
            <span
              key={d.key}
              className={cn(
                'size-1.5 rounded-full',
                d.active ? 'bg-foreground' : 'bg-border-strong',
                d.isToday && !d.active && 'ring-1 ring-foreground/40 ring-offset-1 ring-offset-background',
              )}
            />
          ))}
        </div>
        <span className={cn('mono flex items-center gap-1 text-[11px]', streak ? 'text-muted-foreground' : 'text-faint-foreground')}>
          {streak}
          <Flame className={cn('size-3', streak >= 2 ? 'fill-current text-(--domain-perf)' : 'text-faint-foreground')} />
          {met && <Check className="ml-0.5 size-3 text-good" aria-label="Daily goal met" />}
        </span>
      </div>
    </Link>
  )
}

/** A ring that fills as the day's points come in. */
export function GoalRing({ value, size = 64, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  const v = Math.min(1, Math.max(0, value))
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={v >= 1 ? 'var(--good)' : 'var(--foreground)'}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          className="transition-[stroke-dashoffset] duration-500 ease-(--ease-out)"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/** Today's goal and the three things that get you there. */
export function TodayPanel() {
  const store = useStore((s) => s)
  const earned = useMemo(() => xpToday(store), [store])
  const quests = useMemo(() => dailyQuests(store), [store])
  const goal = store.dailyGoal
  const met = earned >= goal
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-4 px-4 py-3.5">
        <GoalRing value={earned / goal} size={56}>
          {met ? <Check className="size-4 text-good" /> : <span className="mono text-[11px] text-muted-foreground">{Math.round((earned / goal) * 100)}%</span>}
        </GoalRing>
        <div className="min-w-0">
          <div className="eyebrow">Today</div>
          <div className="mono mt-1.5 text-[15px] font-medium tracking-tight">
            {fmtXp(earned)}<span className="text-faint-foreground"> / {fmtXp(goal)} xp</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{met ? 'Goal met. Anything more is a bonus.' : `${fmtXp(goal - earned)} to go`}</div>
        </div>
      </div>
      <div className="border-t">
        {quests.map((q) => {
          const done = q.done >= q.target
          return (
            <Link key={q.id} to={q.to} className="flex items-center gap-3 border-b px-4 py-2 text-[13px] transition-colors duration-100 last:border-b-0 hover:bg-accent/50">
              <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', done ? 'border-good bg-good text-background' : 'border-border-strong')}>
                {done && <Check className="size-2.5" strokeWidth={3} />}
              </span>
              <span className={cn('flex-1 truncate', done && 'text-muted-foreground line-through decoration-border-strong')}>{q.title}</span>
              <span className="mono text-xs text-muted-foreground">{q.done}/{q.target}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/** "+120 xp" plus the level it landed in, for the end of a set. */
export function XpEarned({ earned }: { earned: number }) {
  const store = useStore((s) => s)
  const total = useMemo(() => totalXp(store), [store])
  const after = levelFor(total)
  const before = levelFor(Math.max(0, total - earned))
  const up = after.index > before.index
  return (
    <div className="px-4 py-3.5">
      <div className="eyebrow">Earned</div>
      <div className="mono mt-2 text-[22px] leading-none font-medium tracking-tight">+{fmtXp(earned)}</div>
      <div className={cn('mt-1.5 text-xs', up ? 'text-good' : 'text-muted-foreground')}>
        {up ? `Level up · ${after.name}` : after.next ? `${fmtXp(after.span - after.into)} to ${after.next}` : after.name}
      </div>
    </div>
  )
}
