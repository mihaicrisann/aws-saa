import { domains, type DomainId } from '@/lib/content'
import type { Attempt } from '@/lib/store'

export interface DomainAccuracy {
  id: DomainId
  total: number
  correct: number
  /** Null until there is anything to divide. */
  accuracy: number | null
}

/** The last `n` answers, split by domain. Recent beats lifetime: it shows where you are now. */
export function recentByDomain(attempts: Attempt[], n = 50): DomainAccuracy[] {
  const recent = [...attempts].sort((a, b) => a.at - b.at).slice(-n)
  return domains.map((d) => {
    const rel = recent.filter((a) => a.domain === d.id)
    const correct = rel.filter((a) => a.correct).length
    return {
      id: d.id,
      total: rel.length,
      correct,
      accuracy: rel.length ? correct / rel.length : null,
    }
  })
}
