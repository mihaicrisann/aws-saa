import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { ColorValue } from 'react-native'
import { useTheme } from '@/theme/tokens'
import { fonts } from '@/theme/type'

type IconName = keyof typeof Ionicons.glyphMap

const tab =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color as string} size={size} />
  )

export default function TabsLayout() {
  const t = useTheme()
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.canvas },
        tabBarActiveTintColor: t.foreground,
        tabBarInactiveTintColor: t.faintForeground,
        tabBarStyle: {
          backgroundColor: t.canvas,
          borderTopWidth: 1,
          borderTopColor: t.border,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.monoMedium,
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tab('home-outline') }} />
      <Tabs.Screen name="learn" options={{ title: 'Learn', tabBarIcon: tab('book-outline') }} />
      <Tabs.Screen name="drill" options={{ title: 'Drill', tabBarIcon: tab('flash-outline') }} />
      <Tabs.Screen name="cards" options={{ title: 'Cards', tabBarIcon: tab('albums-outline') }} />
      <Tabs.Screen name="exam" options={{ title: 'Exam', tabBarIcon: tab('timer-outline') }} />
    </Tabs>
  )
}
