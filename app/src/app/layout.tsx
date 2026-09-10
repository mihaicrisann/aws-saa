import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import Providers from './providers'
import '../index.css'

export const metadata: Metadata = {
  title: { default: 'AWS SAA · Study', template: '%s · AWS SAA' },
  description: 'Your AWS architecture study workspace. Learn, practice, and explore real architectures.',
  icons: { icon: '/favicon.svg' },
  robots: { index: false, follow: false },
}
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#171717' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>
}
