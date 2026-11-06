import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Download,
  Gauge,
  Package,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
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
import { useWorkspace } from '@/hooks/useWorkspace'
import { activitySeries, analyticsSummary } from '@/lib/selectors'
import {
  HANDOFF_STATUS,
  cn,
  downloadBlob,
  formatDuration,
  pct,
  toCsv,
  toneColor,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  CountUp,
  DemoBadge,
  EmptyState,
  ImageWithFallback,
  ProgressRing,
  Skeleton,
} from '@/components/ui/primitives'
import { SegmentedControl } from '@/components/ui/tabs'
import { toast } from '@/store/appStore'

type Range = '30' | '90' | '180'

const RANGE_LABEL: Record<Range, string> = {
  '30': 'Last 30 days',
  '90': 'Last 90 days',
  '180': 'Last 6 months',
}

export function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const navigate = useNavigate()
  const [range, setRange] = useState<Range>('90')

  const days = Number(range)
  const summary = useMemo(() => (data ? analyticsSummary(data, days) : null), [data, days])
  const series = useMemo(() => (data ? activitySeries(data, days) : []), [data, days])

  if (isLoading) return <AnalyticsSkeleton />
  if (isError || !data || !summary) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Analytics could not load"
        description="The workspace data is stored on this device. Try again — no chart is shown unless it can be computed from real records."
        action={
          <Button variant="primary" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  const totalCreated = series.reduce((sum, point) => sum + point.created, 0)
  const totalCompleted = series.reduce((sum, point) => sum + point.completed, 0)
  const busiest = summary.topItems[0]
  const topTeam = summary.teamActivity[0]
  const maxStatus = Math.max(1, ...summary.statusBreakdown.map((entry) => entry.count))
  const maxTeam = Math.max(1, ...summary.teamActivity.map((entry) => entry.count))

  const exportSummary = () => {
    const rows: Array<Record<string, string | number>> = [
      { metric: 'Range', value: RANGE_LABEL[range] },
      { metric: 'Handoffs created', value: summary.total },
      { metric: 'Handoffs completed', value: summary.completed },
      { metric: 'Active handoffs', value: summary.active },
      { metric: 'Overdue handoffs', value: summary.overdue },
      { metric: 'On-time return rate (%)', value: summary.returnOnTimeRate },
      { metric: 'Average hold time', value: formatDuration(summary.avgDurationMs) },
      { metric: 'Average response time (hours)', value: summary.avgResponseHours.toFixed(1) },
      { metric: 'Tracked item value (USD)', value: summary.totalValue },
      ...summary.statusBreakdown.map((entry) => ({ metric: `Status · ${entry.label}`, value: entry.count })),
      ...summary.topItems.map((entry) => ({ metric: `Item · ${entry.name}`, value: entry.count })),
      ...summary.teamActivity.map((entry) => ({ metric: `Team · ${entry.name}`, value: entry.count })),
    ]
    downloadBlob(toCsv(rows), `relay-analytics-${range}d-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
    toast.success('Analytics exported', 'A CSV summary was downloaded from the demo workspace.')
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Insights</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Analytics<span className="text-accent">.</span>
          </>
        }
        description="Patterns across your workspace, computed only from recorded handoffs. Nothing is extrapolated beyond the dates shown."
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportSummary}>
              Export summary
            </Button>
            <Button variant="primary" icon={ArrowRight} onClick={() => navigate('/handoffs')}>
              View handoffs
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarRange size={14} className="text-faint" />
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">{RANGE_LABEL[range]}</span>
          <Badge tone="neutral">Demo data</Badge>
        </div>
        <SegmentedControl
          value={range}
          onChange={setRange}
          size="sm"
          options={[
            { value: '30', label: '30d' },
            { value: '90', label: '90d' },
            { value: '180', label: '6m' },
          ]}
        />
      </div>

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-line lg:grid-cols-5 lg:divide-y-0">
          <Metric
            label="Handoffs created"
            value={summary.total}
            icon={ArrowUpRight}
            note={`In ${RANGE_LABEL[range].toLowerCase()}`}
            tone="accent"
          />
          <Metric label="Completed" value={summary.completed} icon={CheckCircle2} note="Returns confirmed" tone="success" />
          <Metric
            label="Active now"
            value={summary.active}
            icon={BarChart3}
            note={`${summary.overdue} overdue`}
            tone={summary.overdue > 0 ? 'warn' : 'info'}
          />
          <Metric
            label="Avg. hold time"
            value={formatDuration(summary.avgDurationMs)}
            icon={Clock3}
            note="Created → returned"
            tone="violet"
            text
          />
          <Metric
            label="On-time returns"
            value={`${summary.returnOnTimeRate}%`}
            icon={Gauge}
            note="Of all completed"
            tone="success"
            text
            className="col-span-2 lg:col-span-1"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="card overflow-hidden lg:col-span-8">
          <div className="flex flex-col gap-2 border-b border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Transfer volume</h2>
                <Badge tone="neutral">Real records</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-faint">Handoffs created against returns completed over time.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[9.5px] text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Created
              </span>
              <span className="flex items-center gap-1.5 text-[9.5px] text-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-info" /> Returned
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-x-7 gap-y-2 px-4 pt-4 sm:px-5">
            <div>
              <p className="text-[26px] font-medium leading-none tracking-tight text-ink">
                <CountUp value={totalCreated} />
              </p>
              <p className="mt-1 text-[10px] text-faint">created in range</p>
            </div>
            <div>
              <p className="text-[26px] font-medium leading-none tracking-tight text-ink">
                <CountUp value={totalCompleted} />
              </p>
              <p className="mt-1 text-[10px] text-faint">returned in range</p>
            </div>
            <div className="ml-auto pb-0.5 text-right">
              <p className="text-[13px] font-medium text-ink">{pct(totalCompleted, totalCreated)}%</p>
              <p className="text-[9.5px] text-faint">completion ratio</p>
            </div>
          </div>
          <div className="h-[250px] w-full px-1 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 18, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="analyticsReturned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--info)" stopOpacity={0.17} />
                    <stop offset="100%" stopColor="var(--info)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 5" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={26}
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
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--line-strong)', strokeDasharray: '3 3' }} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="var(--accent)"
                  strokeWidth={1.8}
                  fill="url(#analyticsCreated)"
                  activeDot={{ r: 3.5, fill: 'var(--accent)', stroke: 'var(--bg)', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Returned"
                  stroke="var(--info)"
                  strokeWidth={1.5}
                  fill="url(#analyticsReturned)"
                  activeDot={{ r: 3.5, fill: 'var(--info)', stroke: 'var(--bg)', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-4">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-medium text-ink">Trust & speed</h2>
              <ShieldCheck size={13} className="text-success" />
            </div>
            <p className="mt-0.5 text-[11px] text-faint">Derived from timestamps in the record.</p>
          </div>
          <div className="flex flex-col items-center gap-4 px-4 py-5 sm:flex-row sm:px-5">
            <ProgressRing value={summary.returnOnTimeRate} size={92} stroke={5} tone="success">
              <div className="text-center">
                <p className="text-[19px] font-medium leading-none text-ink tabular">{summary.returnOnTimeRate}%</p>
                <p className="mt-1 text-[8.5px] uppercase tracking-wider text-faint">on time</p>
              </div>
            </ProgressRing>
            <div className="min-w-0 flex-1 space-y-2.5">
              <TrustLine
                label="Average response"
                value={
                  summary.avgResponseHours
                    ? formatDuration(summary.avgResponseHours * 3_600_000)
                    : 'No data yet'
                }
                detail="Request → acceptance"
              />
              <TrustLine
                label="Average hold"
                value={summary.avgDurationMs ? formatDuration(summary.avgDurationMs) : 'No data yet'}
                detail="Created → returned"
              />
              <TrustLine
                label="Overdue rate"
                value={`${summary.overdueRate}%`}
                detail={`${summary.overdue} of ${summary.active} active`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-line border-t border-line">
            <div className="px-4 py-3 text-center">
              <p className="text-[16px] font-medium text-ink tabular">{pct(summary.overdue, summary.active)}%</p>
              <p className="mt-0.5 text-[9px] text-faint">active overdue</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[16px] font-medium text-ink tabular">{summary.teamActivity.filter((team) => team.count > 0).length}</p>
              <p className="mt-0.5 text-[9px] text-faint">teams involved</p>
            </div>
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-[13.5px] font-medium text-ink">Status breakdown</h2>
              <p className="mt-0.5 text-[11px] text-faint">Every handoff in the workspace, current state.</p>
            </div>
            <Link to="/handoffs" className="tap-link text-[10.5px] font-medium text-muted hover:text-accent">
              Open list
            </Link>
          </div>
          <div className="space-y-3 px-4 py-4 sm:px-5">
            {summary.statusBreakdown.map((entry) => {
              const meta = HANDOFF_STATUS[entry.status]
              return (
                <div key={entry.status}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[11.5px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: toneColor[meta.tone] }} />
                      {entry.label}
                    </span>
                    <span className="font-mono text-[10px] text-faint tabular">{entry.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(entry.count / maxStatus) * 100}%` }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: toneColor[meta.tone] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-line bg-surface-2/30 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-faint sm:px-5">
            {data.handoffs.length} handoffs · {data.items.length} items · {data.profiles.length} people
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-7">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Most-handed-off items</h2>
                {busiest && <Badge tone="accent">{busiest.name}</Badge>}
              </div>
              <p className="mt-0.5 text-[11px] text-faint">Which items move the most in this window.</p>
            </div>
            <Link to="/items" className="tap-link inline-flex items-center gap-1 text-[10.5px] font-medium text-muted hover:text-accent">
              Inventory <ArrowUpRight size={11} />
            </Link>
          </div>
          {summary.topItems.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Package}
                title="No item activity in this range"
                description="Widen the date range or create a handoff to start the record."
                compact
              />
            </div>
          ) : (
            <div className="divide-y divide-line">
              {summary.topItems.map((item, index) => {
                const itemRecord = data.items.find((entry) => entry.id === item.id)
                return (
                  <Link
                    key={item.id}
                    to={`/items/${item.id}`}
                    className="focusable-row flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <span className="w-4 shrink-0 font-mono text-[9px] text-faint">{String(index + 1).padStart(2, '0')}</span>
                    <ImageWithFallback
                      src={item.image}
                      alt={item.name}
                      className="h-9 w-9 shrink-0 rounded-lg border border-line"
                      iconSize={14}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-medium text-ink">{item.name}</p>
                      <p className="mt-0.5 truncate text-[9.5px] text-faint">
                        {itemRecord?.category ?? 'Item'} · {itemRecord?.serial ?? 'No serial'}
                      </p>
                    </div>
                    <div className="flex w-[120px] shrink-0 items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${(item.count / Math.max(1, summary.topItems[0].count)) * 100}%` }}
                        />
                      </div>
                      <span className="w-5 text-right font-mono text-[10px] text-faint tabular">{item.count}</span>
                    </div>
                    <ArrowUpRight size={12} className="hidden shrink-0 text-faint sm:block" />
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        <section className="card overflow-hidden lg:col-span-5">
          <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-medium text-ink">Team activity</h2>
                {topTeam && topTeam.count > 0 && <Badge tone="violet">{topTeam.name}</Badge>}
              </div>
              <p className="mt-0.5 text-[11px] text-faint">Handoffs attributed to shared teams.</p>
            </div>
            <Users size={14} className="text-faint" />
          </div>
          {summary.teamActivity.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={Users} title="No teams yet" description="Create a team to see shared activity." compact />
            </div>
          ) : (
            <div className="space-y-3 px-4 py-4 sm:px-5">
              {summary.teamActivity.map((team) => (
                <Link
                  key={team.id}
                  to={`/people/${team.id}`}
                  className="block rounded-lg border border-line bg-surface-2/30 p-2.5 transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="truncate text-[11.5px] text-ink">{team.name}</span>
                    </span>
                    <span className="font-mono text-[9.5px] text-faint tabular">{team.count}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(team.count / maxTeam) * 100}%`, backgroundColor: team.color }}
                    />
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div className="border-t border-line px-4 py-3 sm:px-5">
            <Link
              to="/people?tab=teams"
              className="tap-link flex items-center justify-between text-[10.5px] font-medium text-muted hover:text-accent"
            >
              Manage teams <ArrowRight size={11} />
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-[13.5px] font-medium text-ink">What this view does not claim</h2>
            <p className="mt-0.5 text-[11px] text-faint">A short note on the limits of the numbers above.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <Disclaimer
              icon={Sparkles}
              title="No predictions"
              body="Charts describe events already in the record. They do not forecast future volume or behaviour."
            />
            <Disclaimer
              icon={TriangleAlert}
              title="Risk is an estimate"
              body="Return risk shown elsewhere uses due dates and past behaviour. It is labelled as an estimate and never changes a status."
            />
            <Disclaimer
              icon={ShieldCheck}
              title="Small samples"
              body="A few completed handoffs are not a reliability score. Treat percentages with the sample size in mind."
            />
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-medium text-ink">Tracked value</h2>
              <Badge tone="neutral">Demo</Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-faint">Declared item values in this workspace.</p>
          </div>
          <div className="flex flex-1 flex-col justify-center px-4 py-5 sm:px-5">
            <p className="text-[30px] font-medium leading-none tracking-[-0.04em] text-ink tabular">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                summary.totalValue,
              )}
            </p>
            <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
              Across {data.items.length} items with a declared value. This is not insured value or a valuation — it is the
              number entered on each item record.
            </p>
            <Link
              to="/items"
              className="tap-link mt-4 inline-flex items-center gap-1 text-[10.5px] font-medium text-accent hover:underline"
            >
              Review inventory <ArrowRight size={11} />
            </Link>
          </div>
          <div className="border-t border-line px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-faint sm:px-5">
            {RANGE_LABEL[range]} · {summary.total} handoffs
          </div>
        </section>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  icon: Icon,
  note,
  tone,
  text,
  className,
}: {
  label: string
  value: number | string
  icon: typeof BarChart3
  note: string
  tone: 'accent' | 'info' | 'success' | 'warn' | 'violet'
  text?: boolean
  className?: string
}) {
  return (
    <div className={cn('p-3.5 sm:p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-faint">{label}</span>
        <Icon size={13} strokeWidth={1.7} style={{ color: toneColor[tone] }} />
      </div>
      <p className="mt-2 text-[25px] font-medium leading-none tracking-[-0.04em] text-ink">
        {text || typeof value === 'string' ? value : <CountUp value={value} />}
      </p>
      <p className="mt-1.5 text-[9.5px] text-faint">{note}</p>
    </div>
  )
}

function TrustLine({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-ink">{label}</p>
        <p className="text-[9px] text-faint">{detail}</p>
      </div>
      <span className="shrink-0 font-mono text-[10.5px] text-muted">{value}</span>
    </div>
  )
}

function Disclaimer({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 p-3">
      <Icon size={14} className="text-accent" strokeWidth={1.8} />
      <p className="mt-2 text-[11px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-faint">{body}</p>
    </div>
  )
}

function ChartTooltip({
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

function AnalyticsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-3 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[96px] rounded-[var(--radius-lg)]" />
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[390px] rounded-[var(--radius-lg)] lg:col-span-8" />
        <Skeleton className="h-[390px] rounded-[var(--radius-lg)] lg:col-span-4" />
        <Skeleton className="h-[320px] rounded-[var(--radius-lg)] lg:col-span-5" />
        <Skeleton className="h-[320px] rounded-[var(--radius-lg)] lg:col-span-7" />
      </div>
    </div>
  )
}
