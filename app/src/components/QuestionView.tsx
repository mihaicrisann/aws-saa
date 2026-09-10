import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Copy, ArrowUpRight } from 'lucide-react'
import { isMulti, lectureNo, questionHref, type Question } from '@/lib/content'
import { Badge } from '@/components/ui/badge'
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <DomainBadge id={q.domain} />
          <span className="text-xs text-muted-foreground">Lecture {lectureNo(q.lecture)}</span>
          {multi && <Badge variant="secondary">Choose {q.correct.length}</Badge>}
        </div>
      )}

      <p className="text-base leading-relaxed font-medium">{q.stem}</p>

      <div className="mt-5 grid gap-2" role={multi ? 'group' : 'radiogroup'}>
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
                'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors',
                'disabled:cursor-default',
                tone === 'idle' && !revealed && 'hover:bg-muted/60',
                tone === 'picked' && 'border-foreground bg-muted/40',
                tone === 'right' && 'border-good/60 bg-good/8',
                tone === 'wrong' && 'border-bad/60 bg-bad/8',
                revealed && tone === 'idle' && 'opacity-60',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center border text-[11px] font-medium',
                  multi ? 'rounded-md' : 'rounded-full',
                  tone === 'picked' && 'border-foreground bg-foreground text-background',
                  tone === 'right' && 'border-good bg-good text-white',
                  tone === 'wrong' && 'border-bad bg-bad text-white',
                  tone === 'idle' && 'text-muted-foreground',
                )}
              >
                {tone === 'right' ? <Check className="size-3" /> : tone === 'wrong' ? <X className="size-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">{opt}</span>
              {revealed && (picked || right) && (
                <span className={cn('shrink-0 text-xs', picked ? (right ? 'text-good' : 'text-bad') : 'text-muted-foreground')}>
                  {picked ? 'your answer' : 'missed'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {revealed && (
        <div className="rise mt-5 grid gap-3">
          <div className="rounded-2xl border-l-2 border-good bg-muted/40 px-4 py-3">
            <div className="text-xs font-medium text-good">
              Why {q.correct.map((i) => i + 1).join(' + ')}
            </div>
            <p className="mt-1 text-sm leading-relaxed">{q.explanation}</p>
          </div>
          {q.distractors?.some(Boolean) && (
            <div className="rounded-2xl border px-4 py-3">
              <div className="text-xs font-medium text-muted-foreground">Why the others are wrong</div>
              <ul className="mt-2 grid gap-1.5">
                {q.distractors.map((d, i) =>
                  d ? (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                      <span className="w-4 shrink-0 font-medium text-foreground">{i + 1}</span>
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
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <Button render={<Link to={questionHref(q)} />} variant="ghost" size="xs">{q.anchor ? 'Read the section' : `Lecture ${lectureNo(q.lecture)}`} <ArrowUpRight /></Button>
      <Button variant="ghost" size="xs" onClick={copy}>
        <Copy /> {copied ? 'Copied — paste in the terminal' : 'Ask Claude about this'}
      </Button>
    </div>
  )
}
