import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@/lib/navigation'
import cheatJson from '@content/cheatsheet.json'
import servicesJson from '@content/services.json'
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
} from '@/components/ui/command'
import { lectureNo } from '@/lib/content'

interface Entry { lecture: string; n: number; lectureTitle: string; id: string; title: string; text: string }
type CheatRow = { section: string; text: string }
type ServiceRow = { group: string; title: string; text: string; to: string }

const cheatRows: CheatRow[] = (cheatJson as { sections: { title: string; rows: (string | string[])[] }[] }).sections.flatMap((s) =>
  s.rows.map((r) => ({ section: s.title, text: Array.isArray(r) ? r.join(' — ') : r })),
)

const serviceRows: ServiceRow[] = (servicesJson as { groups: { id: string; title: string; services: { name: string; solves: string; use: string[] }[]; comparisons: { title: string; columns: string[]; rows: string[][] }[] }[] }).groups.flatMap((g) => [
  ...g.services.map((s) => ({ group: g.title, title: s.name, text: `${s.solves} ${s.use.join(' ')}`, to: `/services#${g.id}` })),
  ...g.comparisons.map((c) => ({ group: g.title, title: c.title, text: [...c.columns, ...c.rows.flat()].join(' '), to: `/services#${g.id}` })),
])

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
    if (!terms.length) return { sections: [] as Entry[], cheats: [] as CheatRow[], services: [] as ServiceRow[] }
    const sections = index
      .map((e) => ({ e, s: score(e.title, terms) * 3 + score(e.text, terms) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((x) => x.e)
    const cheats = cheatRows.filter((r) => score(r.text, terms) > 0).slice(0, 5)
    const services = serviceRows.filter((r) => score(`${r.title} ${r.text}`, terms) > 0).slice(0, 5)
    return { sections, cheats, services }
  }, [index, terms.join(' ')])

  const go = (to: string) => {
    onOpenChange(false)
    nav(to)
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandDialogPopup aria-label="Search lectures, services and the cheat sheet">
        <Command mode="none" value={q} onValueChange={setQ}>
          <CommandInput placeholder="object lock, transit gateway, ExternalId…" />
          <CommandPanel>
            <CommandList>
              {terms.length > 0 && !results.sections.length && !results.cheats.length && !results.services.length && <CommandEmpty>Nothing found.</CommandEmpty>}
              {results.sections.length > 0 && (
                <CommandGroup>
                  <CommandGroupLabel>Lectures</CommandGroupLabel>
                  {results.sections.map((e) => (
                    <CommandItem key={`${e.lecture}#${e.id}`} value={`${e.lecture}#${e.id}`} onClick={() => go(`/learn/${e.lecture}#${e.id}`)} className="flex-col items-start gap-0.5 py-2">
                      <span className="text-sm">
                        <span className="mono mr-2 text-xs text-faint-foreground">{lectureNo(e.lecture)}</span>
                        {e.title}
                        <span className="ml-2 text-xs text-muted-foreground">{e.lectureTitle}</span>
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{snippet(e.text, terms[0])}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.services.length > 0 && (
                <CommandGroup>
                  <CommandGroupLabel>Services</CommandGroupLabel>
                  {results.services.map((r, i) => (
                    <CommandItem key={`svc-${i}`} value={`svc-${i}`} onClick={() => go(r.to)} className="flex-col items-start gap-0.5 py-2">
                      <span className="line-clamp-1 text-sm">{r.title}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">{r.group} · {snippet(r.text, terms[0])}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.cheats.length > 0 && (
                <CommandGroup>
                  <CommandGroupLabel>Cheat sheet</CommandGroupLabel>
                  {results.cheats.map((r, i) => (
                    <CommandItem key={i} value={`cheat-${i}`} onClick={() => go('/cheatsheet')} className="flex-col items-start gap-0.5 py-2">
                      <span className="line-clamp-2 text-sm">{r.text}</span>
                      <span className="text-xs text-muted-foreground">{r.section}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </CommandPanel>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  )
}
