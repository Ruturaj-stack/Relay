import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ArrowUpRight,
  Bell,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Inbox,
  Info,
  SearchX,
  Settings,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
} from 'lucide-react'
import type { NotificationType } from '@/types'
import { useNotificationActions, useWorkspace } from '@/hooks/useWorkspace'
import { notificationList } from '@/lib/selectors'
import { NOTIFICATION_META, cn, dayHeading, relativeTime, toneColor } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge, Button, DemoBadge, EmptyState, Skeleton } from '@/components/ui/primitives'
import { SearchField } from '@/components/ui/forms'
import { Tabs } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/overlays'

const ICONS: Record<NotificationType, typeof Info> = {
  handoff_request: ArrowLeftRight,
  confirmation: CheckCircle2,
  return_reminder: Clock3,
  overdue: TriangleAlert,
  team_invite: Users,
  system: Info,
  issue: TriangleAlert,
}

const TYPE_ORDER: NotificationType[] = [
  'handoff_request',
  'confirmation',
  'return_reminder',
  'overdue',
  'team_invite',
  'issue',
  'system',
]

const ATTENTION: NotificationType[] = ['handoff_request', 'overdue', 'issue', 'return_reminder']

export function NotificationsPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const navigate = useNavigate()
  const { read, readAll, clearRead } = useNotificationActions()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(30)
  const [clearOpen, setClearOpen] = useState(false)

  const notifications = useMemo(() => (data ? notificationList(data) : []), [data])
  const unread = notifications.filter((item) => !item.read).length
  const attention = notifications.filter((item) => !item.read && ATTENTION.includes(item.type)).length
  const readCount = notifications.length - unread

  const typeCounts = useMemo(() => {
    const counts = new Map<NotificationType, number>()
    for (const notification of notifications) {
      counts.set(notification.type, (counts.get(notification.type) ?? 0) + 1)
    }
    return counts
  }, [notifications])

  const filtered = useMemo(() => {
    let list = notifications
    if (filter === 'unread') list = list.filter((item) => !item.read)
    if (typeFilter !== 'all') list = list.filter((item) => item.type === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((item) =>
        [item.title, item.body, NOTIFICATION_META[item.type].label].join(' ').toLowerCase().includes(q),
      )
    }
    return list
  }, [notifications, filter, typeFilter, search])

  const shown = filtered.slice(0, visible)
  const grouped = useMemo(() => {
    const sections: Array<{ day: string; items: typeof shown }> = []
    for (const item of shown) {
      const day = dayHeading(item.createdAt)
      const section = sections.find((entry) => entry.day === day)
      if (section) section.items.push(item)
      else sections.push({ day, items: [item] })
    }
    return sections
  }, [shown])

  const openNotification = (id: string, href: string, isRead: boolean) => {
    if (!isRead) read.mutate(id)
    navigate(href)
  }

  const resetFilters = () => {
    setFilter('all')
    setTypeFilter('all')
    setSearch('')
    setVisible(30)
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Inbox</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Notifications<span className="text-accent">.</span>
          </>
        }
        description="Requests, confirmations and reminders — each one linked to the handoff or record it came from. Nothing here is generated after the fact."
        actions={
          <>
            <Button
              variant="secondary"
              icon={CheckCheck}
              disabled={unread === 0 || readAll.isPending}
              loading={readAll.isPending}
              onClick={() => readAll.mutate()}
            >
              Mark all read
            </Button>
            <Button
              variant="ghost"
              icon={Settings}
              onClick={() => navigate('/settings?tab=notifications')}
            >
              Preferences
            </Button>
          </>
        }
      />

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          <Stat label="All notifications" value={notifications.length} note="In your inbox" tone="info" />
          <Stat label="Unread" value={unread} note={unread ? 'Waiting for you' : 'All caught up'} tone="accent" />
          <Stat label="Needs attention" value={attention} note="Requests, reminders, issues" tone={attention ? 'warn' : 'success'} />
          <Stat label="Archived as read" value={readCount} note="Kept in the record" tone="violet" />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs
          variant="pill"
          value={filter}
          onChange={(value) => {
            setFilter(value as 'all' | 'unread')
            setVisible(30)
          }}
          items={[
            { value: 'all', label: 'Everything', count: notifications.length },
            { value: 'unread', label: 'Unread', count: unread },
          ]}
          className="w-fit"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1 sm:w-[230px] sm:flex-none">
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value)
                setVisible(30)
              }}
              placeholder="Search notifications…"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={Trash2}
            disabled={readCount === 0 || clearRead.isPending}
            onClick={() => setClearOpen(true)}
          >
            Clear read
          </Button>
        </div>
      </div>

      <div className="scrollbar-none -mx-1 mb-4 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => {
            setTypeFilter('all')
            setVisible(30)
          }}
          className="chip shrink-0"
          data-active={typeFilter === 'all'}
          aria-pressed={typeFilter === 'all'}
        >
          All types
        </button>
        {TYPE_ORDER.filter((type) => (typeCounts.get(type) ?? 0) > 0).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setTypeFilter(type)
              setVisible(30)
            }}
            className="chip shrink-0"
            data-active={typeFilter === type}
            aria-pressed={typeFilter === type}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: toneColor[NOTIFICATION_META[type].tone] }} />
            {NOTIFICATION_META[type].label}
            <span className="font-mono text-[9px] text-faint">{typeCounts.get(type)}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <Skeleton key={index} className="h-[78px] rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={TriangleAlert}
          title="Your inbox could not load"
          description="The notifications are stored with the demo workspace on this device. Try again."
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={notifications.length === 0 ? Inbox : search ? SearchX : BellOff}
          title={
            notifications.length === 0
              ? 'Your inbox is empty'
              : search
                ? `No notifications match “${search}”`
                : filter === 'unread'
                  ? 'No unread notifications'
                  : 'Nothing in this type'
          }
          description={
            notifications.length === 0
              ? 'When a teammate requests an item or a return needs confirming, it will land here with a link to the record.'
              : 'Try a different filter, or clear the search to see everything again.'
          }
          action={
            notifications.length > 0 ? (
              <Button variant="secondary" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : (
              <Button variant="primary" icon={Sparkles} onClick={() => navigate('/handoffs/new')}>
                Start a handoff
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-5">
          {grouped.map((section) => (
            <section key={section.day}>
              <div className="sticky top-[57px] z-20 -mx-4 mb-2 flex items-center gap-3 bg-bg/85 px-4 py-2 backdrop-blur-md md:top-[65px]">
                <h2 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-faint">{section.day}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="font-mono text-[8.5px] text-faint">{section.items.length}</span>
              </div>
              <div className="overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface">
                {section.items.map((notification, index) => {
                  const Icon = ICONS[notification.type]
                  const meta = NOTIFICATION_META[notification.type]
                  return (
                    <motion.button
                      key={notification.id}
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.12), duration: 0.18 }}
                      onClick={() => openNotification(notification.id, notification.href, notification.read)}
                      className={cn(
                        'focusable-row group flex w-full items-start gap-3 border-b border-line px-3.5 py-3.5 text-left last:border-b-0 sm:px-4',
                        !notification.read && 'bg-accent/[0.025]',
                      )}
                    >
                      <span
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        style={{
                          color: toneColor[meta.tone],
                          backgroundColor: `color-mix(in srgb, ${toneColor[meta.tone]} 10%, transparent)`,
                          borderColor: `color-mix(in srgb, ${toneColor[meta.tone]} 20%, transparent)`,
                        }}
                      >
                        <Icon size={15} strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span
                            className={cn(
                              'text-[12.5px] leading-snug',
                              notification.read ? 'font-normal text-muted' : 'font-medium text-ink',
                            )}
                          >
                            {notification.title}
                          </span>
                          {!notification.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-faint">{notification.body}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-faint">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <span title={new Date(notification.createdAt).toLocaleString()}>
                            {relativeTime(notification.createdAt)}
                          </span>
                          {notification.handoffId && (
                            <>
                              <span>·</span>
                              <span className="font-mono uppercase tracking-wider">Linked record</span>
                            </>
                          )}
                        </span>
                      </span>
                      <ArrowUpRight
                        size={13}
                        className="mt-1.5 shrink-0 text-faint transition-colors group-hover:text-accent"
                      />
                    </motion.button>
                  )
                })}
              </div>
            </section>
          ))}

          {filtered.length > shown.length && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setVisible((value) => value + 30)}>
                Show {Math.min(30, filtered.length - shown.length)} more
              </Button>
            </div>
          )}

          <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
            <Bell size={9} /> {shown.length} of {filtered.length} notifications · Demo workspace inbox
          </p>
        </div>
      )}

      <ConfirmDialog
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={() => {
          clearRead.mutate(undefined, { onSettled: () => setClearOpen(false) })
        }}
        loading={clearRead.isPending}
        title="Clear read notifications?"
        description={`${readCount} notification${readCount === 1 ? '' : 's'} will be removed from your inbox. Handoffs, items and the activity record are not affected.`}
        confirmLabel="Clear read"
      >
        <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-[11px] leading-relaxed text-faint">
          Unread notifications stay in place. This only tidies the ones you have already opened.
        </p>
      </ConfirmDialog>
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
  tone: 'accent' | 'info' | 'success' | 'warn' | 'violet'
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
