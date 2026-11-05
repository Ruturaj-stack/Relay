import { useMemo } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LogOut,
  Moon,
  Plus,
  Settings,
  Sun,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { navItems } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { getCurrentProfile, notificationList, queryHandoffs } from '@/lib/selectors'
import { useInstallPrompt } from '@/hooks/useViewport'
import { useWorkspace, useSignOut } from '@/hooks/useWorkspace'
import { useAppStore, toast } from '@/store/appStore'
import { useSyncStore } from '@/store/syncStore'
import { Avatar, BrandMark, Button, DemoBadge, Wordmark } from '@/components/ui/primitives'
import { Menu } from '@/components/ui/overlays'

export const SIDEBAR_WIDTH = { expanded: 248, collapsed: 76 }

export function Sidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed)
  const toggle = useAppStore((state) => state.toggleSidebar)
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const { data } = useWorkspace()
  const { mutate: signOut, isPending } = useSignOut()
  const { canInstall, promptInstall } = useInstallPrompt()
  const online = useSyncStore((state) => state.online)
  const navigate = useNavigate()
  const location = useLocation()

  const profile = data ? getCurrentProfile(data) : undefined
  const unread = data ? notificationList(data).filter((item) => !item.read).length : 0
  const attention = useMemo(
    () => (data ? queryHandoffs(data, { status: 'attention' }).filter((item) => item.needsMyAction).length : 0),
    [data],
  )

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path))

  return (
    <motion.aside
      animate={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-[var(--bg-deep)]/95 backdrop-blur-xl md:flex"
      aria-label="Main navigation"
    >
      <div className={cn('relative flex h-16 shrink-0 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <Link to="/" aria-label="RELAY home" className="flex items-center">
          {collapsed ? <BrandMark size={28} /> : <Wordmark />}
        </Link>
        {!collapsed && <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-faint">Beta</span>}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-[76px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-faint shadow-md transition-colors hover:border-accent/40 hover:text-ink"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className={cn('shrink-0 px-3 pb-1 pt-4', collapsed && 'px-2.5')}>
        <Button
          variant="primary"
          fullWidth
          onClick={() => navigate('/handoffs/new')}
          className={cn(collapsed && 'px-0')}
          icon={Plus}
          title="New handoff"
        >
          {!collapsed && (
            <>
              <span className="flex-1 text-left">New handoff</span>
              <span className="rounded border border-black/15 px-1 py-0.5 font-mono text-[9px] opacity-70">N</span>
            </>
          )}
        </Button>
      </div>

      <nav className={cn('scrollbar-none flex-1 overflow-y-auto py-3', collapsed ? 'px-2' : 'px-3')}>
        {(['workspace', 'insights', 'account'] as const).map((group) => {
          const items = navItems.filter((item) => item.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="mb-4 last:mb-0">
              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mb-1.5 px-2.5 font-mono text-[9px] uppercase tracking-[0.16em] text-faint"
                  >
                    {group === 'workspace' ? 'Workspace' : group === 'insights' ? 'Insights' : 'Account'}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item.path)
                  const badge =
                    item.path === '/handoffs' && attention > 0
                      ? attention
                      : item.path === '/notifications' && unread > 0
                        ? unread
                        : undefined
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      data-active={active}
                      title={collapsed ? item.label : undefined}
                      className={cn('nav-item group', collapsed && 'justify-center px-0')}
                    >
                      <item.icon size={17} strokeWidth={1.7} className="nav-icon" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge !== undefined && (
                            <span
                              className={cn(
                                'flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[9px]',
                                item.path === '/notifications'
                                  ? 'bg-accent text-accent-ink'
                                  : 'bg-warn/15 text-warn',
                              )}
                            >
                              {badge}
                            </span>
                          )}
                          {active && (
                            <motion.span
                              layoutId="sidebar-active"
                              className="absolute left-0 h-4 w-[2px] rounded-r-full bg-accent"
                              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                            />
                          )}
                        </>
                      )}
                      {collapsed && badge !== undefined && (
                        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      <div className={cn('shrink-0 border-t border-line p-3', collapsed && 'px-2.5')}>
        {canInstall && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className={cn(
              'mb-2 flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-2/70 px-2.5 py-2 text-[11.5px] text-muted transition-colors hover:border-accent/30 hover:text-ink',
              collapsed && 'justify-center px-0',
            )}
            title="Install RELAY"
          >
            <Download size={14} className="text-accent" />
            {!collapsed && <span>Install RELAY</span>}
          </button>
        )}

        {!collapsed && (
          <div className="mb-2 rounded-lg border border-line bg-surface/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-medium text-ink">{data?.organization.name ?? 'Fieldwork Studio'}</p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                  {online ? <Wifi size={9} className="text-success" /> : <WifiOff size={9} className="text-warn" />}
                  {online ? 'Live workspace' : 'Offline · local'}
                </p>
              </div>
              <DemoBadge compact />
            </div>
          </div>
        )}

        <div className={cn('flex items-center gap-2 rounded-lg p-1', collapsed && 'justify-center')}>
          <Link to="/settings" aria-label="Open profile settings" className="shrink-0">
            {profile ? (
              <Avatar profile={profile} size="sm" online />
            ) : (
              <span className="block h-8 w-8 rounded-full bg-surface-3" />
            )}
          </Link>
          {!collapsed && (
            <>
              <Link to="/settings" className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-ink">{profile?.name ?? 'Loading…'}</p>
                <p className="truncate text-[10px] text-faint">{profile?.title ?? 'Workspace member'}</p>
              </Link>
              <Menu
                label="Account menu"
                items={[
                  {
                    label: 'Profile & settings',
                    icon: UserRound,
                    onClick: () => navigate('/settings'),
                  },
                  {
                    label: theme === 'dark' ? 'Light appearance' : 'Dark appearance',
                    icon: theme === 'dark' ? Sun : Moon,
                    onClick: toggleTheme,
                  },
                  {
                    label: 'Install app',
                    icon: Download,
                    onClick: async () => {
                      const result = await promptInstall()
                      if (result.outcome === 'unavailable')
                        toast.info('Install from your browser menu', 'Use “Install app” in Chrome, Edge or Safari.')
                    },
                    separator: true,
                  },
                  {
                    label: isPending ? 'Signing out…' : 'Sign out',
                    icon: LogOut,
                    danger: true,
                    disabled: isPending,
                    onClick: () => signOut(undefined, { onSuccess: () => navigate('/signin', { replace: true }) }),
                    separator: true,
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>
    </motion.aside>
  )
}

export function SettingsShortcut() {
  return (
    <Link to="/settings" className="btn btn-ghost btn-sm">
      <Settings size={13} /> Settings
    </Link>
  )
}
