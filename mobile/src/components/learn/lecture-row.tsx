import { Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { Lecture } from '@/lib/content'
import { useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { DomainDot, Row } from './parts'

export function LectureRow({
  lecture,
  read,
  onPress,
}: {
  lecture: Lecture
  read: boolean
  onPress: () => void
}) {
  const t = useTheme()
  const type = useType()

  return (
    <Row onPress={onPress} style={{ paddingVertical: 12, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Text
          style={[
            type.mono,
            { fontSize: 12, lineHeight: 20, color: read ? t.good : t.faintForeground },
          ]}
        >
          {String(lecture.n).padStart(2, '0')}
        </Text>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[type.body, { fontSize: 15, lineHeight: 20 }]} numberOfLines={2}>
            {lecture.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {lecture.domains.map((d) => (
                <DomainDot key={d} id={d} />
              ))}
            </View>
            <Text style={[type.mono, { fontSize: 11, color: t.faintForeground }]}>
              {lecture.minutes}m
            </Text>
          </View>
        </View>
        {read ? <Ionicons name="checkmark" size={16} color={t.good} style={{ marginTop: 2 }} /> : null}
      </View>
    </Row>
  )
}
