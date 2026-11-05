import { Suspense, useEffect, useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useMediaQuery } from '@/hooks/useViewport'
import { useAppStore } from '@/store/appStore'
import { useSyncStore } from '@/store/syncStore'
import { Sidebar, SIDEBAR_WIDTH } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { MobileNav } from '@/components/layout/MobileNav'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { NotificationsPanel } from '@/components/layout/NotificationsPanel'
import { CommandPalette } from '@/components/CommandPalette'
import { QuickActionsSheet } from '@/components/QuickActions'
import { ToastViewport } from '@/components/ui/overlays'
import { InstallPrompt } from '@/components/InstallPrompt'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = useAppStore((state) => state.sidebarCollapsed)
  const setCollapsed = useAppStore((state) => state.setSidebarCollapsed)
  const setCommandOpen = useAppStore((state) => state.setCommandOpen)
  const commandOpen = useAppStore((state) => state.commandOpen)
  const initializeSync = useSyncStore((state) => state.initialize)
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1099px)')
  const isDesktop = useMediaQuery('(min-width: 1100px)')
  const adjustedTablet = useRef(false)

  useEffect(() => {
    initializeSync()
  }, [initializeSync])

  useEffect(() => {
    if (isTablet && !adjustedTablet.current) {
      adjustedTablet.current = true
      setCollapsed(true)
    }
  }, [isTablet, setCollapsed])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(!commandOpen)
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() === 'n' && !commandOpen) {
        const anyModal = document.querySelector('[role="dialog"]')
        if (anyModal) return
        event.preventDefault()
        navigate('/handoffs/new')
      }
      if (event.key === '/') {
        event.preventDefault()
        setCommandOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commandOpen, navigate, setCommandOpen])

  const sidebarWidth = isDesktop ? (collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded) : SIDEBAR_WIDTH.collapsed

  return (
    <div className="relative min-h-dvh bg-bg">
      <div className="ambient-glow -left-[20vw] -top-[25vw]" />
      <Sidebar />
      <div
        className="min-h-dvh transition-[margin] duration-300 md:ml-[var(--sidebar-w)]"
        style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
      >
        <Header />
        <OfflineBanner />
        <main className="pb-nav mx-auto w-full max-w-[1500px] px-4 py-5 md:px-6 md:pb-12 md:py-7 lg:px-8">
          <ErrorBoundary>
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 7 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<RouteSkeleton />}>
                <Outlet />
              </Suspense>
            </motion.div>
          </ErrorBoundary>
        </main>
      </div>
      <MobileNav />
      <NotificationsPanel />
      <QuickActionsSheet />
      <CommandPalette />
      <ToastViewport />
      <InstallPrompt />
      <div className="app-noise" />
    </div>
  )
}

function RouteSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="space-y-5">
      <div className="space-y-2">
        <div className="skeleton h-3 w-24 rounded-full" />
        <div className="skeleton h-8 w-64 max-w-full rounded-lg" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="skeleton h-[104px] rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="skeleton h-[340px] rounded-[var(--radius-lg)]" />
    </div>
  )
}
