import { useCallback, useMemo, useState } from 'react'
import {
  currentQuestion,
  defaultSettings,
  DrillSession,
  DrillSetup,
  DrillSummary,
  check as checkDrill,
  advance,
  isFinished,
  newSession,
  seenInBank,
  settingsOf,
  type DrillSettings,
} from '@/components/drill'
import { attemptXp } from '@/lib/game'
import type { ActiveDrill } from '@/lib/progress'
import {
  getStore,
  newId,
  recordDrillAttempt,
  setActiveDrill,
  useStore,
  type Confidence,
} from '@/lib/store'

export default function Drill() {
  const drill = useStore((s) => s.activeDrill)
  const attempts = useStore((s) => s.attempts)
  const [settings, setSettings] = useState<DrillSettings>(defaultSettings)
  const [toast, setToast] = useState<{ message: string | null; id: number }>({
    message: null,
    id: 0,
  })

  const seen = useMemo(() => seenInBank(attempts, settings.bank), [attempts, settings.bank])

  const start = useCallback(
    (s: DrillSettings) => {
      const fresh = seenInBank(getStore().attempts, s.bank)
      setActiveDrill(newSession(newId(), s, fresh))
    },
    [],
  )

  const edit = (fn: (d: ActiveDrill) => ActiveDrill) => {
    const current = getStore().activeDrill
    if (current) setActiveDrill(fn(current))
  }

  const check = useCallback(() => {
    const current = getStore().activeDrill
    const q = currentQuestion(current)
    if (!current || !q || current.revealed || !current.chosen.length) return
    const { attempt, next } = checkDrill(current, q)
    recordDrillAttempt(attempt, next)
    setToast((x) => ({ message: `+${attemptXp(attempt)} xp`, id: x.id + 1 }))
  }, [])

  if (!drill)
    return (
      <DrillSetup
        settings={settings}
        onChange={setSettings}
        seen={seen}
        onStart={() => start(settings)}
      />
    )

  const question = currentQuestion(drill)

  if (isFinished(drill) || !question)
    return (
      <DrillSummary
        drill={drill}
        onDone={() => setActiveDrill(null)}
        onAgain={() => {
          const again = settingsOf(drill)
          setSettings(again)
          start(again)
        }}
      />
    )

  return (
    <DrillSession
      drill={drill}
      question={question}
      toast={toast}
      onChoose={(chosen) => edit((d) => ({ ...d, chosen }))}
      onConfidence={(confidence: Confidence | undefined) => edit((d) => ({ ...d, confidence }))}
      onCheck={check}
      onNext={() => edit((d) => advance(d))}
      onQuit={() => setActiveDrill(null)}
    />
  )
}
