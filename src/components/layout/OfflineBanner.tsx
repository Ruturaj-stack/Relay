import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CloudOff, Loader2, RefreshCw, Trash2, Wifi } from 'lucide-react'
import { useSyncStore } from '@/store/syncStore'

export function OfflineBanner() {
  const { online, pending, failed, syncing, retry, discard } = useSyncStore()
  const visible = !online || failed > 0 || syncing

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          role="region"
          aria-label="Connection status"
          className="overflow-hidden"
        >
          <div className="mx-auto max-w-[1500px] px-4 pt-3 md:px-6 lg:px-8">
            <div
              role="status"
              className={
                failed > 0
                  ? 'flex flex-col gap-2.5 rounded-[10px] border border-danger/25 bg-danger/8 px-3.5 py-2.5 text-danger sm:flex-row sm:items-center'
                  : !online
                    ? 'flex flex-col gap-2.5 rounded-[10px] border border-warn/25 bg-warn/8 px-3.5 py-2.5 text-warn sm:flex-row sm:items-center'
                    : 'flex flex-col gap-2.5 rounded-[10px] border border-info/25 bg-info/8 px-3.5 py-2.5 text-info sm:flex-row sm:items-center'
              }
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {failed > 0 ? <AlertTriangle size={14} /> : !online ? <CloudOff size={14} /> : <Loader2 size={14} className="animate-spin" />}
                </span>
                <p className="text-[11.5px] leading-relaxed">
                  {failed > 0
                    ? `${failed} offline ${failed === 1 ? 'change needs' : 'changes need'} a review before syncing. Nothing has been overwritten.`
                    : !online
                      ? `You're offline. ${pending > 0 ? `${pending} ${pending === 1 ? 'change is' : 'changes are'} saved on this device` : 'Changes will be saved on this device'} and sync automatically when you reconnect.`
                      : `Syncing ${pending} offline ${pending === 1 ? 'change' : 'changes'}…`}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
                {failed > 0 ? (
                  <>
                    <button type="button" onClick={() => void retry()} className="btn btn-sm border border-danger/25 bg-danger/10 text-danger">
                      <RefreshCw size={12} /> Retry
                    </button>
                    <button type="button" onClick={() => void discard()} className="btn btn-ghost btn-sm text-danger">
                      <Trash2 size={12} /> Discard
                    </button>
                  </>
                ) : !online ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-warn/20 px-2 py-1 font-mono text-[9px] uppercase tracking-wider">
                    <Wifi size={10} /> Offline first
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
