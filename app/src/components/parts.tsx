'use client'

import type { ReactNode } from 'react'
import { Link } from '@/lib/navigation'
import { Badge } from '@/components/ui/badge'
import { Meter as MeterRoot, MeterIndicator, MeterTrack } from '@/components/ui/meter'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { domainVar, shortDomain, type DomainId } from '@/lib/content'

/** Numbered eyebrow, display title, one quiet line under it. */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="max-w-2xl">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="display">{title}</h1>
        {description && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** Small section heading with an optional right-hand slot. */
export function SectionTitle({ children, hint, action, className }: { children: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div>
        <h2 className="text-[13px] font-medium">{children}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function DomainDot({ id, className }: { id: DomainId; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-1.5 shrink-0 rounded-full', className)}
      style={{ background: domainVar(id) }}
    />
  )
}

export function DomainBadge({ id }: { id: DomainId }) {
  return (
    <Badge variant="outline" className="h-5 gap-1.5 rounded-md px-1.5 text-[11px] font-normal text-muted-foreground">
      <DomainDot id={id} />
      {shortDomain(id)}
    </Badge>
  )
}

/** One bordered tray, hairlines between the stats. Reads as one object. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-4', '*:border-b *:border-r sm:*:border-b-0 sm:*:last:border-r-0 *:nth-[2n]:border-r-0 sm:*:nth-[2n]:border-r *:nth-last-[-n+2]:border-b-0', className)}>
      {children}
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={cn('mono mt-2 text-[22px] leading-none font-medium tracking-tight', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</div>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** A list of rows in a single bordered panel, hairlines between them. */
export function Rows({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card *:border-b *:last:border-b-0', className)}>{children}</div>
  )
}

/** A bordered panel with a header strip. */
export function Panel({ title, hint, action, children, className, bodyClassName }: { title?: ReactNode; hint?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-card', className)}>
      {title && (
        <header className="flex items-start justify-between gap-4 border-b px-4 py-3">
          <div>
            <h2 className="text-[13px] font-medium">{title}</h2>
            {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Meter({ value, color, className }: { value: number; color?: string; className?: string }) {
  return (
    <MeterRoot value={Math.round(Math.min(1, Math.max(0, value)) * 100)} className={cn('gap-0', className)}>
      <MeterTrack className="h-1 rounded-full bg-border">
        <MeterIndicator className="rounded-full bg-foreground transition-[width] duration-500 ease-(--ease-out)" style={color ? { background: color } : undefined} />
      </MeterTrack>
    </MeterRoot>
  )
}

export function Nothing({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children && <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  )
}

export function QuietLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('text-[13px] text-muted-foreground underline-offset-4 transition-colors duration-100 hover:text-foreground hover:underline', className)}>
      {children}
    </Link>
  )
}

/** A whole-row link that reads as a row, not a button. */
export function RowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cn('group/row block transition-colors duration-100 hover:bg-accent/50', className)}>
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
        <ToggleGroupItem key={o.value} value={o.value} className="gap-1.5 px-2.5 text-[13px] font-normal data-pressed:font-medium">
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
