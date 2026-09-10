'use client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createAuthClient } from 'better-auth/react'
import {
  restoreFromDisk,
  useMirror,
  useSyncMessage,
  flushProgress,
  resolveConflict,
  clearSession,
  exportStore,
} from '@/lib/store'
import { MIN_PASSWORD_LENGTH } from '@/lib/password'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/menu'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from '@/components/ui/dialog'
const client = createAuthClient()
function download(name: string, contents: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
export function SyncStatus() {
  const status = useMirror(),
    detail = useSyncMessage()
  return (
    <div aria-live="polite" className="text-xs text-muted-foreground">
      {status === 'synced'
        ? 'Saved'
        : status === 'saving'
          ? 'Saving…'
          : status === 'error'
            ? 'Not saved'
            : status === 'conflict'
              ? 'Save conflict'
              : ''}
      {(status === 'error' || status === 'conflict') && (
        <div
          role="alert"
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-xl border bg-background p-4 shadow-lg"
        >
          <p className="mb-3 text-sm">{detail}</p>
          <div className="flex flex-wrap gap-3">
            <button
              className="underline"
              onClick={() => download('saa-recovery.json', exportStore())}
            >
              Export this device
            </button>
            {status === 'error' ? (
              <button
                className="underline"
                onClick={() => void flushProgress()}
              >
                Retry save
              </button>
            ) : (
              <>
                <button
                  className="underline"
                  onClick={() => resolveConflict(true)}
                >
                  Keep this device’s changes
                </button>
                <button
                  className="underline"
                  onClick={() => resolveConflict(false)}
                >
                  Load saved progress
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (value: boolean) => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get('current')),
      newPassword = String(form.get('next'))
    setError('')
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (newPassword !== String(form.get('confirm')))
      return setError('The new passwords do not match.')
    if (newPassword === currentPassword)
      return setError('Choose a password you have not used here before.')
    setBusy(true)
    try {
      const result = await client.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      if (result.error)
        setError(
          result.error.code === 'INVALID_PASSWORD'
            ? 'That current password is not correct.'
            : (result.error.message ?? 'The password could not be changed.'),
        )
      else setDone(true)
    } catch {
      setError('Unable to connect. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) {
          setError('')
          setDone(false)
        }
      }}
    >
      <DialogPopup className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Your current password is required. Every other signed-in device is
            signed out.
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {done ? (
            <p className="text-sm text-good">
              Password updated. Other devices have been signed out.
            </p>
          ) : (
            <form id="change-password" onSubmit={submit} className="grid gap-4">
              <input
                type="text"
                name="username"
                autoComplete="username"
                className="hidden"
                aria-hidden
                tabIndex={-1}
              />
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  name="next"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>
              {error && (
                <p role="alert" className="text-sm text-bad">
                  {error}
                </p>
              )}
            </form>
          )}
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {done ? 'Close' : 'Cancel'}
          </DialogClose>
          {!done && (
            <Button type="submit" form="change-password" loading={busy}>
              Update password
            </Button>
          )}
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  )
}
export function AccountMenu() {
  const status = useMirror()
  const [password, setPassword] = useState(false)
  return (
    <>
      <Menu>
        <MenuTrigger
          render={<Button variant="ghost" size="xs" />}
          className="text-muted-foreground"
        >
          Account
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem onClick={() => setPassword(true)}>
            Change password
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={status !== 'synced'}
            onClick={async () => {
              await client.signOut()
              // Never lose queued work silently if a save never landed.
              const { recovery } = clearSession()
              if (recovery) download('saa-unsaved-progress.json', recovery)
              window.location.reload()
            }}
          >
            Sign out
          </MenuItem>
        </MenuPopup>
      </Menu>
      <PasswordDialog open={password} onOpenChange={setPassword} />
    </>
  )
}
export default function AuthGate({ children }: { children: ReactNode }) {
  const { data: session, isPending } = client.useSession()
  const accountId = session?.user.id
  const [loaded, setLoaded] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!accountId) {
      setLoaded(null)
      return
    }
    let cancelled = false
    setError('')
    restoreFromDisk(accountId)
      .then(() => {
        if (!cancelled) setLoaded(accountId)
      })
      .catch((e) => {
        if (!cancelled && e?.name !== 'SessionChanged') setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [accountId, retry])
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const data = new FormData(event.currentTarget)
    try {
      const result = await client.signIn.email({
        email: String(data.get('email')),
        password: String(data.get('password')),
      })
      if (result.error) setError(result.error.message ?? 'Sign in failed.')
    } catch {
      setError('Unable to connect. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  if (session && loaded === session.user.id) return children
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            AWS SAA
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Your study space</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to pick up where you left off.
          </p>
        </div>
        {isPending || session ? (
          <div>
            <p className="text-sm">
              {error
                ? 'Progress could not be loaded.'
                : 'Loading your saved progress…'}
            </p>
            {error && (
              <>
                <p role="alert" className="mt-3 text-sm text-bad">
                  {error}
                </p>
                <button
                  className="mt-4 underline"
                  onClick={() => setRetry((n) => n + 1)}
                >
                  Retry
                </button>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={login} className="grid gap-4">
            <label className="grid gap-1 text-sm">
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                className="rounded-lg border bg-background px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="rounded-lg border bg-background px-3 py-2"
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-bad">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="rounded-lg bg-foreground px-4 py-2 text-background disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-xs text-muted-foreground">
              Private study app. Accounts are managed by the owner.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
