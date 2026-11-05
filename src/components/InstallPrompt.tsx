import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useViewport'
import { useAppStore } from '@/store/appStore'
import { BrandMark } from '@/components/ui/primitives'

export function InstallPrompt() {
  const { canInstall, promptInstall } = useInstallPrompt()
  const dismissed = useAppStore((state) => state.installDismissed)
  const dismiss = useAppStore((state) => state.dismissInstall)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!canInstall || dismissed) return
    const timer = window.setTimeout(() => setVisible(true), 3500)
    return () => window.clearTimeout(timer)
  }, [canInstall, dismissed])

  if (!canInstall || dismissed) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          className="fixed bottom-[calc(78px+env(safe-area-inset-bottom))] left-3 right-3 z-[70] mx-auto max-w-[360px] rounded-[14px] border border-line-strong bg-surface-2/95 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur-xl md:bottom-5 md:left-auto md:right-5 md:mx-0"
        >
          <div className="flex items-start gap-3">
            <BrandMark size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-ink">Install RELAY</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-faint">
                Full-screen, offline-ready and one tap from your home screen.
              </p>
              <button
                type="button"
                onClick={async () => {
                  await promptInstall()
                  setVisible(false)
                }}
                className="btn btn-primary btn-sm mt-2.5"
              >
                <Download size={12} /> Install app
              </button>
            </div>
            <button
              type="button"
              aria-label="Dismiss install prompt"
              onClick={() => {
                setVisible(false)
                dismiss()
              }}
              className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-surface-3 hover:text-ink"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
