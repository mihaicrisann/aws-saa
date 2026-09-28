'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useNavigate, useLocation } from '@/lib/navigation'
import { Moon, Sun, Keyboard, PanelLeft, SearchIcon, LayoutGrid, BookOpen, Layers, Target, Timer, CircleX, ListChecks, TrendingUp, Network, Boxes } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Dialog, DialogPopup, DialogHeader, DialogPanel, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { useStore, setTheme } from '@/lib/store'
import { useHotkeys } from '@/lib/hotkeys'
import Search from '@/components/Search'
import { SyncStatus, AccountMenu } from '@/components/AuthGate'
import { LevelCard, useGameToasts } from '@/components/Game'
import { Toasts } from '@/components/Toast'
import { cn } from '@/lib/utils'

export const NAV = [
  { to: '/', label: 'Overview', key: 'o', Icon: LayoutGrid },
  { to: '/learn', label: 'Learn', key: 'l', Icon: BookOpen },
  { to: '/cards', label: 'Cards', key: 'c', Icon: Layers },
  { to: '/drill', label: 'Drill', key: 'd', Icon: Target },
  { to: '/exam', label: 'Exam', key: 'e', Icon: Timer },
  { to: '/mistakes', label: 'Mistakes', key: 'm', Icon: CircleX },
  { to: '/cheatsheet', label: 'Cheat sheet', key: 'k', Icon: ListChecks },
  { to: '/services', label: 'Services', key: 'v', Icon: Boxes },
  { to: '/maps', label: 'Maps', key: 'a', Icon: Network },
  { to: '/progress', label: 'Progress', key: 'p', Icon: TrendingUp },
]

const SIDEBAR_KEY = 'saa.sidebar'
const readCollapsed = () => {
  try { return localStorage.getItem(SIDEBAR_KEY) === 'collapsed' } catch { return false }
}

const PAGE_KEYS: [string, ReactNode][] = [
  ['Drill', <><Kbd>1</Kbd>–<Kbd>5</Kbd> pick · <Kbd>s</Kbd> <Kbd>u</Kbd> <Kbd>g</Kbd> how sure · <Kbd>↵</Kbd> check, next</>],
  ['Cards', <><Kbd>Space</Kbd> flip · <Kbd>1</Kbd> again <Kbd>2</Kbd> hard <Kbd>3</Kbd> good <Kbd>4</Kbd> easy</>],
  ['Exam', <><Kbd>1</Kbd>–<Kbd>5</Kbd> pick · <Kbd>←</Kbd> <Kbd>→</Kbd> move · <Kbd>f</Kbd> flag</>],
  ['Learn', <><Kbd>n</Kbd> mark read, open next · <Kbd>←</Kbd> <Kbd>→</Kbd> previous, next</>],
  ['Mistakes', <><Kbd>j</Kbd> <Kbd>k</Kbd> move · <Kbd>1</Kbd>–<Kbd>5</Kbd> retry · <Kbd>↵</Kbd> check, next · <Kbd>u</Kbd> understood</>],
]

const NAV_ROW = 28
const NAV_GAP = 2

export default function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const activeIndex = NAV.findIndex((item) => item.to === pathname || (item.to !== '/' && pathname.startsWith(`${item.to}/`)))
  const active = NAV[activeIndex]
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
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')
  useGameToasts()

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
    if (e.key === 't') return toggleTheme()
    const item = NAV.find((n) => n.key === e.key)
    if (item) nav(item.to)
  }, [theme, collapsed])

  const utilities = (
    <>
      <Tooltip>
        <TooltipTrigger aria-label="Keyboard shortcuts" onClick={() => setHelp(true)} render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}>
          <Keyboard />
        </TooltipTrigger>
        <TooltipContent>Shortcuts <Kbd>?</Kbd></TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger aria-label="Toggle theme" onClick={toggleTheme} render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}>
          {theme === 'dark' ? <Sun /> : <Moon />}
        </TooltipTrigger>
        <TooltipContent>Theme <Kbd>t</Kbd></TooltipContent>
      </Tooltip>
    </>
  )

  return (
    <div className="flex min-h-svh bg-canvas">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-background focus:p-3">Skip to content</a>

      {!collapsed && (
        <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col px-3 pt-4 pb-3 md:flex">
          <NavLink to="/" className="group flex items-center gap-2.5 rounded-md px-2 py-1">
            <span aria-hidden className="grid size-5 place-items-center rounded-[5px] bg-foreground text-[10px] font-semibold text-background transition-transform duration-300 ease-(--ease-spring) group-hover:-rotate-12">S</span>
            <span className="text-[13px] font-semibold tracking-tight">AWS SAA</span>
            <span className="eyebrow ml-auto text-faint-foreground">C03</span>
          </NavLink>

          <button
            type="button"
            onClick={() => setSearch(true)}
            className="pressable mt-4 flex h-8 items-center gap-2 rounded-md border border-sidebar-border bg-background/60 px-2.5 text-[13px] text-muted-foreground hover:bg-background hover:text-foreground dark:bg-background/40"
          >
            <SearchIcon className="size-3.5" />
            <span className="flex-1 text-left">Search</span>
            <Kbd>/</Kbd>
          </button>

          <LevelCard />

          <nav className="relative mt-4 flex flex-col gap-0.5" aria-label="Sections">
            {activeIndex >= 0 && (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 rounded-md bg-sidebar-accent transition-transform duration-200 ease-(--ease-out)"
                style={{ height: NAV_ROW, transform: `translateY(${activeIndex * (NAV_ROW + NAV_GAP)}px)` }}
              />
            )}
            {NAV.map((n, i) => (
              <Tooltip key={n.to}>
                <TooltipTrigger
                  render={<NavLink to={n.to} end={n.to === '/'} />}
                  className={cn(
                    'group relative flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors duration-100',
                    i === activeIndex ? 'font-medium text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                  )}
                >
                  <n.Icon className="size-[15px] shrink-0 opacity-80 transition-transform duration-200 ease-(--ease-spring) group-hover:scale-110" strokeWidth={1.75} />
                  <span className="flex-1">{n.label}</span>
                </TooltipTrigger>
                <TooltipContent side="right">{n.label} <Kbd>{n.key.toUpperCase()}</Kbd></TooltipContent>
              </Tooltip>
            ))}
          </nav>

          <div className="mt-auto flex items-center gap-0.5 px-1">
            {utilities}
            <div className="ml-auto flex items-center gap-2"><SyncStatus /><AccountMenu /></div>
          </div>
        </aside>
      )}

      <header className="fixed inset-x-0 top-0 z-40 flex items-center gap-0.5 overflow-x-auto border-b bg-canvas/90 px-2 py-1.5 backdrop-blur-md md:hidden">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => cn('pressable shrink-0 rounded-md px-2.5 py-1.5 text-[13px]', isActive ? 'bg-sidebar-accent font-medium' : 'text-muted-foreground')}
          >
            {n.label}
          </NavLink>
        ))}
      </header>
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between border-t bg-canvas/90 px-4 py-2 backdrop-blur-md md:hidden">
        <SyncStatus />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setSearch(true)}><SearchIcon /></Button>
          {utilities}
          <AccountMenu />
        </div>
      </div>

      <main
        id="main-content"
        className={cn('relative min-w-0 flex-1 bg-background pt-12 pb-16 md:my-2 md:mr-2 md:min-h-[calc(100svh-1rem)] md:rounded-xl md:border md:pt-0 md:pb-0 md:shadow-[0_1px_2px_--theme(--color-black/4%)] dark:md:shadow-none', collapsed && 'md:ml-2')}
      >
        <div className="hidden h-11 items-center gap-1 border-b px-3 md:flex">
          <Tooltip>
            <TooltipTrigger
              aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-pressed={!collapsed}
              onClick={toggleSidebar}
              render={<Button variant="ghost" size="icon-sm" className="text-muted-foreground" />}
            >
              <PanelLeft />
            </TooltipTrigger>
            <TooltipContent side="right">{collapsed ? 'Show' : 'Hide'} sidebar <Kbd>[</Kbd></TooltipContent>
          </Tooltip>
          <span className="eyebrow ml-2 text-foreground">{active?.label ?? 'Study'}</span>
          {collapsed && (
            <div className="ml-auto flex items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label="Search" onClick={() => setSearch(true)}><SearchIcon /></Button>
              {utilities}
              <div className="ml-2 flex items-center gap-2"><SyncStatus /><AccountMenu /></div>
            </div>
          )}
        </div>
        <div className="px-5 py-6 md:px-10 md:py-9">
          <div key={pathname} className="page-enter min-w-0">{children}</div>
        </div>
      </main>

      <Search open={search} onOpenChange={setSearch} />
      <Toasts />

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogPopup className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Anywhere except inside a text field.</DialogDescription>
          </DialogHeader>
          <DialogPanel className="grid gap-5 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {NAV.map((n) => (
                <div key={n.to} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-muted-foreground">{n.label}</span>
                  <Kbd>{n.key.toUpperCase()}</Kbd>
                </div>
              ))}
              {[['Search', '/'], ['Theme', 'T'], ['Sidebar', '['], ['This dialog', '?']].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="text-muted-foreground">{label}</span>
                  <Kbd>{key}</Kbd>
                </div>
              ))}
            </div>
            <div className="grid gap-2 border-t pt-4">
              {PAGE_KEYS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[56px_1fr] items-baseline gap-3 text-[13px]">
                  <span className="eyebrow">{k}</span>
                  <span className="text-muted-foreground">{v}</span>
                </div>
              ))}
            </div>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </div>
  )
}
