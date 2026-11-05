import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ArrowRight,
  Bell,
  Command,
  CornerDownLeft,
  Download,
  LayoutDashboard,
  Moon,
  Package,
  Plus,
  ScanLine,
  Search,
  Settings,
  Sparkles,
  Sun,
  UserRound,
  Users,
  BarChart3,
  Activity,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { useLockBodyScroll } from '@/hooks/useViewport'
import { searchWorkspace } from '@/lib/selectors'
import { useWorkspace } from '@/hooks/useWorkspace'
import { useAppStore } from '@/store/appStore'
import { Badge, Kbd, StatusBadge } from '@/components/ui/primitives'

interface PaletteCommand {
  id: string
  label: string
  description?: string
  icon: LucideIcon
  group: string
  kbd?: string
  action: () => void
  tone?: 'accent' | 'neutral'
  meta?: React.ReactNode
}

export function CommandPalette() {
  const open = useAppStore((state) => state.commandOpen)
  const setOpen = useAppStore((state) => state.setCommandOpen)
  const setQuickOpen = useAppStore((state) => state.setQuickOpen)
  const setNotificationsOpen = useAppStore((state) => state.setNotificationsOpen)
  const theme = useAppStore((state) => state.theme)
  const toggleTheme = useAppStore((state) => state.toggleTheme)
  const { data } = useWorkspace()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 120)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    window.setTimeout(() => inputRef.current?.focus(), 60)
  }, [open])

  const commands = useMemo<PaletteCommand[]>(() => {
    const close = (callback: () => void) => () => {
      setOpen(false)
      callback()
    }
    const pages: PaletteCommand[] = [
      { id: 'nav-home', label: 'Overview', icon: LayoutDashboard, group: 'Jump to', action: close(() => navigate('/')) },
      { id: 'nav-handoffs', label: 'Handoffs', icon: ArrowLeftRight, group: 'Jump to', action: close(() => navigate('/handoffs')) },
      { id: 'nav-items', label: 'Items', icon: Package, group: 'Jump to', action: close(() => navigate('/items')) },
      { id: 'nav-people', label: 'People & teams', icon: Users, group: 'Jump to', action: close(() => navigate('/people')) },
      { id: 'nav-activity', label: 'Activity', icon: Activity, group: 'Jump to', action: close(() => navigate('/activity')) },
      { id: 'nav-analytics', label: 'Analytics', icon: BarChart3, group: 'Jump to', action: close(() => navigate('/analytics')) },
      { id: 'nav-scan', label: 'Scan a handoff', icon: ScanLine, group: 'Jump to', action: close(() => navigate('/scan')) },
      { id: 'nav-notifications', label: 'Notifications', icon: Bell, group: 'Jump to', action: close(() => navigate('/notifications')) },
      { id: 'nav-settings', label: 'Settings', icon: Settings, group: 'Jump to', action: close(() => navigate('/settings')) },
    ]
    const actions: PaletteCommand[] = [
      {
        id: 'action-new',
        label: 'Create a new handoff',
        description: 'Start with an item and a receiver',
        icon: Plus,
        group: 'Actions',
        kbd: 'N',
        tone: 'accent',
        action: close(() => navigate('/handoffs/new')),
      },
      {
        id: 'action-quick',
        label: 'Open quick actions',
        description: 'Receive, return, scan or report an issue',
        icon: Zap,
        group: 'Actions',
        action: close(() => setQuickOpen(true)),
      },
      {
        id: 'action-theme',
        label: theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance',
        icon: theme === 'dark' ? Sun : Moon,
        group: 'Actions',
        action: close(toggleTheme),
      },
      {
        id: 'action-notifications',
        label: 'Open notification centre',
        icon: Bell,
        group: 'Actions',
        action: close(() => setNotificationsOpen(true)),
      },
      {
        id: 'action-install',
        label: 'Install RELAY',
        description: 'Add the workspace to your device',
        icon: Download,
        group: 'Actions',
        action: close(() => {
          navigate('/settings?tab=appearance')
        }),
      },
    ]

    if (!debouncedQuery.trim()) {
      const recent = data
        ? [...data.handoffs]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3)
            .map<PaletteCommand>((handoff) => ({
              id: `recent-${handoff.id}`,
              label: `${handoff.code} · ${data.items.find((item) => item.id === handoff.itemId)?.name ?? 'Handoff'}`,
              description: handoff.description,
              icon: ArrowLeftRight,
              group: 'Recent handoffs',
              action: close(() => navigate(`/handoffs/${handoff.id}`)),
              meta: <StatusBadge status={handoff.status} />,
            }))
        : []
      return [...pages.slice(0, 6), ...recent, ...actions]
    }

    const results = data ? searchWorkspace(data, debouncedQuery) : { handoffs: [], items: [], people: [], teams: [] }
    const filteredPages = pages.filter((page) => page.label.toLowerCase().includes(debouncedQuery.toLowerCase()))
    const filteredActions = actions.filter((action) => action.label.toLowerCase().includes(debouncedQuery.toLowerCase()))
    const handoffs: PaletteCommand[] = results.handoffs.map((handoff) => ({
      id: `handoff-${handoff.id}`,
      label: `${handoff.code} · ${handoff.item.name}`,
      description: `${handoff.sender.name} → ${handoff.receiver.name}`,
      icon: ArrowLeftRight,
      group: 'Handoffs',
      action: close(() => navigate(`/handoffs/${handoff.id}`)),
      meta: <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />,
    }))
    const items: PaletteCommand[] = results.items.map((item) => ({
      id: `item-${item.id}`,
      label: item.name,
      description: `${item.category} · ${item.serial}`,
      icon: Package,
      group: 'Items',
      action: close(() => navigate(`/items/${item.id}`)),
    }))
    const people: PaletteCommand[] = results.people.map((profile) => ({
      id: `person-${profile.id}`,
      label: profile.name,
      description: profile.title,
      icon: UserRound,
      group: 'People',
      action: close(() => navigate(`/people?person=${profile.id}`)),
    }))
    const teams: PaletteCommand[] = results.teams.map((team) => ({
      id: `team-${team.id}`,
      label: team.name,
      description: team.description,
      icon: Users,
      group: 'Teams',
      action: close(() => navigate(`/people/${team.id}`)),
    }))
    return [...filteredPages, ...filteredActions, ...handoffs, ...items, ...people, ...teams]
  }, [data, debouncedQuery, navigate, setNotificationsOpen, setOpen, setQuickOpen, theme, toggleTheme])

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, commands.length - 1)))
  }, [commands.length])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActive((index) => (commands.length ? (index + 1) % commands.length : 0))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActive((index) => (commands.length ? (index - 1 + commands.length) % commands.length : 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        commands[active]?.action()
      } else if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, commands, active, setOpen])

  useEffect(() => {
    const element = listRef.current?.querySelector<HTMLElement>(`[data-command-index="${active}"]`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const groups = useMemo(() => {
    const map = new Map<string, Array<{ command: PaletteCommand; index: number }>>()
    commands.forEach((command, index) => {
      const list = map.get(command.group) ?? []
      list.push({ command, index })
      map.set(command.group, list)
    })
    return [...map.entries()]
  }, [commands])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[150] flex items-start justify-center px-3 pt-[10vh] sm:px-6 sm:pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[3px]"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 430, damping: 34 }}
            className="relative z-10 w-full max-w-[620px] overflow-hidden rounded-[14px] border border-line-strong bg-surface shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={17} className="text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                placeholder="Search handoffs, items, people or actions…"
                aria-label="Search workspace"
                className="h-[54px] flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
              />
              <div className="flex items-center gap-1">
                <Kbd>esc</Kbd>
              </div>
            </div>

            <div ref={listRef} className="scrollbar-thin max-h-[min(56vh,430px)] overflow-y-auto p-2">
              {groups.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-faint">
                    <Command size={17} />
                  </div>
                  <p className="text-[13px] font-medium text-ink">No results for “{debouncedQuery}”</p>
                  <p className="mt-1 max-w-[280px] text-[11.5px] leading-relaxed text-faint">
                    Try a handoff code, item name, person, or a command like “new handoff”.
                  </p>
                </div>
              ) : (
                groups.map(([group, entries]) => (
                  <div key={group} className="mb-1.5 last:mb-0">
                    <p className="px-2.5 pb-1.5 pt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">{group}</p>
                    {entries.map(({ command, index }) => {
                      const Icon = command.icon
                      return (
                        <button
                          key={command.id}
                          type="button"
                          data-command-index={index}
                          onMouseEnter={() => setActive(index)}
                          onClick={command.action}
                          className={`relative flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2.5 text-left transition-colors ${
                            active === index ? 'bg-surface-3' : 'hover:bg-surface-2'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border ${
                              active === index
                                ? 'border-accent/25 bg-accent-soft text-accent'
                                : 'border-line bg-surface-2 text-faint'
                            }`}
                          >
                            <Icon size={14} strokeWidth={1.8} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[12.5px] font-medium text-ink">{command.label}</span>
                            {command.description && (
                              <span className="mt-0.5 block truncate text-[10.5px] text-faint">{command.description}</span>
                            )}
                          </span>
                          {command.meta}
                          {command.kbd && <Kbd>{command.kbd}</Kbd>}
                          {active === index && <ArrowRight size={12} className="text-accent" />}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-line bg-surface-2/50 px-4 py-2.5">
              <div className="flex items-center gap-3 text-[9.5px] text-faint">
                <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
                <span className="flex items-center gap-1"><CornerDownLeft size={10} /> open</span>
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-faint">
                <Sparkles size={10} className="text-accent" /> RELAY search
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function QuickActionBadge() {
  return <Badge tone="accent">Quick</Badge>
}
