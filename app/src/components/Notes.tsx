'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { setNote, useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const IDLE_MS = 600

/**
 * A note field backed by the progress store. Keystrokes stay local and reach the
 * store once typing pauses, on blur, and on unmount, so navigating away or
 * closing the tab mid-sentence never drops the text.
 */
export default function Notes({
  noteKey,
  label,
  placeholder,
  className,
  describedBy,
}: {
  noteKey: string
  label: string
  placeholder: string
  className?: string
  describedBy?: string
}) {
  const saved = useStore((s) => s.notes[noteKey] ?? '')
  const [draft, setDraft] = useState(saved)
  const latest = useRef(saved)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const commit = useCallback(() => {
    if (timer.current === undefined) return
    clearTimeout(timer.current)
    timer.current = undefined
    try {
      setNote(noteKey, latest.current)
    } catch {
      // The progress store closed under us (sign-out); the text stays in the field.
    }
  }, [noteKey])

  // Adopt a value saved elsewhere only while this field has nothing outstanding.
  useEffect(() => {
    if (timer.current === undefined) {
      latest.current = saved
      setDraft(saved)
    }
  }, [saved])

  useEffect(() => {
    window.addEventListener('pagehide', commit)
    return () => {
      window.removeEventListener('pagehide', commit)
      commit()
    }
  }, [commit])

  return (
    <textarea
      aria-label={label}
      aria-describedby={describedBy}
      value={draft}
      onChange={(e) => {
        latest.current = e.target.value
        setDraft(e.target.value)
        clearTimeout(timer.current)
        timer.current = setTimeout(commit, IDLE_MS)
      }}
      onBlur={commit}
      placeholder={placeholder}
      className={cn(
        'w-full resize-y rounded-xl border bg-background p-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring',
        className,
      )}
    />
  )
}
