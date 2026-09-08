import { useMemo, useState } from 'react'
import cheatJson from '@content/cheatsheet.json'
import { PageHeader, Rows, Choice } from '@/components/parts'
import { Input } from '@/components/ui/input'
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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Cheat sheet"
        description="Cue words, the pairs people confuse, hard numbers, and the answer shapes that are automatically wrong."
        actions={<Button render={<a href="/lectures/19-exam-playbook.html" target="_blank" rel="noreferrer" />} variant="outline" size="sm">Exam playbook</Button>}
      />

      <div className="sticky top-14 z-30 -mx-5 mb-6 flex flex-wrap items-center gap-2 bg-background/95 px-5 py-2 backdrop-blur md:top-0 md:-mx-10 md:px-10">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search — static ip, multi-az, glacier, least overhead…" className="min-w-60 flex-1" />
        <Choice
          className="flex-wrap"
          value={active}
          onChange={(v) => v && setActive(v)}
          options={[{ value: 'all', label: 'All' }, ...cheat.sections.map((s) => ({ value: s.id, label: s.title }))]}
        />
      </div>

      {sections.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">Nothing matches "{query}".</p>}

      <div className="grid gap-8">
        {sections.map((s) => (
          <section key={s.id}>
            <h2 className="text-sm font-medium">{s.title}</h2>
            <p className="mt-0.5 mb-3 max-w-xl text-sm text-muted-foreground">{s.blurb}</p>
            <Rows>
              {s.rows.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    'grid gap-x-4 gap-y-1 px-4 py-2.5 text-sm',
                    s.kind === 'triples' ? 'sm:grid-cols-[1fr_1fr_1.6fr]' : s.kind === 'pairs' ? 'sm:grid-cols-2' : '',
                  )}
                >
                  {s.kind === 'list' ? (
                    <span className="text-muted-foreground"><span className="mr-2 text-bad">✕</span>{r as string}</span>
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
