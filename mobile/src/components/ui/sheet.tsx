import type { ReactNode } from 'react'
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { radius, space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'

/** The bottom sheet itself: a scrim, a rounded panel, one eyebrow title. */
export function SheetShell({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useTheme()
  const type = useType()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={{
            maxHeight: '82%',
            backgroundColor: t.background,
            borderTopLeftRadius: radius['2xl'],
            borderTopRightRadius: radius['2xl'],
            borderTopWidth: 1,
            borderColor: t.border,
            paddingBottom: insets.bottom,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: space[5],
              paddingVertical: space[4],
              borderBottomWidth: 1,
              borderBottomColor: t.border,
            }}
          >
            <Text style={type.eyebrow}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={12}>
              <Text style={[type.mono, { fontSize: 13, color: t.mutedForeground }]}>Done</Text>
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

/** A bottom sheet holding one long list — the lecture picker, mostly. */
export function Sheet<T extends string>({
  open,
  title,
  items,
  value,
  onSelect,
  onClose,
}: {
  open: boolean
  title: string
  items: { value: T; label: string; hint?: string }[]
  value: T
  onSelect: (v: T) => void
  onClose: () => void
}) {
  const t = useTheme()
  const type = useType()
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View
        style={{
          maxHeight: '72%',
          backgroundColor: t.background,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          borderTopWidth: 1,
          borderColor: t.border,
          paddingBottom: insets.bottom,
        }}
      >
        <View
          style={{
            paddingHorizontal: space[5],
            paddingVertical: space[4],
            borderBottomWidth: 1,
            borderBottomColor: t.border,
          }}
        >
          <Text style={type.eyebrow}>{title}</Text>
        </View>
        <FlatList
          data={items}
          keyExtractor={(i) => i.value}
          renderItem={({ item }) => {
            const on = item.value === value
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value)
                  onClose()
                }}
                style={{
                  flexDirection: 'row',
                  gap: space[3],
                  alignItems: 'center',
                  paddingHorizontal: space[5],
                  paddingVertical: space[3],
                  borderBottomWidth: 1,
                  borderBottomColor: t.border,
                }}
              >
                {item.hint ? (
                  <Text style={[type.mono, { fontSize: 12, color: t.faintForeground }]}>{item.hint}</Text>
                ) : null}
                <Text
                  numberOfLines={1}
                  style={[type.body, { flex: 1, color: on ? t.foreground : t.mutedForeground }]}
                >
                  {item.label}
                </Text>
                {on ? <Text style={[type.mono, { fontSize: 12 }]}>✓</Text> : null}
              </Pressable>
            )
          }}
        />
      </View>
    </Modal>
  )
}
