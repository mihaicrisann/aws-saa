import { AppState } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { getSyncMeta, restoreSession, sync } from './engine'

const POLL_MS = 5 * 60_000

/**
 * The pub/sub a phone actually needs: launch, foreground, connectivity coming back, and a
 * slow poll while the app is on screen. No sockets, no background work.
 */
export function startSync() {
  let poll: ReturnType<typeof setInterval> | undefined
  let online = true

  const tick = () => {
    if (getSyncMeta().userId) void sync()
  }

  const startPolling = () => {
    if (poll === undefined) poll = setInterval(tick, POLL_MS)
  }
  const stopPolling = () => {
    if (poll !== undefined) clearInterval(poll)
    poll = undefined
  }

  void restoreSession()
  startPolling()

  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      tick()
      startPolling()
    } else stopPolling()
  })

  const net = NetInfo.addEventListener((state) => {
    const reachable = state.isConnected !== false
    if (reachable && !online) tick()
    online = reachable
  })

  return () => {
    stopPolling()
    appState.remove()
    net()
  }
}
