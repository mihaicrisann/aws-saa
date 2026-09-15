import { useRef, useState } from 'react'
import { Alert, Text, TextInput, View } from 'react-native'
import { Button, Field, Row } from '@/components/ui'
import { SERVER } from '@/lib/sync/api'
import { signIn, signOut, sync, useSyncStatus } from '@/lib/sync/engine'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { SyncDot } from './status'

const host = SERVER.replace(/^https?:\/\//, '')
const message = (e: unknown) => (e instanceof Error ? e.message : 'Sign in failed.')

/** The Account row in Settings: sign in, or the account with its sync state. */
export function AccountRow({ onToast }: { onToast: (message: string) => void }) {
  const type = useType()
  const t = useTheme()
  const status = useSyncStatus()
  const password = useRef<TextInput>(null)
  const [email, setEmail] = useState(status.email)
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy || !email.trim() || !secret) return
    setBusy(true)
    setError('')
    try {
      await signIn(email, secret)
      setSecret('')
      onToast('Signed in')
    } catch (e) {
      setError(message(e))
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { unsaved } = await signOut()
      if (!unsaved) return onToast('Signed out')
      Alert.alert(
        `${unsaved} change${unsaved === 1 ? '' : 's'} not saved`,
        'Signing out now leaves them on this phone only. They will be saved next time you sign in on this device.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out anyway',
            style: 'destructive',
            onPress: () => void signOut({ force: true }).then(() => onToast('Signed out')),
          },
        ],
      )
    } catch (e) {
      onToast(message(e))
    } finally {
      setBusy(false)
    }
  }

  if (!status.email || status.needsSignIn)
    return (
      <Row label="Account" first>
        {status.needsSignIn ? (
          <Text style={[type.muted, { fontSize: 12, color: t.bad }]}>{status.detail}</Text>
        ) : (
          <Text style={[type.muted, { fontSize: 12 }]}>
            Sign in to keep this phone and {host} in step. Everything already here is merged in, never replaced.
          </Text>
        )}
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => password.current?.focus()}
        />
        <Field
          ref={password}
          value={secret}
          onChangeText={setSecret}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
        />
        {error ? <Text style={[type.muted, { fontSize: 12, color: t.bad }]}>{error}</Text> : null}
        <Button label={busy ? 'Signing in…' : 'Sign in'} size="sm" onPress={() => void submit()} disabled={busy} />
      </Row>
    )

  return (
    <Row label="Account" first>
      <Text style={type.body}>{status.email}</Text>
      <SyncDot />
      <View style={{ flexDirection: 'row', gap: space[2] }}>
        <Button label="Sync now" variant="outline" size="sm" onPress={() => void sync()} disabled={busy} />
        <Button label="Sign out" variant="outline" size="sm" tone="bad" onPress={() => void leave()} disabled={busy} />
      </View>
    </Row>
  )
}
