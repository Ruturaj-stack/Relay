import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ChevronRight,
  Download,
  LayoutDashboard,
  LogOut,
  Moon,
  Package,
  ScanLine,
  Sun,
  Zap,
} from 'lucide-react'
import { mobileNavItems, moreNavItems } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { getCurrentProfile } from '@/lib/selectors'
import { useInstallPrompt } from '@/hooks/useViewport'
import { useSignOut, useWorkspace } from '@/hooks/useWorkspace'
import { useAppStore, toast } from '@/store/appStore'
import { Avatar, DemoBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlays'

const itemIcons = {
  Home: LayoutDashboard,
  Handoffs: ArrowLeftRight,
  Scan: ScanLine,
  Items: Package,
}

export function MobileNav() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const setQuickOpen = useAppStore((state) => state.setQuickOpen)

  return (
    <>
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[var(--bg)]/92 backdrop-blur-xl md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid h-[62px] max-w-[520px] grid-cols-5 items-center px-2">
          {mobileNavItems.map((item) => {
            const Icon = itemIcons[item.label as keyof typeof itemIcons] ?? item.icon
            const active = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)
            if (item.primary) {
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="relative flex h-full flex-col items-center justify-end pb-2"
                  aria-label="Scan a handoff QR"
                >
                  <span
                    className={cn(
                      'absolute -top-5 flex h-[52px] w-[52px] items-center justify-center rounded-full border-[4px] border-[var(--bg)] bg-accent text-accent-ink shadow-[0_10px_30px_-10px_rgba(216,243,108,0.55)] transition-transform active:scale-95',
                      active && 'ring-1 ring-accent/40',
                    )}
                  >
                    <Icon size={22} strokeWidth={1.9} />
                  </span>
                  <span className={cn('mt-1 text-[9.5px] font-medium', active ? 'text-accent' : 'text-faint')}>
                    {item.label}
                  </span>
                </Link>
              )
            }
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative flex h-full flex-col items-center justify-center gap-1"
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={active ? 2 : 1.7} className={active ? 'text-accent' : 'text-faint'} />
                <span className={cn('text-[9.5px] font-medium', active ? 'text-ink' : 'text-faint')}>{item.label}</span>
                {active && (
                  <motion.span
                    layoutId="mobile-nav-dot"
                    className="absolute bottom-1 h-0.5 w-4 rounded-full bg-accent"
                  />
                )}
              </Link>
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex h-full flex-col items-center justify-center gap-1"
            aria-label="More navigation"
          >
            <span className="flex gap-1">
              <span className="h-[3px] w-[3px] rounded-full bg-faint" />
              <span className="h-[3px] w-[3px] rounded-full bg-faint" />
              <span className="h-[3px] w-[3px] rounded-full bg-faint" />
            </span>
            <span className="text-[9.5px] font-medium text-faint">More</span>
          </button>
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onQuickActions={() => {
          setMoreOpen(false)
          setQuickOpen(true)
        }}
      />
    </>
  )
}

function MoreSheet({
  open,
  onClose,
  onQuickActions,
}: {
  open: boolean
  onClose: () => void
  onQuickActions: () => void
}) {
  const { data } = useWorkspace()
  const profile = data ? getCurrentProfile(data) : undefined
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const { canInstall, promptInstall } = useInstallPrompt()
  const { mutate: signOut, isPending } = useSignOut()
  const navigate = useNavigate()

  return (
    <Modal open={open} onClose={onClose} title="Menu" description="Everything else, one tap away." size="sm">
      <div className="space-y-5 pb-2">
        <button
          type="button"
          onClick={() => {
            onClose()
            navigate('/settings')
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-3 text-left"
        >
          {profile && <Avatar profile={profile} size="md" online />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{profile?.name}</p>
            <p className="truncate text-[11px] text-faint">{profile?.title}</p>
          </div>
          <ChevronRight size={16} className="text-faint" />
        </button>

        <button
          type="button"
          onClick={onQuickActions}
          className="flex w-full items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft p-3 text-left"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-ink">
            <Zap size={16} />
          </span>
          <span className="flex-1">
            <span className="block text-[12.5px] font-medium text-ink">Quick actions</span>
            <span className="mt-0.5 block text-[10.5px] text-muted">Scan, receive, return or report an issue</span>
          </span>
          <ChevronRight size={16} className="text-accent" />
        </button>

        <div className="overflow-hidden rounded-xl border border-line">
          {moreNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className="focusable-row flex items-center gap-3 border-b border-line px-3.5 py-3 last:border-b-0"
            >
              <item.icon size={16} className="text-faint" />
              <span className="flex-1 text-[12.5px] text-muted">{item.label}</span>
              <ChevronRight size={14} className="text-faint" />
            </Link>
          ))}
        </div>

        <div className="space-y-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="focusable-row flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
          >
            {theme === 'dark' ? <Sun size={16} className="text-faint" /> : <Moon size={16} className="text-faint" />}
            <span className="flex-1 text-[12.5px] text-muted">{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              const result = await promptInstall()
              if (result.outcome === 'unavailable')
                toast.info('Use your browser’s install option', 'Chrome/Edge: menu → Install app. Safari: Share → Add to Home Screen.')
            }}
            className="focusable-row flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
          >
            <Download size={16} className="text-faint" />
            <span className="flex-1 text-[12.5px] text-muted">{canInstall ? 'Install RELAY' : 'Add to home screen'}</span>
            <DemoBadge compact />
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              onClose()
              signOut(undefined, { onSuccess: () => navigate('/signin', { replace: true }) })
            }}
            className="focusable-row flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-danger"
          >
            <LogOut size={16} />
            <span className="text-[12.5px]">{isPending ? 'Signing out…' : 'Sign out'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-faint">RELAY · v1.0</span>
          <DemoBadge />
        </div>
      </div>
    </Modal>
  )
}
