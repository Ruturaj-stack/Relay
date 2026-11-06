import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  CloudOff,
  Command,
  Loader2,
  Moon,
  Search,
  Sun,
  Wifi,
} from 'lucide-react'
import { navItems } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { getCurrentProfile, notificationList } from '@/lib/selectors'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useSyncStore } from '@/store/syncStore'
import { useAppStore } from '@/store/appStore'
import { Avatar, Kbd, Wordmark } from '@/components/ui/primitives'

function titleForPath(pathname: string) {
  if (pathname === '/') return 'Overview'
  if (pathname === '/handoffs/new') return 'New handoff'
  if (pathname.startsWith('/handoffs/')) return 'Handoff detail'
  if (pathname.startsWith('/items/')) return 'Item detail'
  if (pathname.startsWith('/people/')) return 'Team'
  const item = navItems.find((entry) => entry.path !== '/' && pathname.startsWith(entry.path))
  return item?.label ?? 'Workspace'
}

export function Header() {
  const { pathname } = useLocation()
  const { data } = useWorkspace()
  const profile = data ? getCurrentProfile(data) : undefined
  const unread = data ? notificationList(data).filter((item) => !item.read).length : 0
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const setCommandOpen = useAppStore((state) => state.setCommandOpen)
  const setNotificationsOpen = useAppStore((state) => state.setNotificationsOpen)
  const { online, pending, syncing } = useSyncStore()

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[var(--bg)]/82 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6 lg:px-8">
        <Link to="/" className="md:hidden" aria-label="RELAY home">
          <Wordmark />
        </Link>

        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
            {data?.organization.name ?? 'Workspace'}
          </span>
          <span className="text-faint">/</span>
          <span className="truncate text-[12px] font-medium text-muted">{titleForPath(pathname)}</span>
        </div>

        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="group hidden h-9 w-[250px] items-center gap-2.5 rounded-[8px] border border-line bg-surface-2/55 px-3 text-left transition-all hover:border-line-strong hover:bg-surface-2 xl:flex"
        >
          <Search size={14} className="text-faint transition-colors group-hover:text-muted" />
          <span className="flex-1 text-[11.5px] text-faint">Search or jump to…</span>
          <span className="flex items-center gap-1">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            aria-label="Search"
            className="btn btn-ghost btn-icon xl:hidden"
          >
            <Search size={18} />
          </button>

          <span
            className={cn(
              'hidden items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] lg:inline-flex',
              !online
                ? 'border-warn/25 bg-warn/8 text-warn'
                : pending > 0
                  ? 'border-info/25 bg-info/8 text-info'
                  : 'border-line bg-surface-2/50 text-faint',
            )}
            title={online ? 'Workspace connection is live' : 'Changes are being saved on this device'}
          >
            {!online ? (
              <CloudOff size={10} />
            ) : pending > 0 || syncing ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              <Wifi size={10} className="text-success" />
            )}
            {!online ? 'Offline' : syncing ? 'Syncing' : pending > 0 ? `${pending} queued` : 'Synced'}
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="btn btn-ghost btn-icon hidden sm:flex"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            type="button"
            onClick={() => setNotificationsOpen(true)}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
            className="btn btn-ghost btn-icon relative"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-[7px] top-[7px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full border-2 border-[var(--bg)] bg-accent px-[3px] font-mono text-[8px] font-medium leading-none text-accent-ink">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          <Link to="/settings" className="ml-0.5">
            {profile ? (
              <Avatar profile={profile} size="sm" />
            ) : (
              <span className="block h-8 w-8 rounded-full bg-surface-3" />
            )}
            <span className="sr-only">Open profile</span>
          </Link>

          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="btn btn-ghost btn-icon hidden"
            aria-hidden="true"
            tabIndex={-1}
          >
            <Command size={16} />
          </button>
        </div>
      </div>
    </header>
  )
}
