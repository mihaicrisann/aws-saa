import { useEffect, useRef } from 'react'
import { Animated, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { lectureNo, type Flashcard } from '@/lib/content'
import { describeInterval, type Grade } from '@/lib/srs'
import type { CardState } from '@/lib/store'
import { radius, space, useTheme } from '@/theme/tokens'
import { fonts, useType } from '@/theme/type'
import { Button, Frame, Meter, Panel, Pressable98, useMotion } from '@/components/ui'
import { DomainBadge } from '@/components/question'

const GRADES: { g: Grade; label: string }[] = [
  { g: 0, label: 'Again' },
  { g: 1, label: 'Hard' },
  { g: 2, label: 'Good' },
  { g: 3, label: 'Easy' },
]

export function CardSession({
  card,
  state,
  flipped,
  done,
  left,
  onFlip,
  onGrade,
  onQuit,
}: {
  card: Flashcard
  state: CardState
  flipped: boolean
  done: number
  left: number
  onFlip: () => void
  onGrade: (g: Grade) => void
  onQuit: () => void
}) {
  const t = useTheme()
  const type = useType()
  const router = useRouter()
  const { duration } = useMotion()
  const face = useRef(new Animated.Value(flipped ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(face, {
      toValue: flipped ? 1 : 0,
      duration,
      useNativeDriver: true,
    }).start()
  }, [flipped, duration, face])

  return (
    <Frame
      scroll={false}
      footer={
        flipped ? (
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            {GRADES.map((g) => (
              <Pressable98
                key={g.g}
                accessibilityLabel={g.label}
                onPress={() => onGrade(g.g)}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: t.border,
                  borderRadius: radius.md,
                  paddingVertical: space[2],
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.sansMedium,
                    fontSize: 13,
                    color: g.g === 0 ? t.bad : g.g >= 2 ? t.good : t.foreground,
                  }}
                >
                  {g.label}
                </Text>
                <Text style={[type.mono, { fontSize: 11, color: t.mutedForeground }]}>
                  {describeInterval(state, g.g)}
                </Text>
              </Pressable98>
            ))}
          </View>
        ) : (
          <Button label="Show answer" onPress={onFlip} grow />
        )
      }
      top={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[3],
            paddingBottom: space[4],
          }}
        >
          <Pressable98 onPress={onQuit} accessibilityLabel="End the session">
            <Text style={[type.muted, { fontSize: 13 }]}>End</Text>
          </Pressable98>
          <Meter value={done / Math.max(1, done + left)} />
          <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground }]}>
            {done + 1} / {done + left}
          </Text>
        </View>
      }
    >
      <Pressable style={{ flex: 1 }} onPress={onFlip} accessibilityLabel="Flip the card">
        <View style={{ flex: 1 }}>
          <Animated.View
            pointerEvents={flipped ? 'none' : 'auto'}
            style={{ ...fill, opacity: face.interpolate(fadeOut) }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
              <DomainBadge id={card.domain} />
              <Text style={[type.mono, { fontSize: 11, color: t.mutedForeground }]}>
                Lecture {lectureNo(card.lecture)}
              </Text>
              {state.reps > 0 ? (
                <Text
                  style={[
                    type.mono,
                    { fontSize: 11, color: t.faintForeground, marginLeft: 'auto' },
                  ]}
                >
                  seen {state.reps}×
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text style={[type.display, { fontSize: 22, lineHeight: 29 }]}>{card.front}</Text>
            </View>
            <Text style={[type.muted, { fontSize: 12 }]}>Tap to flip</Text>
          </Animated.View>

          <Animated.View
            pointerEvents={flipped ? 'auto' : 'none'}
            style={{ ...fill, opacity: face }}
          >
            <Text style={[type.eyebrow, { textTransform: 'none', letterSpacing: 0 }]} numberOfLines={2}>
              {card.front}
            </Text>
            <ScrollView
              style={{ flex: 1, marginTop: space[4] }}
              contentContainerStyle={{ gap: space[4], paddingBottom: space[4] }}
            >
              <Text style={[type.body, { fontSize: 15, lineHeight: 23 }]}>{card.back}</Text>
              {card.note ? (
                <Panel>
                  <Text style={[type.muted, { fontSize: 13 }]}>
                    <Text style={{ color: t.foreground, fontFamily: fonts.sansMedium }}>
                      Exam note.{' '}
                    </Text>
                    {card.note}
                  </Text>
                </Panel>
              ) : null}
              <Pressable98
                accessibilityLabel="Read the lecture"
                onPress={() =>
                  router.push({ pathname: '/learn/[id]', params: { id: card.lecture } })
                }
              >
                <Text style={[type.muted, { fontSize: 13, color: t.foreground }]}>
                  Read the lecture ↗
                </Text>
              </Pressable98>
            </ScrollView>
          </Animated.View>
        </View>
      </Pressable>
    </Frame>
  )
}

const fill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  gap: space[3],
}

const fadeOut = { inputRange: [0, 1], outputRange: [1, 0] }
