import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Ban,
  BadgeCheck,
  Check,
  Download,
  FileCheck2,
  MessageSquare,
  Plus,
  QrCode,
  RotateCcw,
  SearchX,
  Send,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  UserRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { EventType } from '@/types'
import { useWorkspace } from '@/hooks/useWorkspace'
import { activityFeed } from '@/lib/selectors'
import {
  EVENT_META,
  cn,
  dayHeading,
  downloadBlob,
  formatDateTime,
  formatTime,
  relativeTime,
  toCsv,
  toneColor,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  DemoBadge,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives'
import { SearchField } from '@/components/ui/forms'
import { SegmentedControl } from '@/components/ui/tabs'
import { toast } from '@/store/appStore'

type Group = 'all' | 'handoffs' | 'condition' | 'issues' | 'notes'
type Range = 'all' | '7' | '30' | '90'

const EVENT_ICON: Record<EventType, LucideIcon> = {
  created: Plus,
  requested: Send,
  accepted: Check,
  declined: X,
  qr_scanned: QrCode,
  handed_over: ArrowRight,
  received: ShieldCheck,
  condition_updated: Wrench,
  return_requested: Undo2,
  returned: RotateCcw,
  completed: BadgeCheck,
  cancelled: Ban,
  note: MessageSquare,
  issue_reported: TriangleAlert,
  proof_uploaded: FileCheck2,
}

const HANDOFF_EVENTS: EventType[] = [
  'created',
  'requested',
  'accepted',
  'declined',
  'qr_scanned',
  'handed_over',
  'received',
  'return_requested',
  'returned',
  'completed',
  'cancelled',
]

export function ActivityPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const navigate = useNavigate()
  const [group, setGroup] = useState<Group>('all')
  const [range, setRange] = useState<Range>('30')
  const [actorId, setActorId] = useState('all')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(20)

  const allEntries = useMemo(() => {
    if (!data) return []
    return activityFeed(data, {
      days: range === 'all' ? undefined : Number(range),
      actorId: actorId === 'all' ? undefined : actorId,
    })
  }, [data, range, actorId])

  const filtered = useMemo(() => {
    let list = allEntries
    if (group === 'handoffs') list = list.filter((entry) => HANDOFF_EVENTS.includes(entry.event.type))
    else if (group === 'condition')
      list = list.filter((entry) => entry.event.type === 'condition_updated' || entry.event.type === 'proof_uploaded')
    else if (group === 'issues') list = list.filter((entry) => entry.event.type === 'issue_reported')
    else if (group === 'notes') list = list.filter((entry) => entry.event.type === 'note')
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((entry) =>
        [
          entry.actor.name,
          entry.handoff.item.name,
          entry.handoff.code,
          entry.event.note ?? '',
          EVENT_META[entry.event.type].label,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return list
  }, [allEntries, group, search])

  const stats = useMemo(() => {
    const handoffIds = new Set(allEntries.map((entry) => entry.handoff.id))
    const people = new Set(allEntries.map((entry) => entry.actor.id))
    return {
      events: allEntries.length,
      handoffs: handoffIds.size,
      people: people.size,
      issues: allEntries.filter((entry) => entry.event.type === 'issue_reported').length,
    }
  }, [allEntries])

  const shown = filtered.slice(0, visible)
  const grouped = useMemo(() => {
    const groups: Array<{ day: string; entries: typeof shown }> = []
    for (const entry of shown) {
      const day = dayHeading(entry.event.createdAt)
      const existing = groups.find((item) => item.day === day)
      if (existing) existing.entries.push(entry)
      else groups.push({ day, entries: [entry] })
    }
    return groups
  }, [shown])

  const exportCsv = () => {
    if (!filtered.length) {
      toast.info('Nothing to export', 'There are no activity events in this view.')
      return
    }
    const csv = toCsv(
      filtered.map((entry) => ({
        timestamp: new Date(entry.event.createdAt).toISOString(),
        event: EVENT_META[entry.event.type].label,
        actor: entry.actor.name,
        handoff: entry.handoff.code,
        item: entry.handoff.item.name,
        note: entry.event.note ?? '',
      })),
    )
    downloadBlob(csv, `relay-activity-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
    toast.success('Activity exported', `${filtered.length} events written to CSV.`)
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Trust record</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Activity<span className="text-accent">.</span>
          </>
        }
        description="Every action, verification and condition change, in the order it happened. Nothing here is inferred — each line comes from a recorded event."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" icon={ArrowRight} onClick={() => navigate('/handoffs')}>
              View handoffs
            </Button>
          </>
        }
      />

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Events" value={stats.events} note={range === 'all' ? 'All recorded time' : `Last ${range} days`} tone="accent" />
          <Stat label="Handoffs" value={stats.handoffs} note="Touched in this window" tone="info" />
          <Stat label="People" value={stats.people} note="Actors in the record" tone="violet" />
          <Stat label="Issues" value={stats.issues} note={stats.issues ? 'Need a review' : 'None reported'} tone={stats.issues ? 'danger' : 'success'} />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto px-1">
          {(
            [
              { value: 'all', label: 'Everything' },
              { value: 'handoffs', label: 'Handoffs' },
              { value: 'condition', label: 'Condition & proof' },
              { value: 'issues', label: 'Issues' },
              { value: 'notes', label: 'Notes' },
            ] as Array<{ value: Group; label: string }>
          ).map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                setGroup(item.value)
                setVisible(20)
              }}
              className={cn('chip shrink-0', group === item.value && 'chip-accent')}
              data-active={group === item.value}
              aria-pressed={group === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={range}
            onChange={(next) => {
              setRange(next)
              setVisible(20)
            }}
            size="sm"
            options={[
              { value: '7', label: '7d' },
              { value: '30', label: '30d' },
              { value: '90', label: '90d' },
              { value: 'all', label: 'All' },
            ]}
          />
          <div className="relative">
            <select
              aria-label="Filter by person"
              value={actorId}
              onChange={(event) => {
                setActorId(event.target.value)
                setVisible(20)
              }}
              className="select h-9 w-[150px] text-[12px]"
            >
              <option value="all">Everyone</option>
              {data?.profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.id === data.currentUserId ? 'You' : profile.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative min-w-[170px] flex-1 sm:w-[220px] sm:flex-none">
            <SearchField value={search} onChange={(value) => { setSearch(value); setVisible(20) }} placeholder="Search the record…" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[68px] rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={ShieldAlert}
          title="The activity record could not load"
          description="Try again. The trust record is rebuilt from the events stored on this device."
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={search ? SearchX : Activity}
          title={search ? `No events match “${search}”` : 'No activity in this window'}
          description={
            search
              ? 'Try the item name, handoff code, person or a phrase from the note.'
              : 'Widen the date range or choose a different person. New handoff events will appear here immediately.'
          }
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSearch('')
                setGroup('all')
                setRange('all')
                setActorId('all')
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((section) => (
            <section key={section.day}>
              <div className="sticky top-[57px] z-20 -mx-4 mb-2 flex items-center gap-3 bg-bg/85 px-4 py-2 backdrop-blur-md md:top-[65px]">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">{section.day}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[8.5px] text-faint">{section.entries.length}</span>
              </div>
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
                {section.entries.map((entry) => {
                  const Icon = EVENT_ICON[entry.event.type]
                  const meta = EVENT_META[entry.event.type]
                  return (
                    <div key={entry.event.id} className="group relative flex gap-3 border-b border-line px-3 py-3 last:border-b-0 sm:px-4">
                      <div className="hidden sm:block">
                        <Avatar profile={entry.actor} size="sm" />
                      </div>
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border sm:hidden"
                        style={{
                          color: toneColor[meta.tone],
                          backgroundColor: `color-mix(in srgb, ${toneColor[meta.tone]} 11%, transparent)`,
                          borderColor: `color-mix(in srgb, ${toneColor[meta.tone]} 22%, transparent)`,
                        }}
                      >
                        <Icon size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[11.5px] font-medium text-ink">{entry.actor.name}</span>
                          <span className="text-[10.5px] text-muted">{meta.sentence}</span>
                          <span className="text-[10.5px] text-faint">·</span>
                          <Link to={`/handoffs/${entry.handoff.id}`} className="text-[10.5px] font-medium text-ink hover:text-accent">
                            {entry.handoff.item.name}
                          </Link>
                          <Link to={`/handoffs/${entry.handoff.id}`} className="font-mono text-[9px] text-faint hover:text-accent">
                            {entry.handoff.code}
                          </Link>
                        </div>
                        {entry.event.note && (
                          <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-muted">{entry.event.note}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-faint">
                          <span title={formatDateTime(entry.event.createdAt)}>{relativeTime(entry.event.createdAt)}</span>
                          <span>·</span>
                          <span>{formatTime(entry.event.createdAt)}</span>
                          {entry.event.meta?.method && (
                            <>
                              <span>·</span>
                              <span className="font-mono uppercase tracking-wider">{entry.event.meta.method}</span>
                            </>
                          )}
                          {entry.event.meta?.offline && <Badge tone="warn">Offline</Badge>}
                        </div>
                      </div>
                      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Link
                          to={`/handoffs/${entry.handoff.id}`}
                          className="btn btn-ghost btn-icon btn-sm opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label={`Open handoff ${entry.handoff.code}`}
                        >
                          <ArrowUpRight size={13} />
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {filtered.length > shown.length && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((value) => value + 25)}>
                Show {Math.min(25, filtered.length - shown.length)} more events
              </Button>
            </div>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
            <UserRound size={9} /> {shown.length} of {filtered.length} events · Demo workspace record
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number
  note: string
  tone: 'accent' | 'info' | 'violet' | 'success' | 'danger'
}) {
  return (
    <div className="p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-faint">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: toneColor[tone] }} />
      </div>
      <p className="mt-2 text-[25px] font-medium leading-none tracking-[-0.04em] text-ink tabular">{value}</p>
      <p className="mt-1.5 text-[9.5px] text-faint">{note}</p>
    </div>
  )
}
