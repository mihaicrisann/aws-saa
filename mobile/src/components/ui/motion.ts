import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/** `prefers-reduced-motion`, the native spelling. Fades stay, movement goes. */
export function useMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v))
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return { reduced, duration: reduced ? 0 : 180 }
}
