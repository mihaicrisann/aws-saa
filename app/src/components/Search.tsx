import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import cheatJson from '@content/cheatsheet.json'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { lectureNo } from '@/lib/content'

interface Entry { lecture: string; n: number; lectureTitle: string; id: string; title: string; text: string }
type CheatRow = { section: string; text: string }

const cheatRows: CheatRow[] = (cheatJson as { sections: { title: string; rows: (string | string[])[] }[] }).sections.flatMap((s) =>
  s.rows.map((r) => ({ section: s.title, text: Array.isArray(r) ? r.join(' — ') : r })),
)

let cache: Entry[] | null = null
async function loadIndex() {
  if (cache) return cache
  const r = await fetch('/lectures/search-index.json')
  cache = (await r.json()) as Entry[]
  return cache
}

const score = (hay: string, terms: string[]) => {
  const h = hay.toLowerCase()
  let s = 0
  for (const t of terms) {
    const i = h.indexOf(t)
    if (i < 0) return 0
    s += i < 80 ? 3 : 1
  }
  return s
}

const snippet = (text: string, term: string) => {
  const i = text.toLowerCase().indexOf(term)
  if (i < 0) return text.slice(0, 110)
  const start = Math.max(0, i - 40)
  return (start ? '…' : '') + text.slice(start, start + 130) + '…'
}

export default function Search({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [index, setIndex] = useState<Entry[]>([])

  useEffect(() => {
    if (open) void loadIndex().then(setIndex)
    else setQ('')
  }, [open])

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean)
  const results = useMemo(() => {
    if (!terms.length) return { sections: [] as Entry[], cheats: [] as CheatRow[] }
    const sections = index
      .map((e) => ({ e, s: score(e.title, terms) * 3 + score(e.text, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.e)
    const cheats = cheatRows.filter((r) => score(r.text, terms) > 0).slice(0, 5)
    return { sections, cheats }
  }, [index, terms.join(' ')])

  const go = (to: string) => {
    onOpenChange(false)
    nav(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Search" description="Search lectures and the cheat sheet">
      <Command shouldFilter={false}>
      <CommandInput placeholder="Search lectures and cheat sheet — object lock, transit gateway, ExternalId…" value={q} onValueChange={setQ} />
      <CommandList>
        {terms.length > 0 && !results.sections.length && !results.cheats.length && <CommandEmpty>Nothing found.</CommandEmpty>}
        {results.sections.length > 0 && (
          <CommandGroup heading="Lectures">
            {results.sections.map((e) => (
              <CommandItem key={`${e.lecture}#${e.id}`} value={`${e.lecture}#${e.id}`} onSelect={() => go(`/learn/${e.lecture}#${e.id}`)} className="flex-col items-start gap-0.5">
                <span className="text-sm">
                  <span className="mr-2 text-muted-foreground tabular-nums">{lectureNo(e.lecture)}</span>
                  {e.title}
                  <span className="ml-2 text-xs text-muted-foreground">{e.lectureTitle}</span>
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{snippet(e.text, terms[0])}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {results.cheats.length > 0 && (
          <CommandGroup heading="Cheat sheet">
            {results.cheats.map((r, i) => (
              <CommandItem key={i} value={`cheat-${i}`} onSelect={() => go('/cheatsheet')} className="flex-col items-start gap-0.5">
                <span className="line-clamp-2 text-sm">{r.text}</span>
                <span className="text-xs text-muted-foreground">{r.section}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
