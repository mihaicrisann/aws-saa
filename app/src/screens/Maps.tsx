'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Background, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useNodesState, useReactFlow, type Node, type NodeChange, type NodeProps } from '@xyflow/react'
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, ExternalLink, GitBranch, Layers, Network, RotateCcw, Search, ShieldAlert } from 'lucide-react'
import { Link } from '@/lib/navigation'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import Notes from '@/components/Notes'
import { PageHeader, Choice, QuietLink } from '@/components/parts'
import { cn } from '@/lib/utils'
import mapData from '@content/architecture-maps.json'
import '@xyflow/react/dist/style.css'
import './maps.css'

type Architecture = typeof mapData[number]
type ServiceData = Architecture['nodes'][number] & { step: number | null; warning: boolean }
type ServiceNode = Node<ServiceData, 'service'>

function ServiceCard({ data, selected }: NodeProps<ServiceNode>) {
  return <div className={cn('map-service', selected && 'map-service-selected', data.step !== null && 'map-service-highlighted', data.warning && 'map-service-warning')}>
    <Handle type="target" position={Position.Left} />
    <div className="map-service-zone">{data.warning ? <ShieldAlert size={13} /> : <Layers size={13} />}{data.zone}</div>
    <strong>{data.service}</strong><span>{data.role}</span>
    {(data.step !== null || data.warning) && <div className="map-service-flags">
      {data.step !== null && <span className="map-service-flag">Step {data.step}</span>}
      {data.warning && <span className="map-service-flag map-service-flag-bad">Bad example</span>}
    </div>}
    <Handle type="source" position={Position.Right} />
  </div>
}
const nodeTypes = { service: ServiceCard }
// The stock description offers deletion, which this canvas does not allow.
const keyboardHelp = 'Press Enter or Space to read why this service is here. Press Escape to clear the selection. Arrow keys move a selected service.'
const ariaLabelConfig = { 'node.a11yDescription.default': keyboardHelp, 'node.a11yDescription.keyboardDisabled': keyboardHelp }

const toFlowNodes = (map: Architecture): ServiceNode[] =>
  map.nodes.map(n => ({ id: n.id, type: 'service', position: { x: n.x, y: n.y }, data: { ...n, step: null, warning: false }, ariaLabel: `${n.service}. ${n.role}. ${n.zone}.` }))

function Preview({ map }: { map: Architecture }) {
  const byId = new Map(map.nodes.map(n => [n.id, n]))
  const maxX = Math.max(...map.nodes.map(n => n.x)) + 220
  const maxY = Math.max(...map.nodes.map(n => n.y)) + 110
  return <svg viewBox={`-30 -40 ${maxX + 60} ${maxY + 80}`} className="h-36 w-full" aria-hidden>
    {map.edges.map((e, i) => { const a = byId.get(e.source), b = byId.get(e.target); return a && b ? <path key={i} d={`M${a.x + 110},${a.y + 45} L${b.x + 110},${b.y + 45}`} fill="none" stroke="currentColor" strokeWidth="4" opacity=".22" /> : null })}
    {map.nodes.map((n, i) => <g key={n.id}><rect x={n.x} y={n.y} width="220" height="90" rx="14" fill="var(--card)" stroke="currentColor" strokeWidth="2.5" opacity=".6" /><rect x={n.x + 16} y={n.y + 20} width="10" height="50" rx="5" fill={i % 3 === 0 ? 'var(--domain-secure)' : 'currentColor'} opacity=".55" /><text x={n.x + 40} y={n.y + 53} fill="currentColor" fontSize="22" fontFamily="var(--font-mono)">{n.service.length > 17 ? `${n.service.slice(0, 16)}…` : n.service}</text></g>)}
  </svg>
}

export default function Maps() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const filtered = mapData.filter(m => (category === 'All' || m.category === category) && `${m.title} ${m.subtitle} ${m.nodes.map(n => n.service).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const categories = ['All', ...new Set(mapData.map(m => m.category))]
  return <div className="mx-auto max-w-6xl">
    <PageHeader
      title="Architecture maps"
      description="Six application blueprints. Follow the request, then see what breaks."
      actions={<label className="flex h-8 items-center gap-2 rounded-lg border bg-card px-2.5 transition-[border-color,box-shadow] duration-100 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20"><Search className="size-3.5 shrink-0 text-muted-foreground" /><input aria-label="Search architecture maps" placeholder="Find an app or service…" value={query} onChange={e => setQuery(e.target.value)} className="w-full min-w-0 bg-transparent text-[13px] outline-none placeholder:text-faint-foreground sm:w-52" /></label>}
    />
    <div className="mb-6" role="group" aria-label="Map categories">
      <Choice value={category} onChange={v => v && setCategory(v)} options={categories.map(c => ({ value: c, label: c }))} />
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((m, i) => <Link key={m.id} to={`/maps/${m.id}`} className="group pressable overflow-hidden rounded-xl border bg-card hover:border-border-strong">
      <div className="map-preview border-b px-5 py-4 text-muted-foreground transition-colors duration-200 group-hover:text-foreground"><Preview map={m} /></div>
      <div className="p-5">
        <div className="eyebrow mb-3 flex justify-between"><span>{String(i + 1).padStart(2, '0')} · {m.category}</span><span className="text-faint-foreground">{m.nodes.length} services</span></div>
        <h2 className="text-[15px] font-medium tracking-tight">{m.title}</h2>
        <p className="mt-1.5 min-h-15 text-[13px] leading-relaxed text-muted-foreground">{m.subtitle}</p>
        <span className="mt-4 flex items-center gap-1.5 text-xs font-medium">Explore <ArrowRight className="size-3.5 transition-transform duration-200 ease-(--ease-out) group-hover:translate-x-0.5" /></span>
      </div>
    </Link>)}</div>
    {filtered.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground">No maps match. Try a service such as S3, Lambda or RDS.</p>}
    <p className="mt-8 text-xs text-muted-foreground">Grounded in AWS documentation. Sources on each map.</p>
  </div>
}

const TABS = [{ id: 'guide', label: 'Explore' }, { id: 'notes', label: 'My notes' }] as const
type Tab = typeof TABS[number]['id']

function Canvas({ map }: { map: Architecture }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [step, setStep] = useState<number | null>(null)
  const [bad, setBad] = useState(false)
  const [tab, setTab] = useState<Tab>('guide')
  const theme = useStore(s => s.theme)
  const flow = useReactFlow()
  const uid = useId()
  const fitTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [nodes, setNodes, onNodesChange] = useNodesState<ServiceNode>(toFlowNodes(map))
  const stepOf = useMemo(() => new Map(step === null ? [] : map.steps[step].nodes.map(id => [id, step + 1])), [map, step])
  const warnings = useMemo(() => new Set(bad ? map.pitfalls.flatMap(p => p.nodes) : []), [map, bad])
  const displayNodes = useMemo(() => nodes.map(n => ({ ...n, selected: n.id === selected, data: { ...n.data, step: stepOf.get(n.id) ?? null, warning: warnings.has(n.id) } })), [nodes, selected, stepOf, warnings])
  const edges = useMemo(() => { const name = (id: string) => map.nodes.find(n => n.id === id)?.service ?? id; return map.edges.map((e, i) => { const lit = stepOf.has(e.source) && stepOf.has(e.target); return { id: `edge-${i}`, source: e.source, target: e.target, label: e.label, type: 'smoothstep', focusable: false, ariaLabel: `${name(e.source)} to ${name(e.target)}: ${e.label}`, markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: lit ? 3.5 : 1.5, stroke: lit ? 'var(--domain-secure)' : 'var(--muted-foreground)' }, labelStyle: { fontSize: 11, fontWeight: lit ? 600 : 400 }, labelBgStyle: { fill: 'var(--background)', fillOpacity: .96 } } }) }, [map, stepOf])
  const service = map.nodes.find(n => n.id === selected)

  // React Flow reports keyboard selection (Enter/Space/Escape on a focused node)
  // only as a `select` change, so selection is derived here rather than from clicks.
  const handleNodesChange = useCallback((changes: NodeChange<ServiceNode>[]) => {
    onNodesChange(changes)
    for (const change of changes) {
      if (change.type !== 'select') continue
      if (change.selected) { setSelected(change.id); setTab('guide') }
      else setSelected(current => current === change.id ? null : current)
    }
  }, [onNodesChange])

  const reset = useCallback(() => {
    setNodes(toFlowNodes(map)); setSelected(null); setStep(null)
    clearTimeout(fitTimer.current)
    fitTimer.current = setTimeout(() => void flow.fitView({ padding: .18 }), 50)
  }, [map, setNodes, flow])
  useEffect(() => () => clearTimeout(fitTimer.current), [])

  const panel = (id: Tab) => ({ role: 'tabpanel' as const, id: `${uid}-panel-${id}`, 'aria-labelledby': `${uid}-tab-${id}`, tabIndex: 0 })
  return <div>
    <QuietLink to="/maps" className="mb-6 inline-flex items-center gap-1"><ArrowLeft className="size-3" /> All maps</QuietLink>
    <PageHeader eyebrow={map.category} title={map.title} description={map.subtitle} className="mb-5"
      actions={<><Button variant={bad ? 'default' : 'outline'} size="sm" onClick={() => setBad(v => !v)} aria-pressed={bad}><ShieldAlert />{bad ? 'Hide bad examples' : 'Show bad examples'}</Button><Button variant="outline" size="sm" onClick={reset}><RotateCcw />Reset view</Button></>}
    />
    <div className="map-workspace grid overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative h-[56svh] min-h-96 lg:h-[72svh]" role="region" aria-label={`${map.title} architecture canvas`} aria-describedby={`${uid}-hint`}>
        <ReactFlow nodes={displayNodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={handleNodesChange} onPaneClick={() => setSelected(null)} nodesConnectable={false} edgesFocusable={false} edgesReconnectable={false} deleteKeyCode={null} preventScrolling={false} fitView fitViewOptions={{ padding: .18 }} minZoom={.2} maxZoom={1.8} colorMode={theme} ariaLabelConfig={ariaLabelConfig} attributionPosition="bottom-left">
          <Background gap={22} size={1} /><Controls showInteractive={false} /><MiniMap pannable zoomable nodeColor={() => theme === 'dark' ? '#737373' : '#a3a3a3'} />
        </ReactFlow>
        <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-1.5 rounded-md border bg-background/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md"><Network className="size-3.5" /><span className="mono">{map.nodes.length} services</span></div>
        <span id={`${uid}-hint`} className="pointer-events-none absolute bottom-3 right-3 hidden rounded-md border bg-background/90 px-2.5 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md sm:block">Drag to pan · click a service</span>
      </div>
      <div className="border-t bg-card lg:max-h-[72svh] lg:overflow-y-auto lg:border-t-0 lg:border-l">
        <div className="sticky top-0 z-10 flex gap-1 border-b bg-card p-1.5" role="tablist" aria-label="Map details" onKeyDown={e => {
          const next = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
          if (!next) return
          e.preventDefault()
          const to = TABS[(TABS.findIndex(t => t.id === tab) + next + TABS.length) % TABS.length]
          setTab(to.id); document.getElementById(`${uid}-tab-${to.id}`)?.focus()
        }}>{TABS.map(t => <button key={t.id} id={`${uid}-tab-${t.id}`} role="tab" aria-selected={tab === t.id} aria-controls={`${uid}-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => setTab(t.id)} className={cn('pressable flex-1 rounded-md px-3 py-1.5 text-[13px] transition-colors duration-100', tab === t.id ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground')}>{t.label}</button>)}</div>
        {tab === 'notes' ? <div className="p-5" {...panel('notes')}><h2 className="eyebrow mb-2">Your observations</h2><p id={`${uid}-notes-hint`} className="mb-4 text-xs leading-relaxed text-muted-foreground">Saved as you type.</p><Notes noteKey={`map:${map.id}`} label="Architecture notes" placeholder="Why a queue here? What changes if…" className="min-h-64" describedBy={`${uid}-notes-hint`} /></div> : <div className="space-y-6 p-5" {...panel('guide')}>
          <div aria-live="polite">{service ? <section className="rise rounded-lg border bg-muted/40 p-4"><div className="eyebrow mb-2">{service.zone}</div><h2 className="mb-2 text-sm font-medium tracking-tight">{service.service}</h2><p className="text-[13px] leading-relaxed">{service.why}</p><button onClick={() => setSelected(null)} className="pressable mt-3 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Clear selection</button></section> : <p className="text-xs leading-relaxed text-muted-foreground">Select a service to see why it is here.</p>}</div>
          <section><h2 className="eyebrow mb-3 flex items-center gap-2"><Compass className="size-3.5" />Follow the flow</h2><div className="space-y-1.5">{map.steps.map((s, i) => <button key={s.title} onClick={() => { setStep(step === i ? null : i); setSelected(null) }} aria-pressed={step === i} className={cn('pressable w-full rounded-lg border p-3 text-left', step === i ? 'border-border-strong bg-accent/60' : 'hover:border-border-strong hover:bg-accent/30')}><span className="flex items-center gap-2 text-xs font-medium"><span className="mono flex size-5 shrink-0 items-center justify-center rounded-full border bg-background text-[10px]">{step === i ? <Check size={11} strokeWidth={3} /> : i + 1}</span>{s.title}</span>{step === i && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{s.description}</p>}</button>)}</div></section>
          {bad && <section><h2 className="eyebrow mb-3 flex items-center gap-2 text-bad"><ShieldAlert className="size-3.5" />Where the design breaks</h2>{map.pitfalls.map(p => <div key={p.title} className="rise mb-2 rounded-lg border border-bad/30 bg-bad/5 p-3"><h3 className="mb-2 text-xs font-medium">{p.title}</h3><p className="text-xs leading-relaxed text-muted-foreground">{p.description}</p></div>)}</section>}
          <section><h2 className="eyebrow mb-3 flex items-center gap-2"><BookOpen className="size-3.5" />Read the source</h2>{map.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="mb-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground hover:text-foreground"><ExternalLink className="mt-0.5 size-3 shrink-0" aria-hidden />{s.title}<span className="sr-only"> (AWS documentation, opens in a new tab)</span></a>)}<p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Reviewed September 2026. IAM, observability and deployment are simplified.</p></section>
        </div>}
      </div>
    </div>
    <div className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><GitBranch className="mt-0.5 size-3.5 shrink-0" />Explain it aloud: where is state durable, what retries, what fails together?</div>
  </div>
}

export function ArchitectureMap({ id }: { id: string }) {
  const map = mapData.find(m => m.id === id)
  if (!map) return <div className="mx-auto max-w-2xl"><PageHeader title="Map not found" description="That architecture map does not exist. It may have been renamed." /><QuietLink to="/maps">Back to architecture maps</QuietLink></div>
  return <ReactFlowProvider key={id}><Canvas map={map} /></ReactFlowProvider>
}
