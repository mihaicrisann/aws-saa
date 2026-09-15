import { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { AccountRow } from '@/components/sync/account'
import { Button, Choice, Row, Rows, SheetShell } from '@/components/ui'
import { resetProgress, setDailyGoal, useStore } from '@/lib/store'
import { setThemeMode, useThemeMode, type ThemeMode } from '@/lib/theme-mode'
import { importProgress, shareProgress } from '@/lib/transfer'
import { space, useThemeName } from '@/theme/tokens'
import { useType } from '@/theme/type'

const GOALS = [50, 100, 200]

const message = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

export function SettingsSheet({
  open,
  onClose,
  onToast,
}: {
  open: boolean
  onClose: () => void
  onToast: (message: string) => void
}) {
  const type = useType()
  const resolved = useThemeName()
  const mode = useThemeMode()
  const goal = useStore((s) => s.dailyGoal)
  const [busy, setBusy] = useState(false)

  /** iOS presents one modal at a time, so the sheet has to be gone before the system UI. */
  const run = async (fn: () => Promise<string | null>) => {
    if (busy) return
    setBusy(true)
    onClose()
    await new Promise((r) => setTimeout(r, 320))
    try {
      const said = await fn()
      if (said) onToast(said)
    } catch (e) {
      onToast(message(e))
    } finally {
      setBusy(false)
    }
  }

  const doExport = () => run(shareProgress)

  const doImport = () =>
    run(async () => {
      const result = await importProgress()
      return result && `${result.attempts} attempts · ${result.cards} cards`
    })

  const confirmReset = () =>
    Alert.alert('Erase all progress?', 'Attempts, cards, lectures read and mocks. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase',
        style: 'destructive',
        onPress: () => {
          resetProgress()
          onClose()
          onToast('Progress erased')
        },
      },
    ])

  return (
    <SheetShell open={open} title="Settings" onClose={onClose}>
      <ScrollView contentContainerStyle={{ padding: space[5], gap: space[4] }}>
        <Rows>
          <AccountRow onToast={onToast} />
          <Row label="Theme">
            <Choice
              value={mode}
              options={[
                { value: 'system' as ThemeMode, label: 'System' },
                { value: 'light' as ThemeMode, label: 'Light' },
                { value: 'dark' as ThemeMode, label: 'Dark' },
              ]}
              onChange={(v) => v && setThemeMode(v, resolved)}
            />
          </Row>
          <Row label="Daily goal">
            <Choice
              value={String(goal)}
              options={GOALS.map((g) => ({ value: String(g), label: `${g} xp` }))}
              onChange={(v) => v && setDailyGoal(Number(v))}
            />
            <Text style={[type.muted, { fontSize: 12 }]}>
              Roughly {Math.round(goal / 10)} questions, or a lecture and a few cards.
            </Text>
          </Row>
          <Row label="Progress">
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              <Button label="Export" variant="outline" size="sm" onPress={doExport} disabled={busy} />
              <Button label="Import" variant="outline" size="sm" onPress={doImport} disabled={busy} />
            </View>
            <Text style={[type.muted, { fontSize: 12 }]}>
              Import merges: nothing you have here is lost, and the same answer never counts twice.
            </Text>
          </Row>
        </Rows>

        <Button label="Reset progress" variant="outline" size="sm" tone="bad" onPress={confirmReset} />
      </ScrollView>
    </SheetShell>
  )
}
