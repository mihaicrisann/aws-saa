'use client'

import { useMemo, useState } from 'react'
import { ArrowUpRight, SearchIcon, X } from 'lucide-react'
import cheatJson from '@content/cheatsheet.json'
import { PageHeader, Rows, Choice } from '@/components/parts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Section = { id: string; title: string; blurb: string; kind: 'pairs' | 'triples' | 'list'; rows: (string | string[])[] }
const cheat = cheatJson as unknown as { sections: Section[] }
const matches = (row: string | string[], q: string) => (Array.isArray(row) ? row.join(' ') : row).toLowerCase().includes(q)

export default function Cheatsheet() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState('all')
  const q = query.trim().toLowerCase()

  const sections = useMemo(
    () =>
      cheat.sections
        .filter((s) => active === 'all' || s.id === active)
        .map((s) => ({ ...s, rows: q ? s.rows.filter((r) => matches(r, q)) : s.rows }))
        .filter((s) => s.rows.length > 0),
    [q, active],
  )
  const total = sections.reduce((a, s) => a + s.rows.length, 0)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Cheat sheet"
        description="Cue words, the pairs people confuse, hard numbers, and the answer shapes that are automatically wrong."
        actions={<Button render={<a href="/lectures/19-exam-playbook.html" target="_blank" rel="noreferrer" />} variant="outline" size="sm">Exam playbook <ArrowUpRight /></Button>}
      />

      <div className="sticky top-12 z-30 -mx-5 mb-8 border-b bg-background/85 px-5 py-3 backdrop-blur-md md:top-0 md:-mx-10 md:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-8 min-w-56 flex-1 items-center gap-2 rounded-lg border bg-card px-2.5 transition-[border-color,box-shadow] duration-100 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
            <SearchIcon className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="static ip, multi-az, glacier, least overhead…"
              aria-label="Search the cheat sheet"
              className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint-foreground"
            />
            {query ? (
              <button type="button" aria-label="Clear" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground"><X className="size-3.5" /></button>
            ) : (
              <span className="mono text-[11px] text-faint-foreground">{total}</span>
            )}
          </label>
          <Choice
            className="flex-wrap"
            value={active}
            onChange={(v) => v && setActive(v)}
            options={[{ value: 'all', label: 'All' }, ...cheat.sections.map((s) => ({ value: s.id, label: s.title }))]}
          />
        </div>
      </div>

      {sections.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches "{query}".</p>}

      <div className="grid gap-10">
        {sections.map((s, si) => (
          <section key={s.id} className="grid gap-3 md:grid-cols-[168px_1fr]">
            <div className="md:pt-2.5">
              <div className="eyebrow">{String(si + 1).padStart(2, '0')}</div>
              <h2 className="mt-2 text-[15px] font-medium tracking-tight">{s.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.blurb}</p>
            </div>
            <Rows>
              {s.rows.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    'grid gap-x-4 gap-y-1 px-4 py-2.5 text-[13px] leading-relaxed',
                    s.kind === 'triples' ? 'sm:grid-cols-[1fr_1fr_1.6fr]' : s.kind === 'pairs' ? 'sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]' : '',
                  )}
                >
                  {s.kind === 'list' ? (
                    <span className="grid grid-cols-[14px_1fr] gap-2 text-muted-foreground"><span className="mono text-bad">✕</span>{r as string}</span>
                  ) : s.kind === 'triples' ? (
                    <>
                      <span className="font-medium">{(r as string[])[0]}</span>
                      <span className="font-medium">{(r as string[])[1]}</span>
                      <span className="text-muted-foreground">{(r as string[])[2]}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted-foreground">{(r as string[])[0]}</span>
                      <span className="font-medium">{(r as string[])[1]}</span>
                    </>
                  )}
                </div>
              ))}
            </Rows>
          </section>
        ))}
      </div>
    </div>
  )
}
