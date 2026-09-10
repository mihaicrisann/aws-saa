import { useEffect, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Eases a number from 0 to `target` once, so a score lands instead of appearing. */
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(() => (reduced() ? target : 0))
  useEffect(() => {
    if (reduced()) { setValue(target); return }
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}
