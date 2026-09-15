import { useCallback, useEffect, useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { setNote, useStore } from '@/lib/store'
import { useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { BarButton } from './parts'

const IDLE_MS = 600

/**
 * Bottom sheet holding the note for one lecture. Keystrokes stay local and reach
 * the store once typing pauses and again on close, so dismissing mid-sentence
 * never drops text.
 */
export function NotesSheet({
  noteKey,
  title,
  open,
  onClose,
}: {
  noteKey: string
  title: string
  open: boolean
  onClose: () => void
}) {
  const t = useTheme()
  const type = useType()
  const insets = useSafeAreaInsets()
  const saved = useStore((s) => s.notes[noteKey] ?? '')
  const [draft, setDraft] = useState(saved)
  const latest = useRef(saved)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const commit = useCallback(() => {
    if (timer.current === undefined) return
    clearTimeout(timer.current)
    timer.current = undefined
    setNote(noteKey, latest.current)
  }, [noteKey])

  // Adopt a value saved elsewhere only while this field has nothing outstanding.
  useEffect(() => {
    if (timer.current === undefined) {
      latest.current = saved
      setDraft(saved)
    }
  }, [saved])

  useEffect(() => commit, [commit])

  const close = () => {
    commit()
    onClose()
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            backgroundColor: t.background,
            borderTopWidth: 1,
            borderColor: t.borderStrong,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            paddingBottom: insets.bottom + 20,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={[type.eyebrow, { flex: 1 }]} numberOfLines={1}>
              Notes · {title}
            </Text>
            <BarButton label="Done" onPress={close} />
          </View>
          <TextInput
            value={draft}
            onChangeText={(v) => {
              latest.current = v
              setDraft(v)
              clearTimeout(timer.current)
              timer.current = setTimeout(commit, IDLE_MS)
            }}
            onBlur={commit}
            multiline
            autoFocus
            placeholder="Saved as you type."
            placeholderTextColor={t.faintForeground}
            style={[
              type.body,
              {
                minHeight: 160,
                maxHeight: 280,
                borderWidth: 1,
                borderColor: t.border,
                borderRadius: 14,
                padding: 12,
                textAlignVertical: 'top',
                backgroundColor: t.card,
              },
            ]}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
