import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Moon, Sun, Keyboard, PanelLeft, SearchIcon, LayoutGrid, BookOpen, Layers, Target, Timer, CircleX, ListChecks, TrendingUp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Dialog, DialogPopup, DialogHeader, DialogPanel, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useStore, setTheme } from '@/lib/store'
import { useHotkeys } from '@/lib/hotkeys'
import Search from '@/components/Search'
import { cn } from '@/lib/utils'

export const NAV = [
  { to: '/', label: 'Overview', key: 'o', Icon: LayoutGrid },
  { to: '/learn', label: 'Learn', key: 'l', Icon: BookOpen },
  { to: '/cards', label: 'Cards', key: 'c', Icon: Layers },
  { to: '/drill', label: 'Drill', key: 'd', Icon: Target },
  { to: '/exam', label: 'Exam', key: 'e', Icon: Timer },
  { to: '/mistakes', label: 'Mistakes', key: 'm', Icon: CircleX },
  { to: '/cheatsheet', label: 'Cheat sheet', key: 'k', Icon: ListChecks },
  { to: '/progress', label: 'Progress', key: 'p', Icon: TrendingUp },
]

const SIDEBAR_KEY = 'saa.sidebar'
const readCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed' } catch { return false }
}

const PAGE_KEYS = [
  ['Drill', '1–5 pick · S / U / G how sure · Enter check / next'],
  ['Cards', 'Space flip · 1 again · 2 hard · 3 good · 4 easy'],
  ['Exam', '1–5 pick · ← → move · F flag'],
  ['Learn', 'N mark read and open the next lecture · ← → previous / next'],
]

export default function Shell() {
  const theme = useStore((s) => s.theme)
  const nav = useNavigate()
  const [help, setHelp] = useState(false)
  const [search, setSearch] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'open') } catch { /* ignore */ }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearch((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useHotkeys((e) => {
    if (e.key === '?') return setHelp((v) => !v)
    if (e.key === '/') { e.preventDefault(); return setSearch(true) }
    if (e.key === '[') return toggleSidebar()
    if (e.key === 't') return setTheme(theme === 'dark' ? 'light' : 'dark')
    const item = NAV.find((n) => n.key === e.key)
    if (item) nav(item.to)
  }, [theme, collapsed])

  return (
    <div className="flex min-h-svh">
      {!collapsed && (
        <aside className="sticky top-0 hidden h-svh w-52 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
          <div className="px-3 text-sm font-semibold tracking-tight">AWS SAA</div>
          <button
            type="button"
            onClick={() => setSearch(true)}
            className="mt-4 flex h-8 items-center gap-2 rounded-xl border px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <SearchIcon className="size-4" /> <span className="flex-1 text-left">Search</span> <Kbd>/</Kbd>
          </button>
          <nav className="mt-3 flex flex-col gap-0.5">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'group flex h-8 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors',
                    isActive ? 'bg-sidebar-accent font-medium text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground',
                  )
                }
              >
                <n.Icon className="size-4 shrink-0" />
                <span className="flex-1">{n.label}</span>
                <Kbd className="opacity-0 transition-opacity group-hover:opacity-100">{n.key}</Kbd>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-1 px-1">
            <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}>
              <Keyboard />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun /> : <Moon />}
            </Button>
          </div>
        </aside>
      )}

      <header className="fixed inset-x-0 top-0 z-40 flex items-center gap-1 overflow-x-auto border-b bg-background/95 px-2 py-2 backdrop-blur md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) =>
              cn(
                'shrink-0 rounded-xl px-2.5 py-1.5 text-sm',
                isActive ? 'bg-muted font-medium' : 'text-muted-foreground',
              )
            }
          >
            {n.label}
          </NavLink>
        ))}
      </header>

      <main className="min-w-0 flex-1 px-5 pt-16 pb-20 md:px-10 md:pt-4">
        <div className="mb-4 hidden md:flex md:items-center md:gap-1 md:-ml-2">
          <Tooltip>
            <TooltipTrigger
              aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-pressed={!collapsed}
              onClick={toggleSidebar}
              render={<Button variant="ghost" size="icon-sm" />}
            >
              <PanelLeft />
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Show' : 'Hide'} sidebar <Kbd>[</Kbd></TooltipContent>
          </Tooltip>
          {collapsed && (
            <>
              <Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setSearch(true)}><SearchIcon /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Keyboard shortcuts" onClick={() => setHelp(true)}><Keyboard /></Button>
              <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun /> : <Moon />}
              </Button>
            </>
          )}
        </div>
        <Outlet />
      </main>

      <Search open={search} onOpenChange={setSearch} />

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Work anywhere except inside a text field.</DialogDescription>
          </DialogHeader>
          <DialogPanel className="grid gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              {NAV.map((n) => (
                <span key={n.to} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs">
                  <Kbd>{n.key}</Kbd> {n.label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"><Kbd>t</Kbd> theme</span>
              <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"><Kbd>[</Kbd> sidebar</span>
              <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"><Kbd>/</Kbd> search</span>
              <span className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs"><Kbd>?</Kbd> this</span>
            </div>
            <dl className="mt-2 grid grid-cols-[72px_1fr] gap-x-3 gap-y-1.5">
              {PAGE_KEYS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="font-medium">{k}</dt>
                  <dd className="text-muted-foreground">{v}</dd>
                </div>
              ))}
            </dl>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
