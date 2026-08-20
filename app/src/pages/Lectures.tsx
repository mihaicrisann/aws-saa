import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { lectures, modules, lectureNo } from '@/lib/content'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { PageHeader, DomainDot } from '@/components/parts'
import { cn } from '@/lib/utils'

export default function Lectures() {
  const readMap = useStore((s) => s.lectureRead)
  const totalMinutes = lectures.reduce((a, l) => a + l.minutes, 0)
  const read = Object.keys(readMap).length

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Learn"
        description={`${lectures.length} lectures, about ${totalMinutes} minutes. In order — each one only assumes the ones before it. ${read} read.`}
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/lectures/index.html" target="_blank" rel="noreferrer">Open as plain HTML</a>
          </Button>
        }
      />

      <div className="grid gap-8">
        {modules.map((m) => {
          const ls = lectures.filter((l) => l.module === m.id)
          if (!ls.length) return null
          return (
            <section key={m.id}>
              <h2 className="text-sm font-medium">{m.name}</h2>
              <p className="mt-0.5 mb-3 text-sm text-muted-foreground">{m.blurb}</p>
              <div className="overflow-hidden rounded-2xl border">
                {ls.map((l) => {
                  const done = !!readMap[l.id]
                  return (
                    <Link
                      key={l.id}
                      to={`/learn/${l.id}`}
                      className="grid grid-cols-[28px_1fr_auto] items-baseline gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
                    >
                      <span className={cn('text-xs tabular-nums', done ? 'text-good' : 'text-muted-foreground')}>
                        {done ? <Check className="size-3.5" /> : lectureNo(l.id)}
                      </span>
                      <span className="min-w-0">
                        <span className="text-sm font-medium">{l.title}</span>
                        <span className="mt-0.5 block text-sm text-muted-foreground">{l.standfirst}</span>
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        <span className="flex gap-1">{l.domains.map((d) => <DomainDot key={d} id={d} />)}</span>
                        {l.minutes} min
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
