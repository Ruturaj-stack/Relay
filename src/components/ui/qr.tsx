import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Download, ExternalLink, QrCode, ShieldCheck } from 'lucide-react'
import type { Handoff } from '@/types'
import { cn, handoffLink } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { CopyButton, Skeleton } from '@/components/ui/primitives'

export function useQrDataUrl(handoff: Pick<Handoff, 'code' | 'token'>, size = 560) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const value = handoffLink(handoff.code, handoff.token)
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0a0b0d', light: '#ffffff' },
    })
      .then((url) => {
        if (active) {
          setDataUrl(url)
          setError(null)
        }
      })
      .catch(() => {
        if (active) setError('Could not generate the QR code.')
      })
    return () => {
      active = false
    }
  }, [handoff.code, handoff.token, size])

  return { dataUrl, error, value: handoffLink(handoff.code, handoff.token) }
}

export function HandoffQRCard({
  handoff,
  compact,
  className,
}: {
  handoff: Pick<Handoff, 'code' | 'token' | 'photos'>
  compact?: boolean
  className?: string
}) {
  const { dataUrl, error, value } = useQrDataUrl(handoff)
  const toast = useAppStore((state) => state.pushToast)

  const download = () => {
    if (!dataUrl) return
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `relay-${handoff.code}-qr.png`
    anchor.click()
    toast({ title: 'QR code downloaded', description: 'Scan it from the receiver device to confirm the handoff.', variant: 'success' })
  }

  return (
    <div className={cn('overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <QrCode size={14} className="text-accent" />
          <span className="text-[11.5px] font-medium text-ink">Handoff QR</span>
        </div>
        <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-faint">
          <ShieldCheck size={11} className="text-success" /> Verified link
        </span>
      </div>
      <div className={cn('flex flex-col items-center', compact ? 'gap-3 p-4' : 'gap-4 p-6')}>
        <div className="relative">
          {!dataUrl && !error && <Skeleton className={compact ? 'h-[148px] w-[148px]' : 'h-[220px] w-[220px]'} />}
          {error && (
            <div
              className={cn(
                'flex items-center justify-center rounded-lg border border-danger/30 bg-danger/5 p-4 text-center text-[11px] text-danger',
                compact ? 'h-[148px] w-[148px]' : 'h-[220px] w-[220px]',
              )}
            >
              {error}
            </div>
          )}
          {dataUrl && (
            <img
              src={dataUrl}
              alt={`QR code for handoff ${handoff.code}`}
              className={cn('rounded-lg bg-white p-2', compact ? 'h-[148px] w-[148px]' : 'h-[220px] w-[220px]')}
            />
          )}
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-[10px] tracking-[0.12em] text-ink">
            {handoff.code}
          </span>
        </div>
        <div className={cn('text-center', compact ? 'mt-1' : 'mt-2')}>
          <p className="text-[11.5px] font-medium text-ink">Scan to confirm receipt</p>
          <p className="mt-1 max-w-[240px] text-[10.5px] leading-relaxed text-faint">
            The receiver scans this with RELAY. The scan is validated against the handoff before proof can be recorded.
          </p>
        </div>
        <div className="flex w-full items-center gap-2">
          <button type="button" onClick={download} disabled={!dataUrl} className="btn btn-secondary btn-sm flex-1">
            <Download size={13} /> Download
          </button>
          <CopyButton value={value} label="Copy link" className="flex-1 justify-center border border-line" />
        </div>
      </div>
    </div>
  )
}

export function QRPreviewTile({ handoff }: { handoff: Pick<Handoff, 'code' | 'token'> }) {
  const { dataUrl } = useQrDataUrl(handoff, 220)
  return (
    <div className="flex items-center gap-3">
      {dataUrl ? (
        <img src={dataUrl} alt="" className="h-10 w-10 rounded bg-white p-0.5" />
      ) : (
        <Skeleton className="h-10 w-10" />
      )}
      <div>
        <p className="font-mono text-[11px] text-ink">{handoff.code}</p>
        <p className="text-[10px] text-faint">Scan confirmation ready</p>
      </div>
      <ExternalLink size={12} className="ml-auto text-faint" />
    </div>
  )
}
