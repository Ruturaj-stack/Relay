import { create } from 'zustand'
import { listOperations } from '@/lib/offline'
import { toast } from '@/store/appStore'
import { discardFailedOperations, retryFailedOperations, syncOfflineQueue } from '@/services/sync'

interface SyncState {
  initialized: boolean
  online: boolean
  pending: number
  failed: number
  syncing: boolean
  lastSyncedAt: string | null
  initialize: () => void
  refresh: () => Promise<void>
  sync: () => Promise<void>
  retry: () => Promise<void>
  discard: () => Promise<void>
}

let timer: number | null = null
let attached = false

export const useSyncStore = create<SyncState>()((set, get) => ({
  initialized: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  pending: 0,
  failed: 0,
  syncing: false,
  lastSyncedAt: null,
  initialize: () => {
    if (get().initialized) return
    set({ initialized: true, online: navigator.onLine })
    void get().refresh()

    if (!attached) {
      attached = true
      window.addEventListener('online', () => {
        set({ online: true })
        void get().sync()
      })
      window.addEventListener('offline', () => {
        set({ online: false })
        void get().refresh()
      })
      window.addEventListener('relay:queue', () => {
        void get().refresh()
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) void get().refresh()
      })
      timer = window.setInterval(() => {
        if (navigator.onLine && (get().pending > 0 || get().failed > 0)) void get().sync()
      }, 30_000)
      window.addEventListener('beforeunload', () => {
        if (timer) window.clearInterval(timer)
      })
    }
  },
  refresh: async () => {
    const operations = await listOperations()
    set({
      pending: operations.filter((operation) => operation.status === 'pending' || operation.status === 'syncing').length,
      failed: operations.filter((operation) => operation.status === 'failed').length,
      online: navigator.onLine,
    })
  },
  sync: async () => {
    if (!navigator.onLine || get().syncing) return
    const operations = await listOperations()
    if (!operations.length) {
      set({ pending: 0, failed: 0 })
      return
    }
    set({ syncing: true })
    try {
      const result = await syncOfflineQueue()
      set({ syncing: false, lastSyncedAt: new Date().toISOString() })
      await get().refresh()
      if (result.synced > 0) {
        toast.success(
          `${result.synced} offline ${result.synced === 1 ? 'change' : 'changes'} synced`,
          'Your device is up to date with the workspace.',
        )
      }
      if (result.conflicts > 0 || result.failed > 0) {
        toast.warning(
          'Some changes need a review',
          'A handoff changed before an offline edit could sync. Open the sync banner to retry or discard.',
        )
      }
    } catch {
      set({ syncing: false })
      toast.error('Sync could not finish', 'Your changes are safe on this device. RELAY will retry automatically.')
    }
  },
  retry: async () => {
    await retryFailedOperations()
    await get().sync()
  },
  discard: async () => {
    await discardFailedOperations()
    await get().refresh()
  },
}))
