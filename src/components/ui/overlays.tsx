import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, Check, CheckCircle2, Info, MoreHorizontal, X, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLockBodyScroll } from '@/hooks/useViewport'
import { useAppStore } from '@/store/appStore'
import type { ToastVariant } from '@/types'

/* --------------------------------- Modal --------------------------------- */

const modalSizes = {
  sm: 'sm:max-w-[420px]',
  md: 'sm:max-w-[540px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[920px]',
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  bodyClassName,
  hideClose,
  icon: Icon,
}: {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: keyof typeof modalSizes
  className?: string
  bodyClassName?: string
  hideClose?: boolean
  icon?: LucideIcon
}) {
  const reduced = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  useLockBodyScroll(open)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, select, button:not([data-close])',
      )
      target?.focus()
    }, 80)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timer)
    }
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/65 backdrop-blur-[3px]"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 26, scale: 0.985 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={cn(
              'relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden border border-line bg-surface shadow-[var(--shadow-lift)]',
              'rounded-t-[24px] pb-[env(safe-area-inset-bottom)] sm:rounded-[var(--radius-lg)] sm:pb-0',
              modalSizes[size],
              className,
            )}
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-line-strong sm:hidden" />
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
                <div className="flex min-w-0 items-start gap-3">
                  {Icon && (
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-accent">
                      <Icon size={17} strokeWidth={1.7} />
                    </span>
                  )}
                  <div className="min-w-0">
                    {title && <h2 className="text-[16px] font-medium tracking-tight text-ink">{title}</h2>}
                    {description && (
                      <p className="mt-1 text-[12px] leading-relaxed text-muted">{description}</p>
                    )}
                  </div>
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    data-close
                    onClick={onClose}
                    aria-label="Close"
                    className="btn btn-ghost btn-icon btn-sm -mr-1 -mt-1 shrink-0"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
            <div className={cn('scrollbar-thin flex-1 overflow-y-auto px-5 pb-5 sm:px-6', bodyClassName)}>
              {children}
            </div>
            {footer && (
              <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface/80 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ------------------------------- Confirm --------------------------------- */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading,
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  loading?: boolean
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      icon={AlertTriangle}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cn('btn', tone === 'danger' ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Modal>
  )
}

/* --------------------------------- Menu ---------------------------------- */

export interface MenuItem {
  label: string
  icon?: LucideIcon
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  shortcut?: string
  separator?: boolean
}

export function Menu({
  items,
  trigger,
  label = 'More options',
  align = 'end',
  triggerClassName,
}: {
  items: MenuItem[]
  trigger?: ReactNode
  label?: string
  align?: 'start' | 'end'
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()

  const updatePosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const width = 196
    let left = align === 'end' ? rect.right - width : rect.left
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
    let top = rect.bottom + 6
    const estimatedHeight = items.length * 34 + 12
    if (top + estimatedHeight > window.innerHeight - 8) top = Math.max(8, rect.top - estimatedHeight - 6)
    setPosition({ top, left })
  }, [align, items.length])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onPointer = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      )
        setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, updatePosition])

  if (typeof document === 'undefined') return null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={cn('btn btn-ghost btn-icon btn-sm', triggerClassName)}
      >
        {trigger ?? <MoreHorizontal size={16} />}
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label={label}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -3 }}
              transition={{ duration: 0.14 }}
              style={{ top: position.top, left: position.left }}
              className="fixed z-[120] w-[196px] origin-top-right overflow-hidden rounded-[10px] border border-line-strong bg-surface-2 p-1 shadow-[var(--shadow-lift)]"
            >
              {items.map((item, index) => (
                <div key={item.label}>
                  {item.separator && index > 0 && <div className="my-1 h-px bg-line" />}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(false)
                      item.onClick?.()
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-left text-[12px] transition-colors',
                      item.danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-surface-3 hover:text-ink',
                      item.disabled && 'cursor-not-allowed opacity-40',
                    )}
                  >
                    {item.icon && <item.icon size={14} strokeWidth={1.7} />}
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && <span className="font-mono text-[9px] text-faint">{item.shortcut}</span>}
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

/* --------------------------------- Toasts -------------------------------- */

const toastIcons: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const toastTone: Record<ToastVariant, string> = {
  success: 'var(--success)',
  error: 'var(--danger)',
  warning: 'var(--warn)',
  info: 'var(--info)',
}

export function ToastViewport() {
  const toasts = useAppStore((state) => state.toasts)
  const dismissToast = useAppStore((state) => state.dismissToast)

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[200] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-auto sm:right-5 sm:top-5 sm:items-end sm:px-0">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = toastIcons[toast.variant]
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              role="status"
              className="pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[12px] border border-line-strong bg-surface-2/95 p-3.5 shadow-[var(--shadow-lift)] backdrop-blur-xl"
            >
              <span
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{
                  color: toastTone[toast.variant],
                  backgroundColor: `color-mix(in srgb, ${toastTone[toast.variant]} 12%, transparent)`,
                }}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium leading-snug text-ink">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{toast.description}</p>
                )}
                {toast.action && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.action?.onClick?.()
                      dismissToast(toast.id)
                    }}
                    className="mt-2 text-[11px] font-medium text-accent hover:underline"
                  >
                    {toast.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X size={13} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

/* -------------------------------- Tooltip -------------------------------- */

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-50 w-max max-w-[220px] -translate-x-1/2 rounded-md border border-line-strong bg-surface-3 px-2.5 py-1.5 text-[10.5px] leading-snug text-ink opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  )
}

/* ------------------------------ Success mark ----------------------------- */

export function SuccessMark({ size = 56 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 20 }}
      className="flex items-center justify-center rounded-full border border-success/30 bg-success/10 text-success"
      style={{ width: size, height: size }}
    >
      <Check size={size * 0.4} strokeWidth={2} />
    </motion.div>
  )
}
