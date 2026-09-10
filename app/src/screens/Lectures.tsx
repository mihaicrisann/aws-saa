'use client'

import { Link } from '@/lib/navigation'
import { ArrowUpRight, Check } from 'lucide-react'
import { lectures, modules, lectureNo } from '@/lib/content'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { PageHeader, DomainDot, Rows, Meter } from '@/components/parts'
import { cn } from '@/lib/utils'

export default function Lectures() {
  const readMap = useStore((s) => s.lectureRead)
  const totalMinutes = lectures.reduce((a, l) => a + l.minutes, 0)
  const read = Object.keys(readMap).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Learn"
        description={`${lectures.length} lectures, about ${Math.round(totalMinutes / 60)} hours. In order: each one only assumes the ones before it.`}
        actions={
          <Button render={<a href="/lectures/index.html" target="_blank" rel="noreferrer" />} variant="outline" size="sm">
            Plain HTML <ArrowUpRight />
          </Button>
        }
      />

      <div className="mb-8 flex items-center gap-4 text-[13px]">
        <Meter value={lectures.length ? read / lectures.length : 0} className="flex-1" />
        <span className="mono text-xs text-muted-foreground">{read}/{lectures.length} read</span>
      </div>

      <div className="stagger grid gap-8">
        {modules.map((m, mi) => {
          const ls = lectures.filter((l) => l.module === m.id)
          if (!ls.length) return null
          return (
            <section key={m.id} className="grid gap-3 md:grid-cols-[168px_1fr]">
              <div className="md:pt-3">
                <div className="eyebrow">Module {String(mi + 1).padStart(2, '0')}</div>
                <h2 className="mt-2 text-[15px] font-medium tracking-tight">{m.name}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{m.blurb}</p>
              </div>
              <Rows>
                {ls.map((l) => {
                  const done = !!readMap[l.id]
                  return (
                    <Link
                      key={l.id}
                      to={`/learn/${l.id}`}
                      className="group grid grid-cols-[28px_1fr_auto] items-start gap-3 px-4 py-3 transition-colors duration-100 hover:bg-accent/50"
                    >
                      <span className={cn('mono mt-0.5 text-xs', done ? 'text-good' : 'text-faint-foreground')}>
                        {done ? <Check className="size-3.5" strokeWidth={2.5} /> : lectureNo(l.id)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium tracking-tight">{l.title}</span>
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{l.standfirst}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2.5">
                        <span className="flex gap-1">{l.domains.map((d) => <DomainDot key={d} id={d} />)}</span>
                        <span className="mono text-xs text-faint-foreground">{l.minutes}m</span>
                      </span>
                    </Link>
                  )
                })}
              </Rows>
            </section>
          )
        })}
      </div>
    </div>
  )
}
