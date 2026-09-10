import { useState } from 'react'
import { Link } from '@/lib/navigation'
import { Check, X, Copy, ArrowUpRight } from 'lucide-react'
import { isMulti, lectureNo, questionHref, type Question } from '@/lib/content'
import { Button } from '@/components/ui/button'
import { DomainBadge } from './parts'
import { cn } from '@/lib/utils'

/** A ready-to-paste prompt for the /explain skill in the terminal. */
export function askPrompt(q: Question, chosen: number[]) {
  const mark = (i: number) => (q.correct.includes(i) ? ' (correct)' : chosen.includes(i) ? ' (my answer)' : '')
  return [
    `/explain I got this SAA question wrong. Explain the reasoning and what cue I missed.`,
    ``,
    q.stem,
    ...q.options.map((o, i) => `${i + 1}. ${o}${mark(i)}`),
  ].join('\n')
}

export default function QuestionView({
  q,
  chosen,
  onToggle,
  revealed,
  showMeta = true,
}: {
  q: Question
  chosen: number[]
  onToggle: (i: number) => void
  revealed: boolean
  showMeta?: boolean
}) {
  const multi = isMulti(q)

  return (
    <div>
      {showMeta && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <DomainBadge id={q.domain} />
          <span className="mono text-[11px] text-muted-foreground">Lecture {lectureNo(q.lecture)}</span>
          {multi && <span className="eyebrow ml-auto text-foreground">Choose {q.correct.length}</span>}
        </div>
      )}

      <p className="text-[15px] leading-relaxed font-medium tracking-tight">{q.stem}</p>

      <div className="mt-5 grid gap-1.5" role={multi ? 'group' : 'radiogroup'}>
        {q.options.map((opt, i) => {
          const picked = chosen.includes(i)
          const right = q.correct.includes(i)
          const tone = !revealed ? (picked ? 'picked' : 'idle') : right ? 'right' : picked ? 'wrong' : 'idle'
          return (
            <button
              key={i}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={picked}
              disabled={revealed}
              onClick={() => onToggle(i)}
              className={cn(
                'pressable flex w-full items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-[13.5px] leading-relaxed',
                'disabled:cursor-default',
                tone === 'idle' && !revealed && 'hover:border-border-strong hover:bg-accent/40',
                tone === 'picked' && 'border-foreground bg-accent/50',
                tone === 'right' && 'border-good bg-good/6 shadow-[inset_0_0_0_1px_var(--good)]',
                tone === 'wrong' && 'border-bad bg-bad/6 shadow-[inset_0_0_0_1px_var(--bad)]',
                revealed && tone === 'idle' && 'opacity-50',
              )}
            >
              <span
                className={cn(
                  'mono mt-0.5 flex size-5 shrink-0 items-center justify-center border text-[11px] font-medium transition-colors duration-100',
                  multi ? 'rounded-[5px]' : 'rounded-full',
                  tone === 'picked' && 'border-foreground bg-foreground text-background',
                  tone === 'right' && 'border-good bg-good text-white',
                  tone === 'wrong' && 'border-bad bg-bad text-white',
                  tone === 'idle' && 'border-border-strong text-muted-foreground',
                )}
              >
                {tone === 'right' ? <Check className="size-3" strokeWidth={3} /> : tone === 'wrong' ? <X className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">{opt}</span>
              {revealed && (picked || right) && (
                <span className={cn('eyebrow mt-1 shrink-0', picked ? (right ? 'text-good' : 'text-bad') : 'text-muted-foreground')}>
                  {picked ? 'yours' : 'missed'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className="rise mt-6 grid gap-3">
          <div className="rounded-lg border border-good/40 bg-good/5 px-4 py-3">
            <div className="eyebrow text-good">
              Why {q.correct.map((i) => i + 1).join(' + ')}
            </div>
            <p className="mt-2 text-[13.5px] leading-relaxed">{q.explanation}</p>
          </div>
          {q.distractors?.some(Boolean) && (
            <div className="rounded-lg border px-4 py-3">
              <div className="eyebrow">Why the others are wrong</div>
              <ul className="mt-2.5 grid gap-1.5">
                {q.distractors.map((d, i) =>
                  d ? (
                    <li key={i} className="grid grid-cols-[16px_1fr] gap-2 text-[13px] leading-relaxed text-muted-foreground">
                      <span className="mono text-foreground">{i + 1}</span>
                      <span>{d}</span>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          )}
          <Footer q={q} chosen={chosen} />
        </div>
      )}
    </div>
  )
}

function Footer({ q, chosen }: { q: Question; chosen: number[] }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(askPrompt(q, chosen))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* clipboard blocked; nothing to do */ }
  }
  return (
    <div className="-ml-1 flex flex-wrap items-center gap-1">
      <Button render={<Link to={questionHref(q)} />} variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground">{q.anchor ? 'Read the section' : `Lecture ${lectureNo(q.lecture)}`} <ArrowUpRight /></Button>
      <Button variant="ghost" size="xs" className="text-muted-foreground hover:text-foreground" onClick={copy}>
        <Copy /> {copied ? 'Copied. Paste in the terminal' : 'Ask Claude about this'}
      </Button>
    </div>
  )
}
