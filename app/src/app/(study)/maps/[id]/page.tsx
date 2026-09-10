import { ArchitectureMap } from '@/screens/Maps'
import maps from '@content/architecture-maps.json'
import { notFound } from 'next/navigation'
export function generateStaticParams() { return maps.map(m => ({ id: m.id })) }
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!maps.some(m => m.id === id)) notFound(); return <ArchitectureMap id={id} /> }
