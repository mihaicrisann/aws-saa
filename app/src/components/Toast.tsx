'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'

export interface Toast {
  id: number
  eyebrow: string
  title: string
  detail?: string
}

let toasts: Toast[] = []
let seq = 0
const listeners = new Set<() => void>()
const publish = () => listeners.forEach((l) => l())

export function toast(t: Omit<Toast, 'id'>) {
  toasts = [...toasts, { ...t, id: ++seq }].slice(-3)
  publish()
}

const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id)
  publish()
}

const useToasts = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => toasts,
    () => toasts,
  )

function Item({ t }: { t: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(t.id), 4500)
    return () => clearTimeout(timer)
  }, [t.id])
  return (
    <button
      type="button"
      onClick={() => dismiss(t.id)}
      className={cn(
        'toast-enter pressable pointer-events-auto w-72 rounded-xl border bg-popover px-4 py-3 text-left shadow-[0_8px_24px_-12px_--theme(--color-black/25%)] dark:shadow-none',
      )}
    >
      <div className="eyebrow">{t.eyebrow}</div>
      <div className="mt-1.5 text-[13px] font-medium tracking-tight">{t.title}</div>
      {t.detail && <div className="mt-0.5 text-xs text-muted-foreground">{t.detail}</div>}
    </button>
  )
}

/** Bottom-right stack. Nothing here needs a reply, so nothing here steals focus. */
export function Toasts() {
  const items = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-16 z-50 grid gap-2 md:top-14 md:bottom-auto">
      {items.map((t) => <Item key={t.id} t={t} />)}
    </div>
  )
}
