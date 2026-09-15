import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { useFonts } from 'expo-font'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { startSync } from '@/lib/sync/triggers'
import { tokensFor, useTheme, useThemeName } from '@/theme/tokens'

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  // The store loads synchronously at import, so fonts are the only thing to wait for.
  const [ready] = useFonts({
    Inter_400Regular: require('../assets/fonts/Inter_400Regular.ttf'),
    Inter_500Medium: require('../assets/fonts/Inter_500Medium.ttf'),
    Inter_600SemiBold: require('../assets/fonts/Inter_600SemiBold.ttf'),
    Inter_700Bold: require('../assets/fonts/Inter_700Bold.ttf'),
    GeistMono_400Regular: require('../assets/fonts/GeistMono_400Regular.ttf'),
    GeistMono_500Medium: require('../assets/fonts/GeistMono_500Medium.ttf'),
    GeistMono_600SemiBold: require('../assets/fonts/GeistMono_600SemiBold.ttf'),
  })
  const theme = useTheme()
  const name = useThemeName()

  // Navigation paints the scene behind every screen; left on its default it flashes white.
  const navTheme = useMemo(() => {
    const base = name === 'dark' ? DarkTheme : DefaultTheme
    const t = tokensFor(name)
    return {
      ...base,
      dark: name === 'dark',
      colors: {
        ...base.colors,
        background: t.canvas,
        card: t.canvas,
        border: t.border,
        text: t.foreground,
        primary: t.foreground,
      },
    }
  }, [name])

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {})
  }, [ready])

  // Launch, foreground, reconnect and a slow poll — the only sync triggers there are.
  useEffect(startSync, [])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, backgroundColor: theme.canvas }}>
          <StatusBar style={name === 'dark' ? 'light' : 'dark'} animated />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: theme.canvas },
              navigationBarColor: theme.canvas,
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="learn/[id]" options={{ headerShown: true, title: '' }} />
          </Stack>
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
