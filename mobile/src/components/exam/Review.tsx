import { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { lectureNo } from '@/lib/content'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Choice, Frame, Header, Pressable98 } from '@/components/ui'
import { QuestionView } from '@/components/question'
import { fmtClock, type ReviewItem } from './logic'

function Verdict({ item }: { item: ReviewItem }) {
  const t = useTheme()
  const type = useType()
  const label = item.ok ? 'correct' : item.chosen.length ? 'wrong' : 'blank'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground }]}>Q{item.n + 1}</Text>
      <Text style={[type.eyebrow, { color: item.ok ? t.good : t.bad }]}>{label}</Text>
      <Text
        style={[type.mono, { marginLeft: 'auto', fontSize: 11, color: t.faintForeground }]}
      >
        {fmtClock(item.seconds)}
      </Text>
    </View>
  )
}

export function ExamReview({ items, onBack }: { items: ReviewItem[]; onBack: () => void }) {
  const t = useTheme()
  const type = useType()
  const router = useRouter()
  const [scope, setScope] = useState<'missed' | 'all'>('missed')
  const shown = scope === 'all' ? items : items.filter((i) => !i.ok)

  return (
    <Frame footer={<Button label="Results" onPress={onBack} grow />}>
      <Header eyebrow="Mock exam" title="Review" />
      <Choice
        value={scope}
        options={[
          { value: 'missed' as const, label: `Missed ${items.filter((i) => !i.ok).length}` },
          { value: 'all' as const, label: `All ${items.length}` },
        ]}
        onChange={(v) => v && setScope(v)}
      />

      {shown.length === 0 ? (
        <Text style={type.muted}>Nothing missed. Sit another on a fresh draw.</Text>
      ) : null}

      {shown.map((item) => (
        <View
          key={item.q.id}
          style={{
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: 14,
            backgroundColor: t.card,
            padding: space[4],
            gap: space[4],
          }}
        >
          <Verdict item={item} />
          <QuestionView
            q={item.q}
            chosen={item.chosen}
            revealed
            onToggle={() => {}}
            footer={
              <Pressable98
                accessibilityLabel="Read the lecture section"
                onPress={() =>
                  router.push({
                    pathname: '/learn/[id]',
                    params: item.q.anchor
                      ? { id: item.q.lecture, section: item.q.anchor }
                      : { id: item.q.lecture },
                  })
                }
              >
                <Text style={[type.muted, { fontSize: 13, color: t.foreground }]}>
                  {item.q.anchor ? 'Read the section' : `Lecture ${lectureNo(item.q.lecture)}`} ↗
                </Text>
              </Pressable98>
            }
          />
        </View>
      ))}
      <View style={{ height: space[4] }} />
    </Frame>
  )
}
