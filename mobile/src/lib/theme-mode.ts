import { useSyncExternalStore } from 'react'
import Storage from 'expo-sqlite/kv-store'
import { setTheme } from './store'

/**
 * Three-way theme preference. `Progress.theme` is light|dark and its schema is strict,
 * so "follow the system" lives in its own key and the resolved colour is mirrored back
 * into progress for the export and the lecture WebView.
 */
export type ThemeMode = 'system' | 'light' | 'dark'

const KEY = 'saa.themeMode'
const modes: ThemeMode[] = ['system', 'light', 'dark']

const listeners = new Set<() => void>()

function read(): ThemeMode {
  try {
    const raw = Storage.getItemSync(KEY)
    return modes.includes(raw as ThemeMode) ? (raw as ThemeMode) : 'system'
  } catch {
    return 'system'
  }
}

let mode = read()

export const getThemeMode = () => mode

export function setThemeMode(next: ThemeMode, resolved: 'light' | 'dark') {
  mode = next
  try {
    Storage.setItemSync(KEY, next)
  } catch {}
  setTheme(next === 'system' ? resolved : next)
  listeners.forEach((l) => l())
}

export function useThemeMode(): ThemeMode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    () => mode,
    () => mode,
  )
}
