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
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
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
const SYNC_LABEL = { synced: 'Saved', saving: 'Saving', error: 'Not saved', conflict: 'Conflict' } as const
export function SyncStatus() {
  const status = useMirror(),
    detail = useSyncMessage()
  const label = SYNC_LABEL[status as keyof typeof SYNC_LABEL] ?? ''
  const bad = status === 'error' || status === 'conflict'
  return (
    <div aria-live="polite" className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full transition-colors duration-300',
          status === 'synced' && 'bg-good',
          status === 'saving' && 'animate-pulse bg-muted-foreground',
          bad && 'bg-bad',
          !label && 'bg-border-strong',
        )}
      />
      <span className="mono">{label}</span>
      {bad && (
        <div
          role="alert"
          className="rise fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-xl border bg-popover p-4 text-sm text-foreground shadow-lg/10"
        >
          <p className="mb-3">{detail}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => download('saa-recovery.json', exportStore())}>Export this device</Button>
            {status === 'error' ? (
              <Button size="sm" onClick={() => void flushProgress()}>Retry save</Button>
            ) : (
              <>
                <Button size="sm" onClick={() => resolveConflict(true)}>Keep this device's changes</Button>
                <Button size="sm" variant="outline" onClick={() => resolveConflict(false)}>Load saved progress</Button>
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
  const { data: session } = client.useSession()
  const [password, setPassword] = useState(false)
  const name = session?.user.name || session?.user.email || ''
  const initial = name.trim().charAt(0).toUpperCase() || '·'
  return (
    <>
      <Menu>
        <MenuTrigger
          aria-label="Account"
          className="pressable grid size-6 place-items-center rounded-full border border-border-strong bg-background text-[11px] font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initial}
        </MenuTrigger>
        <MenuPopup align="end" className="min-w-48">
          {name && <div className="truncate px-2 py-1.5 text-xs text-muted-foreground">{name}</div>}
          {name && <MenuSeparator />}
          <MenuItem onClick={() => setPassword(true)}>Change password</MenuItem>
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
    <main className="grid min-h-svh place-items-center bg-canvas px-6">
      <div className="w-full max-w-[22rem]">
        <div className="mb-10">
          <div className="eyebrow flex items-center gap-2">
            <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-foreground text-[10px] font-semibold text-background">S</span>
            AWS SAA · C03
          </div>
          <h1 className="display-lg mt-6">Study<br />workspace.</h1>
          <p className="mt-4 text-sm text-muted-foreground">Sign in to pick up where you left off.</p>
        </div>
        {isPending || session ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            {error ? (
              <div>
                <p className="text-foreground">Progress could not be loaded.</p>
                <p role="alert" className="mt-2 text-bad">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setRetry((n) => n + 1)}>Retry</Button>
              </div>
            ) : (
              <><Spinner className="size-3.5" /> Loading your saved progress</>
            )}
          </div>
        ) : (
          <form onSubmit={login} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" name="email" type="email" autoComplete="username" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input id="login-password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {error && (
              <p role="alert" className="text-sm text-bad">{error}</p>
            )}
            <Button type="submit" loading={busy} className="mt-1">Sign in</Button>
            <p className="mt-2 text-xs text-muted-foreground">Private. Accounts are managed by the owner.</p>
          </form>
        )}
      </div>
    </main>
  )
}
