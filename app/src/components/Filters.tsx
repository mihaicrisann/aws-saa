import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { domains, lectures, lectureNo, shortDomain, type DomainId } from '@/lib/content'
import { DomainDot } from './parts'
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
    <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={(v) => v && onChange(v as DomainId | 'all')}>
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      {domains.map((d) => (
        <ToggleGroupItem key={d.id} value={d.id} className="gap-1.5">
          <DomainDot id={d.id} /> {shortDomain(d.id)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

export function LecturePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-80">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Any lecture</SelectItem>
        {lectures.map((l) => (
          <SelectItem key={l.id} value={l.id}>
            {lectureNo(l.id)} · {l.title}
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
