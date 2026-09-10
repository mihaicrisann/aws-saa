'use client'

import NextLink from 'next/link'
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation'
import { startTransition, useCallback, useSyncExternalStore, type ComponentProps } from 'react'

type LinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & { to: string }

/** Existing study controls use `to`; every link still uses Next's prefetching router. */
export function Link({ to, ...props }: LinkProps) {
  return <NextLink href={to} transitionTypes={['page-navigation']} {...props} />
}

export function NavLink({ to, end = false, className, ...props }: Omit<LinkProps, 'className'> & {
  end?: boolean
  className?: string | ((state: { isActive: boolean }) => string)
}) {
  const pathname = usePathname() ?? '/'
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  return <Link to={to} aria-current={isActive ? 'page' : undefined} className={typeof className === 'function' ? className({ isActive }) : className} {...props} />
}

export function useNavigate() {
  const router = useRouter()
  return useCallback((to: string, options?: { replace?: boolean }) => {
    startTransition(() => options?.replace ? router.replace(to) : router.push(to))
  }, [router])
}

export function useSearchParams(): [URLSearchParams, (params: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => void] {
  const params = useNextSearchParams()
  const pathname = usePathname() ?? '/'
  const router = useRouter()
  const setParams = useCallback((next: URLSearchParams | Record<string, string>, options?: { replace?: boolean }) => {
    const query = new URLSearchParams(next).toString()
    const href = `${pathname}${query ? `?${query}` : ''}`
    startTransition(() => options?.replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false }))
  }, [pathname, router])
  return [new URLSearchParams(params?.toString() ?? ''), setParams]
}

export function useParams() {
  return useNextParams<Record<string, string>>() ?? {}
}

const subscribeHash = (listener: () => void) => {
  window.addEventListener('hashchange', listener)
  window.addEventListener('popstate', listener)
  return () => { window.removeEventListener('hashchange', listener); window.removeEventListener('popstate', listener) }
}
export function useLocation() {
  const pathname = usePathname() ?? '/'
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash, () => '')
  return { pathname, hash }
}
