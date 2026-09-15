import { useEffect, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import { useMotion } from '@/components/ui'
import { useSyncStatus, type SyncStatus } from '@/lib/sync/engine'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

export function syncLabel(s: SyncStatus, compact = false) {
  switch (s.state) {
    case 'off':
      return ''
    case 'synced':
      return 'Saved'
    case 'syncing':
      return 'Saving'
    case 'offline':
      return s.pendingCount ? `Offline, ${s.pendingCount} pending` : 'Offline'
    case 'error':
      return compact || !s.detail ? 'Not saved' : `Not saved: ${s.detail}`
  }
}

/** The dot on its own, pulsing only while a request is in flight. */
function Dot({ state }: { state: SyncStatus['state'] }) {
  const t = useTheme()
  const { reduced } = useMotion()
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (state !== 'syncing' || reduced) {
      pulse.setValue(1)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [state, reduced, pulse])

  const color =
    state === 'synced'
      ? t.good
      : state === 'error'
        ? t.bad
        : state === 'off'
          ? t.borderStrong
          : t.mutedForeground

  return <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, opacity: pulse }} />
}

/** Dot plus label. `compact` is the Home header version, which never wraps. */
export function SyncDot({ compact }: { compact?: boolean }) {
  const status = useSyncStatus()
  const type = useType()
  const t = useTheme()
  if (status.state === 'off') return null
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Sync: ${syncLabel(status)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
    >
      <Dot state={status.state} />
      <Text
        numberOfLines={compact ? 1 : undefined}
        style={[type.mono, { fontSize: 11, color: status.state === 'error' ? t.bad : t.mutedForeground, flexShrink: 1 }]}
      >
        {syncLabel(status, compact)}
      </Text>
    </View>
  )
}
