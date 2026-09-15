import { useMemo, useState } from 'react'
import { Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ExamResults, ExamReview, reviewItems } from '@/components/exam'
import { useStore } from '@/lib/store'
import { useType } from '@/theme/type'
import { Button, Frame, Header } from '@/components/ui'

export default function ExamResultRoute() {
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const result = useStore((s) => s.exams.find((e) => e.id === id))
  const attempts = useStore((s) => s.attempts)
  const [phase, setPhase] = useState<'results' | 'review'>('results')
  const router = useRouter()
  const type = useType()

  const items = useMemo(() => (result ? reviewItems(result, attempts) : []), [result, attempts])

  const done = () =>
    router.canGoBack() ? router.back() : router.replace({ pathname: '/(tabs)/exam' })

  if (!result)
    return (
      <Frame footer={<Button label="Back" onPress={done} grow />}>
        <Header eyebrow="Mock exam" title="Not found" />
        <Text style={type.muted}>That sitting is no longer in your progress.</Text>
      </Frame>
    )

  if (phase === 'review')
    return <ExamReview items={items} onBack={() => setPhase('results')} />

  return (
    <ExamResults
      result={result}
      wrongCount={result.wrongIds.length}
      onReview={() => setPhase('review')}
      onDone={done}
    />
  )
}
