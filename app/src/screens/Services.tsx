'use client'

import { useMemo, useState } from 'react'
import { SearchIcon, X } from 'lucide-react'
import servicesJson from '@content/services.json'
import { PageHeader, Rows, Choice, QuietLink } from '@/components/parts'
import { cn } from '@/lib/utils'

type Service = { name: string; solves: string; use: string[]; avoid?: string; lecture?: string }
type Comparison = { id: string; title: string; blurb?: string; columns: string[]; rows: string[][]; verdict?: string }
type Group = { id: string; title: string; blurb: string; services: Service[]; comparisons: Comparison[] }
const groups = (servicesJson as unknown as { groups: Group[] }).groups

const serviceText = (s: Service) => [s.name, s.solves, s.avoid, ...s.use].join(' ').toLowerCase()
const comparisonText = (c: Comparison) => [c.title, c.verdict, ...c.columns, ...c.rows.flat()].join(' ').toLowerCase()

function ServiceCard({ s }: { s: Service }) {
  return (
    <article className="grid gap-x-6 gap-y-2 px-4 py-3.5 text-[13px] leading-relaxed md:grid-cols-[180px_1fr]">
      <div>
        <h3 className="font-medium tracking-tight">{s.name}</h3>
        {s.lecture && <QuietLink to={`/learn/${s.lecture}`} className="text-xs">Lecture ↗</QuietLink>}
      </div>
      <div className="grid gap-2">
        <p>{s.solves}</p>
        <ul className="grid gap-1 text-muted-foreground">
          {s.use.map((u, i) => (
            <li key={i} className="grid grid-cols-[14px_1fr] gap-2"><span className="mono text-good">✓</span>{u}</li>
          ))}
          {s.avoid && <li className="grid grid-cols-[14px_1fr] gap-2"><span className="mono text-bad">✕</span>{s.avoid}</li>}
        </ul>
      </div>
    </article>
  )
}

function ComparisonTable({ c }: { c: Comparison }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h3 className="text-[13px] font-medium">{c.title}</h3>
        {c.blurb && <p className="mt-0.5 text-xs text-muted-foreground">{c.blurb}</p>}
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px] leading-relaxed">
          <thead>
            <tr className="border-b">
              <th className="w-32 px-4 py-2 text-left align-bottom" />
              {c.columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left align-bottom font-medium tracking-tight">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.rows.map((r, i) => {
              const decisive = r[0].toLowerCase().startsWith('use when')
              return (
                <tr key={i} className={cn('border-b last:border-b-0', decisive && 'bg-muted/40')}>
                  <th scope="row" className="eyebrow px-4 py-2 text-left align-top normal-case tracking-normal">{r[0]}</th>
                  {r.slice(1).map((cell, j) => (
                    <td key={j} className={cn('px-3 py-2 align-top', decisive ? 'font-medium' : 'text-muted-foreground')}>{cell || '—'}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {c.verdict && <p className="border-t px-4 py-2.5 text-[13px] leading-relaxed"><span className="eyebrow mr-2">Verdict</span>{c.verdict}</p>}
    </section>
  )
}

export default function Services() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('all')
  const q = query.trim().toLowerCase()

  const visible = useMemo(
    () =>
      groups
        .filter((g) => active === 'all' || g.id === active)
        .map((g) => ({
          ...g,
          services: q ? g.services.filter((s) => serviceText(s).includes(q)) : g.services,
          comparisons: q ? g.comparisons.filter((c) => comparisonText(c).includes(q)) : g.comparisons,
        }))
        .filter((g) => g.services.length > 0 || g.comparisons.length > 0),
    [q, active],
  )
  const total = visible.reduce((a, g) => a + g.services.length + g.comparisons.length, 0)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Services" description="What each service solves, when to pick it, and the tables that separate the look-alikes." className="mb-4" />
      <label className="mb-6 flex h-9 w-full max-w-xl items-center gap-2 rounded-lg border bg-card px-3 transition-[border-color,box-shadow] duration-100 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="read replica, lustre, nat, firehose, anycast…"
          aria-label="Search services"
          className="w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-faint-foreground"
        />
        {query ? (
          <button type="button" aria-label="Clear" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        ) : (
          <span className="mono text-xs text-faint-foreground">{total}</span>
        )}
      </label>

      <div className="sticky top-12 z-30 -mx-5 mb-8 border-b bg-background/85 px-5 py-2.5 backdrop-blur-md md:top-0 md:-mx-10 md:px-10">
        <Choice
          className="w-full"
          value={active}
          onChange={(v) => v && setActive(v)}
          options={[{ value: 'all', label: 'All' }, ...groups.map((g) => ({ value: g.id, label: g.title }))]}
        />
      </div>

      {visible.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches "{query}".</p>}

      <div className="grid gap-14">
        {visible.map((g, gi) => (
          <section key={g.id} id={g.id} className="grid gap-5">
            <div className="max-w-2xl">
              <div className="eyebrow">{String(gi + 1).padStart(2, '0')}</div>
              <h2 className="mt-2 text-[17px] font-medium tracking-tight">{g.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{g.blurb}</p>
            </div>
            {g.services.length > 0 && (
              <Rows>
                {g.services.map((s) => <ServiceCard key={s.name} s={s} />)}
              </Rows>
            )}
            {g.comparisons.length > 0 && (
              <div className="grid gap-4">
                {g.comparisons.map((c) => <ComparisonTable key={c.id} c={c} />)}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
