'use client'

import Exam from '@/screens/Exam'
import { SyncStatus } from '@/components/AuthGate'

export default function ExamPage() {
  return <><div className="fixed bottom-4 right-5 z-40 rounded-full border bg-background/95 px-3 py-1.5 shadow-sm"><SyncStatus /></div><Exam /></>
}
