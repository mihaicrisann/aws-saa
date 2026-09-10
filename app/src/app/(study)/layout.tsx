import type { ReactNode } from 'react'
import Shell from '@/components/Shell'

export default function StudyLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>
}
