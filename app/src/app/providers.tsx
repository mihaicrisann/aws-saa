'use client'

import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import AuthGate from '@/components/AuthGate'

export default function Providers({ children }: { children: ReactNode }) {
  return <TooltipProvider><AuthGate>{children}</AuthGate></TooltipProvider>
}
