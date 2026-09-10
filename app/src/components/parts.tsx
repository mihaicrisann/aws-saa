import type { ReactNode } from 'react'
import { Link } from '@/lib/navigation'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Frame, FramePanel } from '@/components/ui/frame'
import { Meter as MeterRoot, MeterIndicator, MeterTrack } from '@/components/ui/meter'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { domainVar, shortDomain, type DomainId } from '@/lib/content'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function DomainDot({ id, className }: { id: DomainId; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ background: domainVar(id) }}
    />
  )
}

export function DomainBadge({ id }: { id: DomainId }) {
  return (
    <Badge variant="outline" size="lg" className="gap-1.5 font-normal">
      <DomainDot id={id} />
      {shortDomain(id)}
    </Badge>
  )
}

/** A tray of numbers. Each stat is its own panel so the group reads as one object. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Frame className={cn('grid grid-cols-2 gap-1 *:mt-0! sm:grid-cols-4', className)}>{children}</Frame>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <FramePanel className="px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </FramePanel>
  )
}

/** A list of rows in a single framed panel — used wherever a table would be too much. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Frame className={className}>
      <FramePanel className="overflow-hidden p-0 *:border-b *:last:border-b-0">{children}</FramePanel>
    </Frame>
  )
}

export function Meter({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <MeterRoot value={Math.round(Math.min(1, Math.max(0, value)) * 100)} className={cn('gap-0', className)}>
      <MeterTrack className="h-1.5 rounded-full bg-muted">
        <MeterIndicator className="rounded-full bg-foreground" style={color ? { background: color } : undefined} />
      </MeterTrack>
    </MeterRoot>
  )
}

export function Nothing({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Empty className="rounded-2xl border border-dashed py-12 md:py-12">
      <EmptyHeader>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  )
}

export function QuietLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline', className)}>
      {children}
    </Link>
  )
}

/**
 * Base UI toggle groups are multi-select arrays. Every group in this app picks
 * exactly one thing, so the array plumbing lives here instead of at each call site.
 */
export function Choice<T extends string>({
  value,
  onChange,
  options,
  allowEmpty = false,
  className,
}: {
  value: T | ''
  onChange: (v: T | undefined) => void
  options: { value: T; label: ReactNode }[]
  allowEmpty?: boolean
  className?: string
}) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      className={className}
      value={value ? [value] : []}
      onValueChange={(next) => {
        const picked = next[0] as T | undefined
        if (picked || allowEmpty) onChange(picked)
      }}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="gap-1.5">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
