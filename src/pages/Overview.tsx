import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  Package,
  Plus,
  QrCode,
  ScanLine,
  Send,
  ShieldCheck,
  Sparkles,
  Undo2,
  Zap,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HandoffView } from '@/types'
import { useHandoffAction, useWorkspace } from '@/hooks/useWorkspace'
import {
  activityFeed,
  activitySeries,
  dashboardStats,
  getCurrentProfile,
  upcomingReturns,
} from '@/lib/selectors'
import {
  EVENT_META,
  cn,
  dueLabel,
  firstName,
  formatDuration,
  greeting,
  pct,
  relativeTime,
  toneStyle,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  ConditionPill,
  CountUp,
  DemoBadge,
  EmptyState,
  ImageWithFallback,
  ProgressRing,
  RiskPill,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives'
import { SegmentedControl } from '@/components/ui/tabs'
import { ReportIssueDialog } from '@/components/ReportIssueDialog'
import { useNow } from '@/hooks/useViewport'

type Range = '7' | '30' | '90'

export function OverviewPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const [range, setRange] = useState<Range>('30')
  const [issueOpen, setIssueOpen] = useState(false)
  const action = useHandoffAction()
  const navigate = useNavigate()
  const now = useNow(60_000)

  const days = Number(range)
  const profile = data ? getCurrentProfile(data) : undefined
  const stats = useMemo(() => (data ? dashboardStats(data, days) : null), [data, days])
  const series = useMemo(() => (data ? activitySeries(data, days) : []), [data, days])
  const upcoming = useMemo(() => (data ? upcomingReturns(data).slice(0, 5) : []), [data])
  const feed = useMemo(() => (data ? activityFeed(data, { limit: 6 }) : []), [data])
  const onTimeRate = useMemo(() => {
    if (!data) return 0
    const completed = data.handoffs.filter((handoff) => handoff.status === 'returned' && handoff.returnedAt)
    const onTime = completed.filter(
      (handoff) => handoff.returnedAt && new Date(handoff.returnedAt).getTime() <= new Date(handoff.dueAt).getTime(),
    )
    return pct(onTime.length, completed.length)
  }, [data])

  if (isLoading) return <DashboardSkeleton />
  if (isError || !data || !stats || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={Activity}
          title="The workspace could not load"
          description="Your local data is still on this device. Try loading the overview again."
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const totalCreated = series.reduce((sum, point) => sum + point.created, 0)
  const totalCompleted = series.reduce((sum, point) => sum + point.completed, 0)
  const attention = stats.needsAction.slice(0, 3)
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(now)

  const handleQuickAction = (handoff: HandoffView) => {
    if (handoff.status === 'requested') {
      action.mutate(
        { handoffId: handoff.id, action: 'accept' },
        { onSuccess: () => navigate(`/handoffs/${handoff.id}`) },
      )
    } else if (handoff.status === 'draft') {
      action.mutate({ handoffId: handoff.id, action: 'send' }, { onSuccess: () => navigate(`/handoffs/${handoff.id}`) })
    } else {
      navigate(`/handoffs/${handoff.id}`)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-faint">{dateLabel}</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <span>
            {greeting()}, <span className="display italic text-accent">{firstName(profile.name)}.</span>
          </span>
        }
        description={
          stats.needsAction.length > 0
            ? `${stats.needsAction.length} ${stats.needsAction.length === 1 ? 'handoff needs' : 'handoffs need'} your attention. The rest is moving on its own.`
            : 'Everything is moving as planned. Here is the shape of your workspace today.'
        }
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

      {action.isError && (
        <div className="mb-4 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2 text-[11.5px] text-danger">
          {action.error.message}
        </div>
      )}

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-line lg:grid-cols-5">
          <Stat
            label="Active handoffs"
            value={stats.active}
            icon={ArrowLeftRight}
            note={stats.needsAction.length ? `${stats.needsAction.length} need you` : 'All moving'}
            accent
          />
          <Stat label="In my possession" value={stats.inPossession} icon={Package} note="Items on your desk" />
          <Stat
            label="Pending scans"
            value={stats.pendingConfirmations}
            icon={QrCode}
            note="Awaiting receipt proof"
          />
          <Stat label="Overdue returns" value={stats.overdue} icon={Clock3} note="Estimated from due dates" danger={stats.overdue > 0} />
          <Stat
            label="Completed"
            value={stats.totalCompletedRange}
            icon={CheckCircle2}
            note={`Last ${days} days`}
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card overflow-hidden lg:col-span-7">
          <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Handoff pulse</h2>
                <Badge tone="neutral">Live demo data</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-faint">Requests created against returns completed.</p>
            </div>
            <SegmentedControl
              value={range}
              onChange={setRange}
              options={[
                { value: '7', label: '7d' },
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
              ]}
              size="sm"
            />
          </div>
          <div className="px-4 pt-4 sm:px-5">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="text-[26px] font-medium leading-none tracking-tight text-ink">
                  <CountUp value={totalCreated} />
                </p>
                <p className="mt-1 text-[10px] text-faint">handoffs started</p>
              </div>
              <div>
                <p className="text-[26px] font-medium leading-none tracking-tight text-ink">
                  <CountUp value={totalCompleted} />
                </p>
                <p className="mt-1 text-[10px] text-faint">returns completed</p>
              </div>
              <div className="ml-auto flex items-center gap-3 pb-0.5">
                <span className="flex items-center gap-1.5 text-[9.5px] text-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Started
                </span>
                <span className="flex items-center gap-1.5 text-[9.5px] text-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-info" /> Returned
                </span>
              </div>
            </div>
          </div>
          <div className="h-[230px] w-full px-1 pb-2 pt-4 sm:h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="createdFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={28}
                  tick={{ fill: 'var(--faint)', fontSize: 9.5, fontFamily: 'var(--font-mono)' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={22}
                  tick={{ fill: 'var(--faint)', fontSize: 9.5, fontFamily: 'var(--font-mono)' }}
                />
                <Tooltip content={<PulseTooltip />} cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Started"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  fill="url(#createdFill)"
                  activeDot={{ r: 3.5, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Returned"
                  stroke="var(--info)"
                  strokeWidth={1.5}
                  fill="url(#completedFill)"
                  activeDot={{ r: 3.5, fill: 'var(--info)', stroke: 'var(--bg)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
            <FooterMetric label="On-time returns" value={`${onTimeRate}%`} tone="success" />
            <FooterMetric
              label="Avg. hold time"
              value={formatDuration(
                data.handoffs
                  .filter((handoff) => handoff.returnedAt)
                  .map((handoff) => new Date(handoff.returnedAt!).getTime() - new Date(handoff.createdAt).getTime())
                  .reduce((sum, value, _, list) => sum + value / list.length, 0),
              )}
            />
            <FooterMetric label="Records complete" value={`${pct(data.handoffs.filter((h) => h.proof).length, data.handoffs.length)}%`} />
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Needs you</h2>
                {attention.length > 0 && <Badge tone="warn">{stats.needsAction.length}</Badge>}
              </div>
              <p className="mt-0.5 text-[11px] text-faint">Small actions that keep the chain moving.</p>
            </div>
            <Link to="/handoffs?filter=attention" className="tap-link text-[10.5px] font-medium text-muted hover:text-accent">
              View all
            </Link>
          </div>
          <div className="flex-1">
            {attention.length === 0 ? (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-success/25 bg-success/8 text-success">
                  <Check size={19} />
                </div>
                <p className="text-[13px] font-medium text-ink">You're all clear</p>
                <p className="mt-1 max-w-[230px] text-[11px] leading-relaxed text-faint">
                  Nothing needs your signature, scan or acceptance right now.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-line">
                {attention.map((handoff) => (
                  <div key={handoff.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                    <ImageWithFallback
                      src={handoff.item.image}
                      alt={handoff.item.name}
                      className="h-10 w-10 shrink-0 rounded-lg border border-line"
                      iconSize={15}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => navigate(`/handoffs/${handoff.id}`)}
                        className="block max-w-full truncate text-left text-[12px] font-medium text-ink hover:text-accent"
                      >
                        {handoff.item.name}
                      </button>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-faint">
                        <span className="font-mono">{handoff.code}</span>
                        <span>·</span>
                        <span>{handoff.status === 'draft' ? 'Draft ready to send' : dueLabel(handoff.dueAt)}</span>
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
                        <ConditionPill condition={handoff.conditionOut} />
                      </div>
                    </div>
                    <div className="shrink-0">
                      {handoff.status === 'requested' || handoff.status === 'draft' ? (
                        <button
                          type="button"
                          onClick={() => handleQuickAction(handoff)}
                          disabled={action.isPending}
                          className="btn btn-primary btn-sm"
                        >
                          {handoff.status === 'requested' ? (
                            <>
                              <Check size={12} /> Accept
                            </>
                          ) : (
                            <>
                              <Send size={12} /> Send
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/handoffs/${handoff.id}`)}
                          className="btn btn-secondary btn-sm"
                        >
                          <Eye size={12} /> Open
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-line p-3">
            <div className="grid grid-cols-4 gap-1.5">
              <MiniAction icon={ScanLine} label="Scan" onClick={() => navigate('/scan')} accent />
              <MiniAction icon={Undo2} label="Return" onClick={() => navigate('/handoffs?filter=possession')} />
              <MiniAction icon={Plus} label="Create" onClick={() => navigate('/handoffs/new')} />
              <MiniAction icon={Zap} label="Issue" onClick={() => setIssueOpen(true)} />
            </div>
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-7">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Recent activity</h2>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
              </div>
              <p className="mt-0.5 text-[11px] text-faint">The trust record, as it happens.</p>
            </div>
            <Link to="/activity" className="tap-link inline-flex items-center gap-1 text-[10.5px] font-medium text-muted hover:text-accent">
              Full timeline <ArrowUpRight size={11} />
            </Link>
          </div>
          <div className="divide-y divide-line">
            {feed.map((entry, index) => {
              const meta = EVENT_META[entry.event.type]
              return (
                <motion.button
                  key={entry.event.id}
                  type="button"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03, duration: 0.2 }}
                  onClick={() => navigate(`/handoffs/${entry.handoff.id}`)}
                  className="focusable-row flex w-full items-start gap-3 px-4 py-3 text-left sm:px-5"
                >
                  <Avatar profile={entry.actor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] leading-relaxed text-muted">
                      <span className="font-medium text-ink">{entry.actor.name}</span>{' '}
                      {meta.sentence}{' '}
                      <span className="font-medium text-ink">{entry.handoff.item.name}</span>.
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                      <span>{relativeTime(entry.event.createdAt)}</span>
                      <span>·</span>
                      <span>{entry.handoff.code}</span>
                      <span
                        className="rounded-full px-1.5 py-0.5 text-[8.5px] normal-case tracking-normal"
                        style={toneStyle(meta.tone)}
                      >
                        {meta.label}
                      </span>
                    </p>
                  </div>
                  <ArrowRight size={12} className="mt-2 shrink-0 text-faint" />
                </motion.button>
              )
            })}
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Upcoming returns</h2>
                <Sparkles size={12} className="text-accent" />
              </div>
              <p className="mt-0.5 text-[11px] text-faint">Estimated risk, based on real signals.</p>
            </div>
            <Link to="/handoffs?filter=active" className="tap-link text-[10.5px] font-medium text-muted hover:text-accent">
              All active
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Undo2} title="No returns on the horizon" description="Active loans will appear here." compact />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {upcoming.map((handoff) => (
                <button
                  key={handoff.id}
                  type="button"
                  onClick={() => navigate(`/handoffs/${handoff.id}`)}
                  className="focusable-row flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
                >
                  <ImageWithFallback
                    src={handoff.item.image}
                    alt={handoff.item.name}
                    className="h-9 w-9 shrink-0 rounded-lg border border-line"
                    iconSize={14}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-medium text-ink">{handoff.item.name}</p>
                    <p
                      className={cn(
                        'mt-0.5 text-[9.5px]',
                        handoff.isOverdue ? 'text-danger' : 'text-faint',
                      )}
                    >
                      {dueLabel(handoff.dueAt)} · with {handoff.receiver.name.split(' ')[0]}
                    </p>
                  </div>
                  <RiskPill risk={handoff.risk} compact />
                </button>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 border-t border-line bg-surface-2/30 px-4 py-3 sm:px-5">
            <ShieldCheck size={13} className="mt-0.5 shrink-0 text-faint" />
            <p className="text-[9.5px] leading-relaxed text-faint">
              Return risk is an estimate from due dates, condition photos and past return behaviour. It is not a fact and
              never changes a handoff status on its own.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TrustMetric
          label="On-time handoffs"
          value={onTimeRate}
          suffix="%"
          detail="Across all completed returns"
          tone="success"
        />
        <TrustMetric
          label="Complete records"
          value={pct(data.handoffs.filter((h) => h.proof).length, data.handoffs.length)}
          suffix="%"
          detail="Handoffs with digital proof"
          tone="accent"
        />
        <div className="card flex items-center gap-4 p-4">
          <ProgressRing value={stats.overdue ? 100 - stats.overdue * 8 : 100} size={58} stroke={4} tone="info">
            <ArrowLeftRight size={15} className="text-info" />
          </ProgressRing>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-ink">Your handoff footprint</p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-faint">
              {data.items.filter((item) => item.holderId === profile.id).length} items in hand ·{' '}
              {data.handoffs.filter((h) => h.senderId === profile.id || h.receiverId === profile.id).length} handoffs
              connected
            </p>
            <Link to="/items" className="tap-link mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-accent">
              Review items <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      </div>

      <ReportIssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} />
    </div>
  )
}

function Stat({
  label,
  value,
  icon: Icon,
  note,
  accent,
  danger,
  className,
}: {
  label: string
  value: number
  icon: typeof Package
  note: string
  accent?: boolean
  danger?: boolean
  className?: string
}) {
  return (
    <div className={cn('relative p-3.5 sm:p-4', className)}>
      {accent && <span className="absolute inset-x-4 top-0 h-px bg-accent/60" />}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-faint">{label}</span>
        <Icon size={13} className={danger ? 'text-danger' : accent ? 'text-accent' : 'text-faint'} strokeWidth={1.7} />
      </div>
      <p className={cn('mt-2 text-[27px] font-medium leading-none tracking-[-0.04em]', danger ? 'text-danger' : 'text-ink')}>
        <CountUp value={value} />
      </p>
      <p className="mt-1.5 text-[9.5px] text-faint">{note}</p>
    </div>
  )
}

function MiniAction({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof ScanLine
  label: string
  onClick: () => void
  accent?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[46px] flex-col items-center justify-center gap-1 rounded-lg border text-[9.5px] font-medium transition-all active:scale-[0.97]',
        accent
          ? 'border-accent/25 bg-accent-soft text-accent hover:bg-accent/15'
          : 'border-line bg-surface-2/50 text-muted hover:border-line-strong hover:text-ink',
      )}
    >
      <Icon size={14} strokeWidth={1.8} />
      {label}
    </button>
  )
}

function FooterMetric({ label, value, tone }: { label: string; value: string; tone?: 'success' }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className={cn('text-[15px] font-medium tracking-tight', tone === 'success' ? 'text-success' : 'text-ink')}>{value}</p>
      <p className="mt-0.5 text-[9px] text-faint">{label}</p>
    </div>
  )
}

function TrustMetric({
  label,
  value,
  suffix,
  detail,
  tone,
}: {
  label: string
  value: number
  suffix: string
  detail: string
  tone: 'success' | 'accent'
}) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <ProgressRing value={value} size={58} stroke={4} tone={tone}>
        <span className="text-[13px] font-medium text-ink">
          <CountUp value={value} format={(n) => `${Math.round(n)}${suffix}`} />
        </span>
      </ProgressRing>
      <div>
        <p className="text-[11.5px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-faint">{detail}</p>
      </div>
    </div>
  )
}

function PulseTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line-strong bg-surface-2/95 px-3 py-2.5 shadow-xl backdrop-blur">
      <p className="mb-1.5 font-mono text-[9px] uppercase tracking-wider text-faint">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5 text-[10.5px]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted">{entry.name}</span>
          <span className="ml-auto font-mono text-ink">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-3 w-52" />
        <Skeleton className="h-9 w-[380px] max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <Skeleton className="h-[100px] rounded-[var(--radius-lg)]" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[420px] rounded-[var(--radius-lg)] lg:col-span-7" />
        <Skeleton className="h-[420px] rounded-[var(--radius-lg)] lg:col-span-5" />
        <Skeleton className="h-[330px] rounded-[var(--radius-lg)] lg:col-span-7" />
        <Skeleton className="h-[330px] rounded-[var(--radius-lg)] lg:col-span-5" />
      </div>
    </div>
  )
}
