import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  count?: number
  icon?: React.ComponentType<{ size?: number; className?: string }>
}

export function Tabs({
  items,
  value,
  onChange,
  variant = 'underline',
  className,
}: {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
  variant?: 'underline' | 'pill'
  className?: string
}) {
  const id = useId()
  return (
    <div
      role="tablist"
      aria-label="View filter"
      className={cn(
        'scrollbar-none flex items-center gap-1 overflow-x-auto',
        variant === 'underline' ? 'border-b border-line' : 'rounded-[10px] border border-line bg-surface-2/60 p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value
        const Icon = item.icon
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative flex h-9 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-[12.5px] font-medium transition-colors',
              variant === 'underline'
                ? active
                  ? 'text-ink'
                  : 'text-muted hover:text-ink'
                : cn(
                    'rounded-[7px]',
                    active ? 'text-ink' : 'text-muted hover:text-ink',
                  ),
            )}
          >
            {active && variant === 'underline' && (
              <motion.span
                layoutId={`tab-underline-${id}`}
                className="absolute inset-x-2 -bottom-px h-[1.5px] rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
              />
            )}
            {active && variant === 'pill' && (
              <motion.span
                layoutId={`tab-pill-${id}`}
                className="absolute inset-0 rounded-[7px] border border-line-strong bg-surface-3"
                transition={{ type: 'spring', stiffness: 480, damping: 36 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {Icon && <Icon size={13} />}
              {item.label}
              {item.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 font-mono text-[9px] leading-none',
                    active ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-faint',
                  )}
                >
                  {item.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: Array<{ value: T; label: string; icon?: React.ComponentType<{ size?: number }> }>
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  const id = useId()
  return (
    <div
      className={cn('inline-flex items-center rounded-[8px] border border-line bg-surface-2/60 p-0.5', className)}
      role="group"
    >
      {options.map((option) => {
        const active = value === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-[12px]',
              active ? 'text-ink' : 'text-faint hover:text-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segment-${id}`}
                className="absolute inset-0 rounded-[6px] border border-line-strong bg-surface-3"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon size={13} />}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
