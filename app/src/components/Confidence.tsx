import { useEffect, useState } from 'react'
import { Kbd } from '@/components/ui/kbd'
import { Choice } from './parts'
import type { Confidence } from '@/lib/store'

export const CONFIDENCE: { id: Confidence; label: string; key: string }[] = [
  { id: 'sure', label: 'Sure', key: 's' },
  { id: 'unsure', label: 'Think so', key: 'u' },
  { id: 'guess', label: 'Guessing', key: 'g' },
]

export function ConfidencePicker({ value, onChange }: { value?: Confidence; onChange: (c: Confidence | undefined) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">How sure?</span>
      <Choice
        allowEmpty
        value={value ?? ''}
        onChange={onChange}
        options={CONFIDENCE.map((c) => ({ value: c.id, label: <>{c.label} <Kbd>{c.key}</Kbd></> }))}
      />
    </div>
  )
}

/** Seconds elapsed since `since`, ticking once a second while `running`. */
export function useTicker(since: number, running: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [since, running])
  return Math.max(0, Math.round((now - since) / 1000))
}

export const fmtSeconds = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
