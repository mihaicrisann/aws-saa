import { useEffect, useState } from 'react'
import { View } from 'react-native'
import { space } from '@/theme/tokens'
import { Choice, Eyebrow } from '@/components/ui'
import type { Confidence } from '@/lib/store'

export const CONFIDENCE: { id: Confidence; label: string }[] = [
  { id: 'sure', label: 'Sure' },
  { id: 'unsure', label: 'Think so' },
  { id: 'guess', label: 'Guessing' },
]

export function ConfidencePicker({
  value,
  onChange,
}: {
  value: Confidence | undefined
  onChange: (c: Confidence | undefined) => void
}) {
  return (
    <View style={{ gap: space[2] }}>
      <Eyebrow>How sure</Eyebrow>
      <Choice
        allowEmpty
        value={value}
        options={CONFIDENCE.map((c) => ({ value: c.id, label: c.label }))}
        onChange={onChange}
      />
    </View>
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
