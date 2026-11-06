import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
  compact,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-4', compact ? 'mb-5' : 'mb-6 sm:mb-8', className)}>
      {back && (
        <Link
          to={back.to}
          className="tap-link -mb-1 inline-flex w-fit items-center gap-1.5 text-[11.5px] font-medium text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft size={14} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <div className="mb-2.5 flex flex-wrap items-center gap-2">{eyebrow}</div>}
          <h1 className="text-[25px] font-medium leading-[1.15] tracking-[-0.035em] text-ink sm:text-[30px] lg:text-[32px]">
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-relaxed text-muted sm:text-[13px]">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
