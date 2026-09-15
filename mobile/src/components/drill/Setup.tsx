import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { banks, domains, lectureById, lectureNo, lectures, shortDomain, type DomainId } from '@/lib/content'
import type { QuestionBank } from '@/lib/progress'
import { space, useTheme } from '@/theme/tokens'
import { useType } from '@/theme/type'
import { Button, Choice, Frame, Header, Row, Rows, SelectButton, Sheet, Toggle } from '@/components/ui'
import { COUNTS, drillPool, type DrillSettings } from './logic'

export function DrillSetup({
  settings,
  onChange,
  seen,
  onStart,
}: {
  settings: DrillSettings
  onChange: (s: DrillSettings) => void
  seen: Set<string>
  onStart: () => void
}) {
  const t = useTheme()
  const type = useType()
  const [picking, setPicking] = useState(false)

  const pool = useMemo(() => drillPool(settings, seen), [settings, seen])
  const inDomain = useMemo(
    () =>
      settings.domain === 'all'
        ? lectures
        : lectures.filter((l) => l.domains.includes(settings.domain as DomainId)),
    [settings.domain],
  )
  const set = (patch: Partial<DrillSettings>) => onChange({ ...settings, ...patch })
  const blurb = banks.find((b) => b.id === settings.bank)?.blurb ?? ''

  return (
    <Frame
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[type.mono, { fontSize: 12, color: t.mutedForeground }]}>
            {pool.length} match
          </Text>
          <Button label="Start" onPress={onStart} disabled={!pool.length} />
        </View>
      }
    >
      <Header title="Drill" description="Short sets, reasoning after every answer." />

      <Rows>
        <Row label="Bank" first>
          <Choice
            value={settings.bank}
            options={banks.map((b) => ({ value: b.id as QuestionBank, label: b.label }))}
            onChange={(v) => v && set({ bank: v })}
          />
          <Text style={[type.muted, { fontSize: 12 }]}>{blurb}</Text>
        </Row>
        <Row label="Domain">
          <Choice
            value={settings.domain}
            options={[
              { value: 'all' as const, label: 'All' },
              ...domains.map((d) => ({ value: d.id, label: shortDomain(d.id), dot: t.domain[d.id] })),
            ]}
            onChange={(v) => {
              if (!v) return
              const keep =
                settings.lecture === 'all' ||
                v === 'all' ||
                lectureById[settings.lecture]?.domains.includes(v as DomainId)
              set({ domain: v, lecture: keep ? settings.lecture : 'all' })
            }}
          />
        </Row>
        <Row label="Lecture">
          <SelectButton
            label={
              settings.lecture === 'all'
                ? 'Any lecture'
                : `${lectureNo(settings.lecture)} · ${lectureById[settings.lecture]?.title ?? settings.lecture}`
            }
            onPress={() => setPicking(true)}
          />
        </Row>
        <Row label="Length">
          <Choice
            value={String(settings.count)}
            options={COUNTS.map((c) => ({ value: String(c), label: String(c) }))}
            onChange={(v) => v && set({ count: Number(v) })}
          />
        </Row>
        <Row label="Scope">
          <Toggle label="Unseen only" value={settings.unseen} onChange={(v) => set({ unseen: v })} />
        </Row>
      </Rows>

      {!pool.length ? (
        <Text style={type.muted}>
          Nothing matches. Loosen the filters, or drop “unseen only”.
        </Text>
      ) : null}

      <Sheet
        open={picking}
        title="Lecture"
        value={settings.lecture}
        onClose={() => setPicking(false)}
        onSelect={(v) => set({ lecture: v })}
        items={[
          { value: 'all', label: 'Any lecture' },
          ...inDomain.map((l) => ({ value: l.id, label: l.title, hint: lectureNo(l.id) })),
        ]}
      />
      <View style={{ height: space[2] }} />
    </Frame>
  )
}
