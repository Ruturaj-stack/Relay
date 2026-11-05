import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Compass, ScanLine } from 'lucide-react'
import { BrandMark, Button, DemoBadge } from '@/components/ui/primitives'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[520px] text-center"
      >
        <div className="mb-5 flex justify-center">
          <BrandMark size={44} />
        </div>
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-faint">Page not found</span>
          <span className="h-3 w-px bg-line-strong" />
          <DemoBadge compact />
        </div>
        <p className="display text-[76px] leading-none tracking-[-0.05em] text-ink sm:text-[92px]">
          4<span className="italic text-accent">0</span>4
        </p>
        <h1 className="mt-3 text-[17px] font-medium tracking-tight text-ink">This handoff has no record.</h1>
        <p className="mx-auto mt-2 max-w-[360px] text-[12.5px] leading-relaxed text-muted">
          The page may have moved, or the link was mistyped. The workspace and its record are still exactly where you left
          them.
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button variant="primary" icon={ArrowLeft} onClick={() => navigate(-1)}>
            Go back
          </Button>
          <Button variant="secondary" icon={ArrowRight} onClick={() => navigate('/')}>
            Open overview
          </Button>
          <Button variant="ghost" icon={ScanLine} onClick={() => navigate('/scan')}>
            Scan a code
          </Button>
        </div>

        <div className="mt-10 grid gap-2 text-left sm:grid-cols-3">
          {[
            { to: '/handoffs', label: 'Handoffs', detail: 'Every transfer' },
            { to: '/items', label: 'Items', detail: 'Inventory' },
            { to: '/activity', label: 'Activity', detail: 'Trust record' },
          ].map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              className="focusable-row rounded-lg border border-line bg-surface px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
                <Compass size={12} className="text-faint" /> {entry.label}
              </span>
              <span className="mt-0.5 block text-[9.5px] text-faint">{entry.detail}</span>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
