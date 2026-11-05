import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Copy, Loader2, Package, type LucideIcon } from 'lucide-react'
import type { HandoffStatus, ItemCondition, Profile, ReturnRisk } from '@/types'
import {
  CONDITION_META,
  HANDOFF_STATUS,
  cn,
  getDisplayStatus,
  initials,
  toneStyle,
  type Tone,
} from '@/lib/utils'

/* --------------------------------- Brand --------------------------------- */

export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M10.5 23V9.5h6.2a4.7 4.7 0 0 1 0 9.4h-3.2l6.2 4.1"
        stroke="var(--accent-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.4" cy="10.4" r="1.5" fill="var(--accent-ink)" />
    </svg>
  )
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark size={compact ? 28 : 32} />
      {!compact && (
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.28em] text-ink">Relay</span>
          <span className="mb-0.5 h-1 w-1 rounded-full bg-accent" />
        </div>
      )}
    </div>
  )
}

/* -------------------------------- Buttons -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: LucideIcon
  iconRight?: LucideIcon
  fullWidth?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  disabled,
  fullWidth,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'btn',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        size === 'sm' && 'btn-sm',
        size === 'lg' && 'btn-lg',
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} strokeWidth={1.8} /> : null}
      {children}
      {IconRight && !loading ? <IconRight size={15} strokeWidth={1.8} /> : null}
    </button>
  )
}

export function IconButton({
  label,
  icon: Icon,
  className,
  variant = 'ghost',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon; variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'btn btn-icon',
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        className,
      )}
      {...props}
    >
      <Icon size={17} strokeWidth={1.7} />
    </button>
  )
}

/* --------------------------------- Avatar -------------------------------- */

const avatarSizes = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-[12px]',
  lg: 'h-14 w-14 text-[16px]',
  xl: 'h-20 w-20 text-[22px]',
}

export function Avatar({
  profile,
  size = 'md',
  className,
  online,
  ring,
}: {
  profile: Pick<Profile, 'name' | 'accent' | 'avatar'> | { name: string; accent?: string; avatar?: string }
  size?: keyof typeof avatarSizes
  className?: string
  online?: boolean
  ring?: boolean
}) {
  const accent = profile.accent ?? 'var(--accent)'
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <span
        className={cn(
          'inline-flex select-none items-center justify-center overflow-hidden rounded-full font-medium tracking-tight',
          avatarSizes[size],
          ring && 'ring-2 ring-[var(--bg)]',
        )}
        style={{
          backgroundColor: `color-mix(in srgb, ${accent} 17%, var(--surface-3))`,
          color: accent,
          border: `1px solid color-mix(in srgb, ${accent} 24%, transparent)`,
        }}
        title={profile.name}
      >
        {profile.avatar ? (
          <img src={profile.avatar} alt={profile.name} className="h-full w-full object-cover" />
        ) : (
          initials(profile.name)
        )}
      </span>
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg)] bg-success"
          aria-label="Online"
        />
      )}
    </span>
  )
}

export function AvatarStack({
  profiles,
  max = 4,
  size = 'sm',
}: {
  profiles: Array<Pick<Profile, 'id' | 'name' | 'accent' | 'avatar'>>
  max?: number
  size?: keyof typeof avatarSizes
}) {
  const shown = profiles.slice(0, max)
  const rest = profiles.length - shown.length
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((profile) => (
          <Avatar key={profile.id} profile={profile} size={size} ring />
        ))}
      </div>
      {rest > 0 && (
        <span className="ml-2 font-mono text-[10px] text-faint">+{rest}</span>
      )}
    </div>
  )
}

/* --------------------------------- Badges -------------------------------- */

export function Badge({
  tone = 'neutral',
  children,
  dot,
  className,
  style,
}: {
  tone?: Tone
  children: ReactNode
  dot?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span className={cn('badge', className)} style={{ ...toneStyle(tone), ...style }}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

export function StatusBadge({
  status,
  overdue,
  size = 'sm',
  className,
}: {
  status: HandoffStatus
  overdue?: boolean
  size?: 'sm' | 'md'
  className?: string
}) {
  const meta = overdue ? getDisplayStatus({ status } as never, true) : { ...HANDOFF_STATUS[status], key: status }
  const shouldPulse = meta.key === 'requested' || meta.key === 'overdue' || meta.key === 'awaiting_confirmation'
  return (
    <span
      className={cn('badge', size === 'md' && 'h-6 px-2.5 text-[11px]', className)}
      style={toneStyle(meta.tone)}
    >
      <span className={cn('badge-dot', shouldPulse && 'animate-pulse')} />
      {meta.label}
    </span>
  )
}

export function ConditionPill({ condition, showDot = true }: { condition: ItemCondition; showDot?: boolean }) {
  const meta = CONDITION_META[condition]
  return (
    <Badge tone={meta.tone} dot={showDot}>
      {meta.label}
    </Badge>
  )
}

export function RiskPill({ risk, compact }: { risk: ReturnRisk; compact?: boolean }) {
  const tone: Tone = risk.level === 'high' ? 'danger' : risk.level === 'medium' ? 'warn' : 'success'
  return (
    <span className="inline-flex items-center gap-1.5" title={risk.detail}>
      <Badge tone={tone} dot>
        {compact ? `Est. ${risk.level}` : `Est. ${risk.level} risk`}
      </Badge>
      {!compact && <span className="font-mono text-[10px] text-faint">{risk.score}%</span>}
    </span>
  )
}

/* ------------------------------- Empty state ------------------------------ */

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-line-strong/70 bg-surface/40 text-center',
        compact ? 'px-6 py-9' : 'px-6 py-16',
        className,
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
        <Icon size={19} strokeWidth={1.6} />
      </div>
      <h3 className="text-[14px] font-medium text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-[340px] text-[12.5px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* -------------------------------- Skeleton -------------------------------- */

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden="true" />
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
      </div>
    </div>
  )
}

/* -------------------------------- CountUp --------------------------------- */

export function CountUp({
  value,
  duration = 700,
  format = (value) => Math.round(value).toLocaleString('en-US'),
  className,
}: {
  value: number
  duration?: number
  format?: (value: number) => string
  className?: string
}) {
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      previous.current = value
      return
    }
    const from = previous.current
    const to = value
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(from + (to - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(tick)
      else previous.current = to
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, duration, reduced])

  return <span className={cn('tabular', className)}>{format(display)}</span>
}

/* ---------------------------- Image fallback ------------------------------ */

export function ImageWithFallback({
  src,
  alt,
  className,
  iconSize = 20,
}: {
  src?: string
  alt: string
  className?: string
  iconSize?: number
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-[linear-gradient(135deg,var(--surface-3),var(--surface-2))] text-faint',
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <Package size={iconSize} strokeWidth={1.4} />
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn('object-cover', className)}
      onError={() => setFailed(true)}
    />
  )
}

/* -------------------------------- Copy ----------------------------------- */

export function CopyButton({ value, label = 'Copy', className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={cn('btn btn-ghost btn-sm', className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1600)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

/* ------------------------------- Progress -------------------------------- */

export function ProgressBar({ value, tone = 'accent', className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-3', className)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full"
        style={{ backgroundColor: `var(--${tone === 'neutral' ? 'muted' : tone})` }}
      />
    </div>
  )
}

export function ProgressRing({
  value,
  size = 88,
  stroke = 5,
  tone = 'accent',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: Tone
  children?: ReactNode
}) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--surface-3)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`var(--${tone === 'neutral' ? 'muted' : tone})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}

/* ------------------------------ Misc bits -------------------------------- */

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>
}

export function SectionLabel({ children, trailing }: { children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="eyebrow">{children}</span>
      {trailing}
    </div>
  )
}

export function DemoBadge({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/70 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
      <span className="h-1 w-1 rounded-full bg-accent" />
      {compact ? 'Demo' : 'Demo workspace'}
    </span>
  )
}
