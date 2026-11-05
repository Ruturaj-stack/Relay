import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  BellOff,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Info,
  Settings,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react'
import type { NotificationType } from '@/types'
import { NOTIFICATION_META, cn, relativeTime } from '@/lib/utils'
import { notificationList } from '@/lib/selectors'
import { useLockBodyScroll } from '@/hooks/useViewport'
import { useNotificationActions, useWorkspace } from '@/hooks/useWorkspace'
import { useAppStore } from '@/store/appStore'
import { Badge, EmptyState, Skeleton } from '@/components/ui/primitives'
import { Tabs } from '@/components/ui/tabs'

const icons: Record<NotificationType, typeof Info> = {
  handoff_request: ArrowLeftRight,
  confirmation: CheckCircle2,
  return_reminder: Clock3,
  overdue: TriangleAlert,
  team_invite: Users,
  system: Info,
  issue: TriangleAlert,
}

export function NotificationsPanel() {
  const open = useAppStore((state) => state.notificationsOpen)
  const setOpen = useAppStore((state) => state.setNotificationsOpen)
  const { data, isLoading } = useWorkspace()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [typeFilter, setTypeFilter] = useState<NotificationType | 'all'>('all')
  const { read, readAll, clearRead } = useNotificationActions()
  const navigate = useNavigate()
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const notifications = useMemo(() => (data ? notificationList(data) : []), [data])
  const unread = notifications.filter((item) => !item.read).length
  const filtered = notifications.filter((item) => {
    if (filter === 'unread' && item.read) return false
    if (typeFilter !== 'all' && item.type !== typeFilter) return false
    return true
  })

  const openNotification = (id: string, href: string, isRead: boolean) => {
    if (!isRead) read.mutate(id)
    setOpen(false)
    navigate(href)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
            className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow-lift)] sm:w-[410px]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[16px] font-medium tracking-tight text-ink">Notifications</h2>
                  {unread > 0 && <Badge tone="accent">{unread} new</Badge>}
                </div>
                <p className="mt-1 text-[11px] text-faint">Requests, reminders and the things worth knowing.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="btn btn-ghost btn-icon btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 border-b border-line px-4 py-3 sm:px-5">
              <div className="flex items-center justify-between gap-2">
                <Tabs
                  variant="pill"
                  value={filter}
                  onChange={(value) => setFilter(value as 'all' | 'unread')}
                  items={[
                    { value: 'all', label: 'All', count: notifications.length },
                    { value: 'unread', label: 'Unread', count: unread },
                  ]}
                />
                <button
                  type="button"
                  disabled={unread === 0 || readAll.isPending}
                  onClick={() => readAll.mutate()}
                  className="btn btn-ghost btn-sm disabled:opacity-40"
                >
                  <CheckCheck size={13} /> Mark all
                </button>
              </div>
              <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className="chip h-7 px-2.5 text-[10.5px]"
                  data-active={typeFilter === 'all'}
                >
                  Everything
                </button>
                {(Object.keys(NOTIFICATION_META) as NotificationType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setTypeFilter(type)}
                    data-active={typeFilter === type}
                    className="chip h-7 px-2.5 text-[10.5px]"
                  >
                    {NOTIFICATION_META[type].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="flex gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg" />
                      <div className="flex-1 space-y-2 pt-0.5">
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-2.5 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={BellOff}
                    title={filter === 'unread' ? 'No unread notifications' : 'Nothing here yet'}
                    description={
                      filter === 'unread'
                        ? 'You are all caught up. New requests and reminders will appear here.'
                        : 'Try a different filter, or come back when your team starts moving things.'
                    }
                    compact
                    action={
                      filter !== 'all' ? (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilter('all')}>
                          View everything
                        </button>
                      ) : undefined
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {filtered.map((notification) => {
                    const Icon = icons[notification.type]
                    const meta = NOTIFICATION_META[notification.type]
                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => openNotification(notification.id, notification.href, notification.read)}
                          className={cn(
                            'focusable-row flex w-full items-start gap-3 px-4 py-3.5 text-left sm:px-5',
                            !notification.read && 'bg-accent/[0.025]',
                          )}
                        >
                          <span
                            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                            style={{
                              color: `var(--${meta.tone === 'neutral' ? 'muted' : meta.tone})`,
                              backgroundColor: `color-mix(in srgb, var(--${meta.tone === 'neutral' ? 'muted' : meta.tone}) 9%, transparent)`,
                              borderColor: `color-mix(in srgb, var(--${meta.tone === 'neutral' ? 'muted' : meta.tone}) 18%, transparent)`,
                            }}
                          >
                            <Icon size={14} strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-start gap-2">
                              <span
                                className={cn(
                                  'text-[12px] leading-snug',
                                  notification.read ? 'font-normal text-muted' : 'font-medium text-ink',
                                )}
                              >
                                {notification.title}
                              </span>
                              {!notification.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                            </span>
                            <span className="mt-1 block text-[10.5px] leading-relaxed text-faint">{notification.body}</span>
                            <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-wider text-faint">
                              {meta.label} · {relativeTime(notification.createdAt)}
                            </span>
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 sm:px-5">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate('/settings?tab=notifications')
                }}
                className="btn btn-ghost btn-sm"
              >
                <Settings size={13} /> Preferences
              </button>
              <button
                type="button"
                disabled={notifications.every((item) => !item.read) || clearRead.isPending}
                onClick={() => clearRead.mutate()}
                className="btn btn-ghost btn-sm text-faint disabled:opacity-40"
              >
                Clear read
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
