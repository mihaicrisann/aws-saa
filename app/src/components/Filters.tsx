import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { domains, lectures, lectureNo, shortDomain, type DomainId } from '@/lib/content'
import { Choice, DomainDot } from './parts'
import type { ReactNode } from 'react'

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[100px_1fr] sm:items-center">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

export function DomainPicker({ value, onChange }: { value: DomainId | 'all'; onChange: (v: DomainId | 'all') => void }) {
  return (
    <Choice
      value={value}
      onChange={(v) => v && onChange(v)}
      options={[
        { value: 'all' as const, label: 'All' },
        ...domains.map((d) => ({ value: d.id, label: <><DomainDot id={d.id} /> {shortDomain(d.id)}</> })),
      ]}
    />
  )
}

const LECTURE_ITEMS = [
  { value: 'all', label: 'Any lecture' },
  ...lectures.map((l) => ({ value: l.id, label: `${lectureNo(l.id)} · ${l.title}` })),
]

export function LecturePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select items={LECTURE_ITEMS} value={value} onValueChange={(v) => onChange(v ?? 'all')}>
      <SelectTrigger className="w-full sm:w-80">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LECTURE_ITEMS.map((l) => (
          <SelectItem key={l.value} value={l.value}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function toggleChoice(chosen: number[], idx: number, multi: boolean) {
  if (!multi) return [idx]
  return chosen.includes(idx) ? chosen.filter((x) => x !== idx) : [...chosen, idx]
}
