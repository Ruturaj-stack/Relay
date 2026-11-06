import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useCurrentUser } from '@/hooks/useWorkspace'
import { AppShell } from '@/components/layout/AppShell'
import { BrandMark } from '@/components/ui/primitives'

const OverviewPage = lazy(() => import('@/pages/Overview').then((m) => ({ default: m.OverviewPage })))
const HandoffsPage = lazy(() => import('@/pages/Handoffs').then((m) => ({ default: m.HandoffsPage })))
const HandoffDetailPage = lazy(() => import('@/pages/HandoffDetail').then((m) => ({ default: m.HandoffDetailPage })))
const NewHandoffPage = lazy(() => import('@/pages/NewHandoff').then((m) => ({ default: m.NewHandoffPage })))
const ItemsPage = lazy(() => import('@/pages/Items').then((m) => ({ default: m.ItemsPage })))
const ItemDetailPage = lazy(() => import('@/pages/ItemDetail').then((m) => ({ default: m.ItemDetailPage })))
const PeoplePage = lazy(() => import('@/pages/People').then((m) => ({ default: m.PeoplePage })))
const TeamDetailPage = lazy(() => import('@/pages/TeamDetail').then((m) => ({ default: m.TeamDetailPage })))
const ActivityPage = lazy(() => import('@/pages/Activity').then((m) => ({ default: m.ActivityPage })))
const AnalyticsPage = lazy(() => import('@/pages/Analytics').then((m) => ({ default: m.AnalyticsPage })))
const NotificationsPage = lazy(() => import('@/pages/Notifications').then((m) => ({ default: m.NotificationsPage })))
const SettingsPage = lazy(() => import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })))
const ScanPage = lazy(() => import('@/pages/Scan').then((m) => ({ default: m.ScanPage })))
const SignInPage = lazy(() => import('@/pages/SignIn').then((m) => ({ default: m.SignInPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      retry: 1,
      // The demo adapter reads from local storage, so offline is a supported
      // state rather than a pause. The hosted adapter can override this.
      networkMode: 'always',
    },
    mutations: {
      retry: 0,
      networkMode: 'always',
    },
  },
})

function BootScreen({ label = 'Opening workspace' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <BrandMark size={44} />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-faint">{label}</span>
    </div>
  )
}

function AuthGate() {
  const { user, isLoading } = useCurrentUser()
  const location = useLocation()

  if (isLoading) return <BootScreen />

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/signin"
            element={
              <Suspense fallback={<BootScreen label="Loading sign in" />}>
                <SignInPage />
              </Suspense>
            }
          />
          <Route element={<AuthGate />}>
            <Route element={<AppShell />}>
              <Route index element={<OverviewPage />} />
              <Route path="handoffs" element={<HandoffsPage />} />
              <Route path="handoffs/new" element={<NewHandoffPage />} />
              <Route path="handoffs/:handoffId" element={<HandoffDetailPage />} />
              <Route path="items" element={<ItemsPage />} />
              <Route path="items/:itemId" element={<ItemDetailPage />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="people/:teamId" element={<TeamDetailPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="scan" element={<ScanPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
