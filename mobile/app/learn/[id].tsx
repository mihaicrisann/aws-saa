import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import { NotesSheet } from '@/components/learn/notes-sheet'
import { BarButton } from '@/components/learn/parts'
import { lectureHtml } from '@/generated/lectures'
import { lectureById, lectureNo, lectures } from '@/lib/content'
import { markLectureRead, useStore } from '@/lib/store'
import { hairline, useTheme, useThemeName } from '@/theme/tokens'
import { useType } from '@/theme/type'

const jsonStr = (s: string) => JSON.stringify(s)

export default function LectureReader() {
  const { id = '', section } = useLocalSearchParams<{ id: string; section?: string }>()
  const router = useRouter()
  const t = useTheme()
  const themeName = useThemeName()
  const type = useType()
  const insets = useSafeAreaInsets()

  const web = useRef<WebView>(null)
  const [ratio, setRatio] = useState(0)
  const [notesOpen, setNotesOpen] = useState(false)

  const doc = lectureHtml[id]
  const lecture = lectureById[id]
  const idx = lectures.findIndex((l) => l.id === id)
  const prev = idx > 0 ? lectures[idx - 1] : undefined
  const next = idx >= 0 ? lectures[idx + 1] : undefined

  const readAt = useStore((s) => s.lectureRead[id])
  const hasNote = useStore((s) => (s.notes[id] ?? '').trim().length > 0)

  // The theme baked into the document is the one at mount, so there is no flash;
  // later changes go through window.setTheme instead of reloading the page.
  const mountTheme = useRef(themeName).current
  const html = useMemo(
    () => doc?.html.replace('<html lang="en" data-theme="light">', `<html lang="en" data-theme="${mountTheme}">`) ?? '',
    [doc, mountTheme],
  )

  useEffect(() => {
    web.current?.injectJavaScript(`window.setTheme && window.setTheme(${jsonStr(themeName)}); true;`)
  }, [themeName])

  const goto = useCallback(
    (to: string) => {
      setRatio(0)
      router.replace({ pathname: '/learn/[id]', params: { id: to } })
    },
    [router],
  )

  const markAndAdvance = () => {
    markLectureRead(id)
    if (next) goto(next.id)
  }

  const onLoadEnd = () => {
    web.current?.injectJavaScript(
      `window.setTheme && window.setTheme(${jsonStr(themeName)});` +
        (section ? `window.goToSection && window.goToSection(${jsonStr(section)});` : '') +
        ' true;',
    )
  }

  if (!doc || !lecture) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background, padding: 24, paddingTop: insets.top + 24, gap: 12 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={type.body}>No lecture with the id “{id}”.</Text>
        <Pressable onPress={() => router.replace('/learn')}>
          <Text style={[type.body, { textDecorationLine: 'underline' }]}>Back to the list</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background, paddingTop: insets.top }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        <BarButton
          icon="chevron-back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/learn'))}
        />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[type.mono, { fontSize: 12, color: t.faintForeground }]}>
            {lectureNo(id)}
          </Text>
          <Text style={[type.body, { fontSize: 15, flex: 1 }]} numberOfLines={1}>
            {lecture.title}
          </Text>
        </View>
        <BarButton icon="create-outline" onPress={() => setNotesOpen(true)} dot={hasNote} />
      </View>

      <View style={{ height: 2, backgroundColor: t.border }}>
        <View style={{ height: 2, width: `${ratio * 100}%`, backgroundColor: t.foreground }} />
      </View>

      <WebView
        ref={web}
        originWhitelist={['*']}
        source={{ html }}
        injectedJavaScriptBeforeContentLoaded={`document.documentElement && (document.documentElement.dataset.theme = ${jsonStr(themeName)}); true;`}
        onLoadEnd={onLoadEnd}
        onShouldStartLoadWithRequest={(req) => {
          if (!/^https?:/i.test(req.url)) return true
          Linking.openURL(req.url).catch(() => {})
          return false
        }}
        decelerationRate="normal"
        allowsBackForwardNavigationGestures={false}
        style={{ flex: 1, backgroundColor: t.background }}
        containerStyle={{ backgroundColor: t.background }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data)
            if (msg.type === 'scroll') setRatio(msg.ratio)
          } catch {}
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 12,
          paddingTop: 10,
          paddingBottom: insets.bottom || 10,
          borderTopWidth: hairline,
          borderColor: t.border,
          backgroundColor: t.background,
        }}
      >
        <BarButton icon="arrow-back" onPress={() => prev && goto(prev.id)} disabled={!prev} />
        <BarButton icon="arrow-forward" onPress={() => next && goto(next.id)} disabled={!next} />
        <View style={{ flex: 1 }} />
        <BarButton
          primary
          icon={readAt ? 'checkmark' : undefined}
          label={readAt ? 'Read' : next ? 'Mark read, next' : 'Mark read'}
          onPress={markAndAdvance}
        />
      </View>

      <NotesSheet
        key={id}
        noteKey={id}
        title={lecture.title}
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
      />
    </View>
  )
}
