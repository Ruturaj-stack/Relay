import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppNotificationPreferences, Theme, ToastItem, ToastVariant } from '@/types'
import { uid } from '@/lib/utils'

interface AppState {
  theme: Theme
  sidebarCollapsed: boolean
  commandOpen: boolean
  notificationsOpen: boolean
  quickOpen: boolean
  mobileMenuOpen: boolean
  toasts: ToastItem[]
  prefs: AppNotificationPreferences
  installDismissed: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setCommandOpen: (open: boolean) => void
  setNotificationsOpen: (open: boolean) => void
  setQuickOpen: (open: boolean) => void
  setMobileMenuOpen: (open: boolean) => void
  pushToast: (toast: Omit<ToastItem, 'id'>) => string
  dismissToast: (id: string) => void
  updatePrefs: (prefs: Partial<AppNotificationPreferences>) => void
  dismissInstall: () => void
}

const defaultPrefs: AppNotificationPreferences = {
  handoffRequests: true,
  confirmations: true,
  returnReminders: true,
  overdue: true,
  teamActivity: true,
  emailDigest: false,
  pushEnabled: false,
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('light', theme === 'light')
  try {
    localStorage.setItem('relay.theme', theme)
  } catch {
    // Theme is still applied for this session.
  }
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f1e9' : '#08090b')
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      commandOpen: false,
      notificationsOpen: false,
      quickOpen: false,
      mobileMenuOpen: false,
      toasts: [],
      prefs: defaultPrefs,
      installDismissed: false,
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        applyTheme(next)
        set({ theme: next })
      },
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
      setQuickOpen: (quickOpen) => set({ quickOpen }),
      setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
      pushToast: (toast) => {
        const id = uid('toast')
        set({ toasts: [...get().toasts, { ...toast, id }] })
        const duration = toast.variant === 'error' ? 6500 : 4500
        window.setTimeout(() => {
          set({ toasts: get().toasts.filter((entry) => entry.id !== id) })
        }, duration)
        return id
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((entry) => entry.id !== id) }),
      updatePrefs: (prefs) => set({ prefs: { ...get().prefs, ...prefs } }),
      dismissInstall: () => set({ installDismissed: true }),
    }),
    {
      name: 'relay-app',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        prefs: state.prefs,
        installDismissed: state.installDismissed,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) applyTheme(state.theme)
      },
    },
  ),
)

export const toast = {
  success: (title: string, description?: string, action?: ToastItem['action']) =>
    useAppStore.getState().pushToast({ title, description, variant: 'success' as ToastVariant, action }),
  error: (title: string, description?: string) =>
    useAppStore.getState().pushToast({ title, description, variant: 'error' }),
  info: (title: string, description?: string) =>
    useAppStore.getState().pushToast({ title, description, variant: 'info' }),
  warning: (title: string, description?: string) =>
    useAppStore.getState().pushToast({ title, description, variant: 'warning' }),
}

export function initTheme() {
  const root = document.documentElement
  const stored = root.dataset.theme as Theme | undefined
  const theme = stored === 'light' ? 'light' : 'dark'
  applyTheme(theme)
  useAppStore.setState({ theme })
}
