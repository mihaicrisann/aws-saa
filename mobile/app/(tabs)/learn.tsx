import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/screen'
import { LectureRow } from '@/components/learn/lecture-row'
import { Divider } from '@/components/learn/parts'
import { lectures, modules } from '@/lib/content'
import { useStore } from '@/lib/store'
import { useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

export default function Learn() {
  const readMap = useStore((s) => s.lectureRead)
  const read = Object.keys(readMap).length
  const router = useRouter()
  const t = useTheme()
  const type = useType()

  return (
    <Screen title="Learn" statLabel="Read" statValue={`${read} / ${lectures.length}`}>
      <ScrollView
        style={{ flex: 1, marginHorizontal: -20 }}
        contentContainerStyle={{ paddingBottom: 4 }}
        showsVerticalScrollIndicator={false}
      >
        {modules.map((m) => {
          const ls = lectures.filter((l) => l.module === m.id)
          if (!ls.length) return null
          return (
            <View key={m.id} style={{ marginBottom: 20 }}>
              <View style={{ paddingHorizontal: 20, paddingBottom: 10, gap: 5 }}>
                <Text style={type.eyebrow}>{m.name}</Text>
                <Text style={[type.muted, { fontSize: 13, lineHeight: 18 }]}>{m.blurb}</Text>
              </View>
              <View style={{ borderTopWidth: 1, borderColor: t.border }}>
                {ls.map((l, i) => (
                  <View key={l.id}>
                    {i > 0 ? <Divider /> : null}
                    <LectureRow
                      lecture={l}
                      read={!!readMap[l.id]}
                      onPress={() => router.push({ pathname: '/learn/[id]', params: { id: l.id } })}
                    />
                  </View>
                ))}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </Screen>
  )
}
