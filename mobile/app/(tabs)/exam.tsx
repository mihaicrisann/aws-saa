import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { ExamSession, ExamStart, isExpired, newExam, submitExam } from '@/components/exam'
import { findQuestion } from '@/lib/content'
import type { ActiveExam, QuestionBank } from '@/lib/progress'
import { finishExam, getStore, newId, setActiveExam, useStore } from '@/lib/store'

export default function ExamTab() {
  const active = useStore((s) => s.activeExam)
  const exams = useStore((s) => s.exams)
  const [bank, setBank] = useState<QuestionBank>('original')
  const router = useRouter()

  const open = useCallback(
    (id: string) => router.push({ pathname: '/exam/[id]', params: { id } }),
    [router],
  )

  const submit = useCallback(() => {
    const live = getStore().activeExam
    if (!live) return
    const { attempts, result } = submitExam(live)
    finishExam(attempts, result)
    open(result.id ?? live.id)
  }, [open])

  const question = active ? findQuestion(active.ids[active.index ?? 0]) : undefined

  // A sitting whose clock ran out while the app was closed is scored on resume.
  useEffect(() => {
    if (active && (isExpired(active) || !question)) submit()
  }, [active, question, submit])

  const edit = (fn: (e: ActiveExam) => ActiveExam) => {
    const live = getStore().activeExam
    if (live) setActiveExam(fn(live))
  }

  if (!active)
    return (
      <ExamStart
        bank={bank}
        onBank={setBank}
        exams={exams}
        onStart={() => setActiveExam(newExam(newId(), bank))}
        onOpen={open}
      />
    )

  if (!question) return null

  return <ExamSession exam={active} question={question} onEdit={edit} onSubmit={submit} />
}
