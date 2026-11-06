import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpDown,
  Check,
  ChevronRight,
  Clock3,
  Filter,
  Inbox,
  LayoutList,
  Plus,
  QrCode,
  RotateCcw,
  ScanLine,
  SearchX,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import type { HandoffView } from '@/types'
import { useHandoffAction, useWorkspace } from '@/hooks/useWorkspace'
import { getCurrentProfile, queryHandoffs } from '@/lib/selectors'
import {
  ACTIVE_STATUSES,
  cn,
  dueLabel,
  formatDateTime,
  relativeTime,
  toneColor,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  ConditionPill,
  DemoBadge,
  EmptyState,
  ImageWithFallback,
  RiskPill,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives'
import { SearchField } from '@/components/ui/forms'
import { SegmentedControl } from '@/components/ui/tabs'
import { Menu } from '@/components/ui/overlays'

type FilterKey = 'all' | 'attention' | 'active' | 'awaiting' | 'possession' | 'returned'
type SortKey = 'newest' | 'due' | 'oldest'
type Scope = 'mine' | 'workspace'

const FILTERS: Array<{ value: FilterKey; label: string }> = [
  { value: 'all', label: 'Everything' },
  { value: 'attention', label: 'Needs you' },
  { value: 'active', label: 'Active' },
  { value: 'awaiting', label: 'Awaiting scan' },
  { value: 'possession', label: 'In possession' },
  { value: 'returned', label: 'Returned' },
]

export function HandoffsPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const action = useHandoffAction()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [scope, setScope] = useState<Scope>('mine')
  const [teamId, setTeamId] = useState<string>('all')
  const [visible, setVisible] = useState(12)
  const [quickPending, setQuickPending] = useState<string | null>(null)

  const rawFilter = params.get('filter') as FilterKey | null
  const filter: FilterKey = rawFilter && FILTERS.some((item) => item.value === rawFilter) ? rawFilter : 'all'
  const me = data ? getCurrentProfile(data) : undefined

  const setFilter = (next: FilterKey) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('filter')
    else nextParams.set('filter', next)
    setParams(nextParams, { replace: true })
    setVisible(12)
  }

  useEffect(() => {
    setVisible(12)
  }, [filter, search, sort, scope, teamId])

  const source = useMemo(() => {
    if (!data) return [] as HandoffView[]
    return queryHandoffs(data, {
      status: 'all',
      sort,
      currentUserId: scope === 'mine' ? data.currentUserId : null,
    })
  }, [data, sort, scope])

  const filtered = useMemo(() => {
    let list = source
    if (filter === 'attention') list = list.filter((handoff) => handoff.needsMyAction || handoff.isOverdue)
    else if (filter === 'active') list = list.filter((handoff) => ACTIVE_STATUSES.includes(handoff.status))
    else if (filter === 'awaiting')
      list = list.filter((handoff) => handoff.status === 'awaiting_confirmation' || handoff.status === 'in_transit')
    else if (filter === 'possession')
      list = list.filter((handoff) => handoff.status === 'received' && handoff.receiverId === me?.id)
    else if (filter === 'returned') list = list.filter((handoff) => handoff.status === 'returned')

    if (teamId !== 'all') list = list.filter((handoff) => handoff.teamId === teamId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((handoff) =>
        [
          handoff.item.name,
          handoff.code,
          handoff.description,
          handoff.sender.name,
          handoff.receiver.name,
          handoff.team?.name ?? '',
          handoff.item.serial,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return list
  }, [source, filter, teamId, search, me?.id])

  const counts = useMemo(() => {
    const base = source
    return {
      all: base.length,
      attention: base.filter((handoff) => handoff.needsMyAction || handoff.isOverdue).length,
      active: base.filter((handoff) => ACTIVE_STATUSES.includes(handoff.status)).length,
      awaiting: base.filter(
        (handoff) => handoff.status === 'awaiting_confirmation' || handoff.status === 'in_transit',
      ).length,
      possession: base.filter((handoff) => handoff.status === 'received' && handoff.receiverId === me?.id).length,
      returned: base.filter((handoff) => handoff.status === 'returned').length,
    } satisfies Record<FilterKey, number>
  }, [source, me?.id])

  const runQuickAction = (handoff: HandoffView, kind: 'accept' | 'send') => {
    setQuickPending(handoff.id)
    action.mutate(
      { handoffId: handoff.id, action: kind },
      {
        onSettled: () => setQuickPending(null),
        onSuccess: () => navigate(`/handoffs/${handoff.id}`),
      },
    )
  }

  const primaryAction = (handoff: HandoffView) => {
    if (handoff.status === 'draft' && handoff.senderId === me?.id)
      return { label: 'Send', icon: Send, run: () => runQuickAction(handoff, 'send') }
    if (handoff.status === 'requested' && handoff.receiverId === me?.id)
      return { label: 'Accept', icon: Check, run: () => runQuickAction(handoff, 'accept') }
    if (
      handoff.receiverId === me?.id &&
      (handoff.status === 'awaiting_confirmation' || handoff.status === 'in_transit')
    )
      return { label: 'Scan', icon: ScanLine, run: () => navigate(`/scan?code=${handoff.code}`) }
    if (handoff.status === 'received' && handoff.receiverId === me?.id)
      return {
        label: 'Return',
        icon: Undo2,
        run: () => navigate(`/handoffs/${handoff.id}?action=return`),
      }
    return { label: 'Open', icon: ChevronRight, run: () => navigate(`/handoffs/${handoff.id}`) }
  }

  const activeFilters = (filter !== 'all' ? 1 : 0) + (teamId !== 'all' ? 1 : 0) + (scope === 'workspace' ? 1 : 0)
  const shown = filtered.slice(0, visible)

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">The ledger</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Handoffs<span className="text-accent">.</span>
          </>
        }
        description="Every transfer, its owner and its proof. Filter to what needs you, or look back at the record."
        actions={
          <>
            <Button variant="secondary" icon={ScanLine} onClick={() => navigate('/scan')}>
              Scan QR
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => navigate('/handoffs/new')}>
              New handoff
            </Button>
          </>
        }
      />

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
          <Summary label="Active" value={counts.active} note="In motion right now" tone="info" />
          <Summary label="Needs you" value={counts.attention} note="Accept, scan or nudge" tone="accent" />
          <Summary label="Awaiting scan" value={counts.awaiting} note="Receipt not confirmed" tone="warn" />
          <Summary label="Completed" value={counts.returned} note="Closed with a record" tone="success" />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto px-1">
          {FILTERS.map((item) => {
            const active = filter === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn('chip shrink-0', active && 'chip-accent')}
                data-active={active}
                aria-pressed={active}
              >
                {item.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 font-mono text-[8.5px] leading-none',
                    active ? 'bg-black/15' : 'bg-surface-3 text-faint',
                  )}
                >
                  {counts[item.value]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={scope}
            onChange={(next) => setScope(next)}
            options={[
              { value: 'mine', label: 'Mine' },
              { value: 'workspace', label: 'Workspace' },
            ]}
            size="sm"
          />
          <div className="relative min-w-[180px] flex-1 sm:w-[230px] sm:flex-none">
            <SearchField value={search} onChange={setSearch} placeholder="Search item, code, person…" />
          </div>
          <Menu
            label="Filters and sorting"
            trigger={
              <span className="flex items-center gap-1.5 text-[12px]">
                <SlidersHorizontal size={14} /> Filters
                {activeFilters > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[8px] text-accent-ink">
                    {activeFilters}
                  </span>
                )}
              </span>
            }
            triggerClassName="btn btn-secondary btn-sm !w-auto px-2.5"
            items={[
              { label: 'Newest first', icon: ArrowUpDown, onClick: () => setSort('newest') },
              { label: 'Due soonest', icon: Clock3, onClick: () => setSort('due') },
              { label: 'Oldest first', icon: ArrowUpDown, onClick: () => setSort('oldest') },
              {
                label: teamId === 'all' ? 'Filter by team' : 'Show every team',
                icon: Users,
                separator: true,
                onClick: () => setTeamId('all'),
              },
              ...(data?.teams ?? []).map((team) => ({
                label: team.name,
                icon: Filter,
                onClick: () => setTeamId(team.id),
              })),
              {
                label: 'Clear filters',
                icon: X,
                danger: true,
                separator: true,
                disabled: activeFilters === 0 && !search,
                onClick: () => {
                  setFilter('all')
                  setTeamId('all')
                  setScope('mine')
                  setSearch('')
                  setSort('newest')
                },
              },
            ]}
          />
        </div>
      </div>

      {action.isError && (
        <div className="mb-3 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2 text-[11.5px] text-danger">
          {action.error.message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[96px] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={ShieldAlert}
          title="The ledger could not load"
          description="Your changes are stored on this device. Try loading the handoffs again."
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={filter === 'attention' ? Inbox : SearchX}
          title={
            search
              ? `No handoffs match “${search}”`
              : filter === 'attention'
                ? 'Nothing needs you right now'
                : filter === 'possession'
                  ? 'Nothing in your possession'
                  : 'No handoffs in this view'
          }
          description={
            search
              ? 'Try the item name, handoff code, person or team. Search runs across the whole selected scope.'
              : filter === 'attention'
                ? 'Every request has been answered and every return is on schedule.'
                : 'Create a handoff to start a new chain, or switch filters to see the rest of the record.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={Plus} onClick={() => navigate('/handoffs/new')}>
                New handoff
              </Button>
              {(activeFilters > 0 || search) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setFilter('all')
                    setTeamId('all')
                    setScope('mine')
                    setSearch('')
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          }
        />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            <AnimatePresence initial={false}>
              {shown.map((handoff) => (
                <SwipeRow
                  key={handoff.id}
                  handoff={handoff}
                  meId={me?.id}
                  primary={primaryAction(handoff)}
                  pending={quickPending === handoff.id}
                  onOpen={() => navigate(`/handoffs/${handoff.id}`)}
                />
              ))}
            </AnimatePresence>
          </div>

          <div className="hidden overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface md:block">
            <div className="grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] items-center gap-4 border-b border-line bg-surface-2/40 px-4 py-2.5">
              {['Handoff', 'People', 'Status', 'Return', ''].map((label, index) => (
                <span key={index} className="eyebrow text-[9px]">
                  {label}
                </span>
              ))}
            </div>
            <AnimatePresence initial={false}>
              {shown.map((handoff) => (
                <HandoffRow
                  key={handoff.id}
                  handoff={handoff}
                  meId={me?.id}
                  primary={primaryAction(handoff)}
                  pending={quickPending === handoff.id}
                  onOpen={() => navigate(`/handoffs/${handoff.id}`)}
                />
              ))}
            </AnimatePresence>
          </div>

          {filtered.length > shown.length && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((value) => value + 12)}>
                Show {Math.min(12, filtered.length - shown.length)} more
              </Button>
            </div>
          )}
          <p className="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
            {shown.length} of {filtered.length} handoffs · Demo data
          </p>
        </>
      )}
    </div>
  )
}

function Summary({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number
  note: string
  tone: 'accent' | 'info' | 'warn' | 'success'
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

function HandoffRow({
  handoff,
  meId,
  primary,
  pending,
  onOpen,
}: {
  handoff: HandoffView
  meId?: string
  primary: { label: string; icon: typeof ChevronRight; run: () => void }
  pending: boolean
  onOpen: () => void
}) {
  const PrimaryIcon = primary.icon
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="group grid grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] items-center gap-4 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/50"
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 items-start gap-3 text-left">
        <div className="relative shrink-0">
          <ImageWithFallback
            src={handoff.item.image}
            alt={handoff.item.name}
            className="h-11 w-11 rounded-lg border border-line"
            iconSize={16}
          />
          {handoff.pendingSync && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface bg-warn" title="Waiting to sync" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[12.5px] font-medium text-ink">{handoff.item.name}</span>
            {handoff.team && <Badge tone="neutral">{handoff.team.name}</Badge>}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[10.5px] text-faint">{handoff.description}</p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
            <span>{handoff.code}</span>
            <span>·</span>
            <span>{relativeTime(handoff.createdAt)}</span>
          </p>
        </div>
      </button>

      <button type="button" onClick={onOpen} className="flex min-w-0 items-center gap-2 text-left">
        <AvatarStack profiles={[handoff.sender, handoff.receiver]} size="xs" max={2} />
        <div className="min-w-0">
          <p className="truncate text-[10.5px] text-muted">
            {handoff.sender.id === meId ? 'You' : handoff.sender.name.split(' ')[0]} →{' '}
            {handoff.receiver.id === meId ? 'you' : handoff.receiver.name.split(' ')[0]}
          </p>
          <p className="truncate text-[9px] text-faint">{handoff.receiver.title}</p>
        </div>
      </button>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
        <ConditionPill condition={handoff.conditionOut} showDot={false} />
      </div>

      <div className="min-w-0">
        <p
          className={cn(
            'truncate text-[10.5px]',
            handoff.isOverdue ? 'font-medium text-danger' : 'text-muted',
          )}
        >
          {handoff.status === 'returned'
            ? handoff.returnedAt
              ? `Returned ${relativeTime(handoff.returnedAt)}`
              : 'Closed'
            : handoff.status === 'cancelled'
              ? 'Cancelled'
              : dueLabel(handoff.dueAt)}
        </p>
        <div className="mt-1">
          <RiskPill risk={handoff.risk} compact />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={primary.run}
          disabled={pending}
          className={cn(
            'btn btn-sm',
            primary.label === 'Open' ? 'btn-secondary' : 'btn-primary',
          )}
          title={primary.label}
        >
          <PrimaryIcon size={12} />
          {pending ? '…' : primary.label}
        </button>
        <Link
          to={`/handoffs/${handoff.id}`}
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={`Open ${handoff.code}`}
        >
          <ArrowRight size={14} />
        </Link>
      </div>
    </motion.div>
  )
}

function SwipeRow({
  handoff,
  meId,
  primary,
  pending,
  onOpen,
}: {
  handoff: HandoffView
  meId?: string
  primary: { label: string; icon: typeof ChevronRight; run: () => void }
  pending: boolean
  onOpen: () => void
}) {
  const [offset, setOffset] = useState(0)
  const navigate = useNavigate()
  const PrimaryIcon = primary.icon
  const scanAction =
    handoff.receiverId === meId &&
    (handoff.status === 'awaiting_confirmation' || handoff.status === 'in_transit')

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="relative overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface"
    >
      <div className="absolute inset-y-0 right-0 flex w-[188px] items-stretch">
        <button
          type="button"
          onClick={() => {
            setOffset(0)
            primary.run()
          }}
          disabled={pending}
          className={cn(
            'flex w-[94px] flex-col items-center justify-center gap-1 text-[10px] font-medium',
            primary.label === 'Open' ? 'bg-surface-3 text-ink' : 'bg-accent text-accent-ink',
          )}
        >
          <PrimaryIcon size={17} />
          {pending ? 'Working…' : primary.label}
        </button>
        <button
          type="button"
          onClick={() => {
            setOffset(0)
            if (scanAction) navigate(`/scan?code=${encodeURIComponent(handoff.code)}&handoff=${handoff.id}`)
            else onOpen()
          }}
          className="flex w-[94px] flex-col items-center justify-center gap-1 bg-surface-3 text-[10px] font-medium text-ink"
        >
          <QrCode size={17} className="text-accent" />
          {scanAction ? 'Scan' : 'Details'}
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -188, right: 0 }}
        dragElastic={0.04}
        dragMomentum={false}
        animate={{ x: offset }}
        transition={{ type: 'spring', stiffness: 520, damping: 42 }}
        onDragEnd={(_, info) => {
          const next = Math.min(0, Math.max(-188, offset + info.offset.x))
          setOffset(next < -56 ? -188 : 0)
        }}
        className="relative z-10 flex touch-pan-y items-start gap-3 bg-surface px-3 py-3"
      >
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <ImageWithFallback
            src={handoff.item.image}
            alt={handoff.item.name}
            className="h-12 w-12 shrink-0 rounded-lg border border-line"
            iconSize={16}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-medium text-ink">{handoff.item.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                  {handoff.code}
                  <span>·</span>
                  <span>{relativeTime(handoff.createdAt)}</span>
                </p>
              </div>
              <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-[10px] text-muted">
                <Avatar profile={handoff.receiver} size="xs" />
                {handoff.sender.id === meId ? 'You' : handoff.sender.name.split(' ')[0]} →{' '}
                {handoff.receiver.id === meId ? 'you' : handoff.receiver.name.split(' ')[0]}
              </span>
              <span className="text-faint">·</span>
              <span className={cn('text-[10px]', handoff.isOverdue ? 'text-danger' : 'text-faint')}>
                {handoff.status === 'returned' ? 'Returned' : dueLabel(handoff.dueAt)}
              </span>
            </div>
          </div>
        </button>
      </motion.div>
      <div className="pointer-events-none absolute bottom-1.5 right-2 z-20 flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-faint">
        <LayoutList size={9} /> Swipe
      </div>
    </motion.div>
  )
}

export function HandoffQuickLink({ handoff }: { handoff: HandoffView }) {
  return (
    <Link to={`/handoffs/${handoff.id}`} className="flex items-center gap-2 text-[11px] text-muted hover:text-accent">
      <ArrowLeftRight size={12} /> {handoff.code}
      <RotateCcw size={10} /> {formatDateTime(handoff.updatedAt)}
    </Link>
  )
}
