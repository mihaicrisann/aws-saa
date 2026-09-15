import { Text, View } from 'react-native'
import { radius, space, useTheme } from '@/theme/tokens'
import { fonts } from '@/theme/type'
import { shortDomain, type DomainId } from '@/lib/content'

/** One hue per exam domain, the only colour on the card. */
export function DomainBadge({ id }: { id: DomainId }) {
  const t = useTheme()
  const color = t.domain[id]
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1] + 2,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: t.border,
        paddingHorizontal: space[2],
        paddingVertical: 3,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text
        style={{
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: t.mutedForeground,
        }}
      >
        {shortDomain(id)}
      </Text>
    </View>
  )
}
