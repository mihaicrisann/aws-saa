import { useEffect, useState } from 'react'
import { domains, exam, scaledScore, shortDomain, domainVar, type DomainId } from '@/lib/content'

export interface DomainStat {
  id: DomainId
  total: number
  correct: number
}

const SIZE = 220
const C = SIZE / 2
const R = 92
const W = 12
const GAP = 5
const PASS_ACC = (exam.passingScore - exam.scaleMin) / (exam.scaleMax - exam.scaleMin)

const polar = (deg: number, r = R) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
}

function arcPath(from: number, to: number) {
  const a = polar(from)
  const b = polar(to)
  return `M ${a.x} ${a.y} A ${R} ${R} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`
}

/** One arc per domain. Arc length = its weight on the exam. Fill = your accuracy. Tick = the pass line. */
export default function Readiness({ stats, hideScore = false }: { stats: DomainStat[]; hideScore?: boolean }) {
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 50)
    return () => clearTimeout(t)
  }, [])

  const byId = Object.fromEntries(stats.map((s) => [s.id, s])) as Record<DomainId, DomainStat>
  const usable = 360 - GAP * domains.length
  const answered = stats.reduce((a, s) => a + s.total, 0)
  const weighted = domains.reduce((acc, d) => {
    const s = byId[d.id]
    return acc + (d.weight / 100) * (s && s.total ? s.correct / s.total : 0)
  }, 0)
  const score = scaledScore(weighted)

  let cursor = 0
  const arcs = domains.map((d) => {
    const span = (d.weight / 100) * usable
    const from = cursor
    cursor += span + GAP
    const s = byId[d.id]
    return { d, from, to: from + span, span, acc: s && s.total ? s.correct / s.total : 0, total: s?.total ?? 0 }
  })

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} role="img" aria-label={`Estimated score ${score}`}>
        {arcs.map(({ d, from, to, span, acc }) => {
          const len = (span / 360) * 2 * Math.PI * R
          const tickOut = polar(from + span * PASS_ACC, R + W / 2 + 3)
          const tickIn = polar(from + span * PASS_ACC, R - W / 2 - 3)
          return (
            <g key={d.id}>
              <path d={arcPath(from, to)} fill="none" stroke="var(--muted)" strokeWidth={W} />
              <path
                d={arcPath(from, to)}
                fill="none"
                stroke={domainVar(d.id)}
                strokeWidth={W}
                strokeDasharray={`${len} ${len}`}
                strokeDashoffset={drawn ? len * (1 - acc) : len}
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.22,.61,.36,1)' }}
              />
              <line x1={tickIn.x} y1={tickIn.y} x2={tickOut.x} y2={tickOut.y} stroke="var(--muted-foreground)" strokeWidth="1.5" />
            </g>
          )
        })}
        {hideScore ? (
          <text x={C} y={C + 4} textAnchor="middle" fontSize="12" fill="var(--muted-foreground)">
            {answered} answered
          </text>
        ) : (
          <>
            <text x={C} y={C - 2} textAnchor="middle" fontSize="40" fontWeight="600" fill="currentColor" letterSpacing="-0.03em">
              {answered ? score : '—'}
            </text>
            <text x={C} y={C + 20} textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">
              estimated · pass {exam.passingScore}
            </text>
          </>
        )}
      </svg>

      <div className="grid w-full gap-1.5 text-sm">
        {arcs.map(({ d, acc, total }) => (
          <div key={d.id} className="grid grid-cols-[8px_1fr_36px_44px] items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: domainVar(d.id) }} />
            <span className="truncate text-muted-foreground">{shortDomain(d.id)}</span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">{d.weight}%</span>
            <span className="text-right tabular-nums">{total ? `${Math.round(acc * 100)}%` : '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
