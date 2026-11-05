import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import jsQR from 'jsqr'
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  CircleHelp,
  Keyboard,
  Loader2,
  LockKeyhole,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  StopCircle,
  WifiOff,
} from 'lucide-react'
import type { HandoffView, ItemCondition } from '@/types'
import { validateHandoffCode } from '@/lib/api'
import { useConfirmReceipt, useWorkspace } from '@/hooks/useWorkspace'
import { getCurrentProfile } from '@/lib/selectors'
import {
  CONDITION_META,
  CONDITION_ORDER,
  cn,
  dueLabel,
  formatDateTime,
  parseScanValue,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  ConditionPill,
  DemoBadge,
  ImageWithFallback,
  StatusBadge,
} from '@/components/ui/primitives'
import { SelectField, SingleImageUpload, TextAreaField, TextField } from '@/components/ui/forms'
import { SuccessMark } from '@/components/ui/overlays'
import { useNetworkStatus } from '@/hooks/useViewport'

type Phase = 'idle' | 'starting' | 'scanning' | 'validating' | 'result' | 'error'

interface BarcodeDetectorLike {
  detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike
  }
}

function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera permission was blocked. Allow camera access in your browser settings, or verify the code manually.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'No camera was found on this device. You can still verify the handoff code manually.'
  if (name === 'NotReadableError')
    return 'The camera is already in use by another app. Close it and try again, or use the manual code.'
  return error instanceof Error ? error.message : 'The camera could not start. Use the manual code instead.'
}

export function ScanPage() {
  const { data } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const online = useNetworkStatus()
  const confirmReceipt = useConfirmReceipt()
  const me = data ? getCurrentProfile(data) : undefined

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const autoRan = useRef(false)

  const [phase, setPhase] = useState<Phase>('idle')
  const [manualCode, setManualCode] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanError, setScanError] = useState<{ title: string; message: string } | null>(null)
  const [result, setResult] = useState<HandoffView | null>(null)
  const [method, setMethod] = useState<'qr' | 'manual'>('manual')
  const [condition, setCondition] = useState<ItemCondition>('good')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const [confirmed, setConfirmed] = useState(false)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setPhase((current) => (current === 'scanning' || current === 'starting' ? 'idle' : current))
  }, [])

  const validate = useCallback(
    async (rawCode: string, token: string | undefined, source: 'qr' | 'manual') => {
      setScanError(null)
      setManualError(null)
      setPhase('validating')
      try {
        const handoff = await validateHandoffCode(rawCode, token)
        setResult(handoff)
        setCondition(handoff.conditionOut)
        setNote('')
        setPhoto(undefined)
        setConfirmed(false)
        setMethod(source)
        setPhase('result')
        stopCamera()
        return handoff
      } catch (error) {
        const message = error instanceof Error ? error.message : 'That code could not be verified.'
        setScanError({
          title: source === 'qr' ? 'This QR code did not verify' : 'That code did not verify',
          message,
        })
        setPhase('error')
        stopCamera()
        return null
      }
    },
    [stopCamera],
  )

  // Deep links from a QR scan open /scan?code=…&token=… and verify immediately.
  useEffect(() => {
    const code = params.get('code')
    if (!code || autoRan.current) return
    autoRan.current = true
    void validate(code, params.get('token') ?? undefined, 'qr')
  }, [params, validate])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScanError(null)
    if (!window.isSecureContext) {
      setCameraError(
        'Camera scanning needs a secure connection (https or localhost). Open RELAY over HTTPS or enter the code manually.',
      )
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser does not expose a camera API. Verify the handoff code manually instead.')
      return
    }
    setPhase('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setPhase('scanning')
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setCameraError(cameraErrorMessage(error))
      setPhase('idle')
    }
  }, [])

  // The decode loop only runs while the camera panel is scanning.
  useEffect(() => {
    if (phase !== 'scanning') return
    let cancelled = false
    let timer = 0
    const canvas = document.createElement('canvas')

    let detector: BarcodeDetectorLike | null = null
    if (window.BarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      } catch {
        detector = null
      }
    }

    const tick = async () => {
      if (cancelled) return
      const video = videoRef.current
      if (!video || video.readyState < 2 || !video.videoWidth) {
        timer = window.setTimeout(tick, 380)
        return
      }
      let raw: string | undefined
      if (detector) {
        try {
          const codes = await detector.detect(video)
          raw = codes[0]?.rawValue
        } catch {
          detector = null
        }
      }
      if (!raw && !detector) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const image = context.getImageData(0, 0, canvas.width, canvas.height)
          const decoded = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' })
          raw = decoded?.data
        }
      }
      if (raw) {
        const parsed = parseScanValue(raw)
        if (parsed) {
          cancelled = true
          await validate(parsed.code, parsed.token, 'qr')
          return
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, detector ? 280 : 420)
    }
    void tick()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [phase, validate])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const handleManual = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = parseScanValue(manualCode)
    if (!parsed) {
      setManualError('Enter a handoff code such as H-2038, or paste a RELAY QR link.')
      return
    }
    void validate(parsed.code, parsed.token, 'manual')
  }

  const reset = () => {
    setResult(null)
    setConfirmed(false)
    setScanError(null)
    setManualError(null)
    setManualCode('')
    setPhase('idle')
    const next = new URLSearchParams(params)
    next.delete('code')
    next.delete('token')
    setParams(next, { replace: true })
    autoRan.current = true
  }

  const confirm = () => {
    if (!result) return
    confirmReceipt.mutate(
      {
        handoffId: result.id,
        condition,
        note: note.trim() || undefined,
        photo,
        method,
      },
      {
        onSuccess: () => setConfirmed(true),
      },
    )
  }

  const isReceiver = Boolean(result && me && result.receiverId === me.id)
  const canConfirm = Boolean(
    result && isReceiver && ['requested', 'awaiting_confirmation', 'in_transit'].includes(result.status),
  )
  const alreadyRecorded = Boolean(result && ['received', 'returned'].includes(result.status))
  const demoCodes = (data?.handoffs ?? [])
    .filter((handoff) => ['requested', 'awaiting_confirmation', 'in_transit', 'received'].includes(handoff.status))
    .slice(0, 3)

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Verified handoff</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Scan to receive<span className="text-accent">.</span>
          </>
        }
        description="Point the camera at the sender's handoff QR, or verify the code by hand. Nothing is confirmed until the code is validated and you record the condition."
        actions={
          result ? (
            <Button variant="secondary" icon={RefreshCw} onClick={reset}>
              Scan another
            </Button>
          ) : (
            <Link to="/handoffs" className="btn btn-secondary">
              Back to handoffs
            </Link>
          )
        }
      />

      {phase === 'result' && result ? (
        <ScanResult
          handoff={result}
          method={method}
          isReceiver={isReceiver}
          canConfirm={canConfirm}
          alreadyRecorded={alreadyRecorded}
          confirmed={confirmed}
          condition={condition}
          setCondition={setCondition}
          note={note}
          setNote={setNote}
          photo={photo}
          setPhoto={setPhoto}
          online={online}
          pending={confirmReceipt.isPending}
          error={confirmReceipt.error?.message}
          onConfirm={confirm}
          onReset={reset}
          onOpen={() => navigate(`/handoffs/${result.id}`)}
          meId={me?.id}
        />
      ) : phase === 'validating' ? (
        <div className="card flex min-h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent-soft text-accent">
            <Loader2 size={24} className="animate-spin" />
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink">Validating handoff…</p>
            <p className="mt-1 text-[12px] text-muted">Checking the code against the workspace record.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Camera size={15} className="text-accent" />
                <span className="text-[12.5px] font-medium text-ink">Camera scanner</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em]',
                    phase === 'scanning'
                      ? 'border-success/25 bg-success/10 text-success'
                      : 'border-line bg-surface-2 text-faint',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', phase === 'scanning' ? 'bg-success animate-pulse' : 'bg-faint')} />
                  {phase === 'scanning' ? 'Live' : phase === 'starting' ? 'Starting' : 'Standby'}
                </span>
                {phase === 'scanning' && (
                  <button type="button" onClick={stopCamera} className="btn btn-ghost btn-sm">
                    <StopCircle size={13} /> Stop
                  </button>
                )}
              </div>
            </div>

            <div className="relative aspect-[4/3] overflow-hidden bg-black">
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              {(phase === 'idle' || phase === 'starting') && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_38%,rgba(216,243,108,0.08),transparent_55%)] px-6 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/5 text-white/80 backdrop-blur">
                    {phase === 'starting' ? <Loader2 size={23} className="animate-spin" /> : <Camera size={23} />}
                  </span>
                  <div>
                    <p className="text-[13.5px] font-medium text-white">
                      {phase === 'starting' ? 'Requesting camera access…' : 'Camera is off'}
                    </p>
                    <p className="mt-1 max-w-[300px] text-[11px] leading-relaxed text-white/55">
                      {phase === 'starting'
                        ? 'Allow access in the browser prompt to begin scanning.'
                        : 'RELAY asks for camera access only while this panel is active.'}
                    </p>
                  </div>
                  {phase === 'idle' && (
                    <button type="button" onClick={() => void startCamera()} className="btn btn-primary btn-sm mt-1">
                      <Camera size={14} /> Enable camera
                    </button>
                  )}
                </div>
              )}

              {phase === 'scanning' && (
                <>
                  <div className="pointer-events-none absolute inset-0 bg-black/20" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[58%] max-h-[260px] max-w-[260px] -translate-x-1/2 -translate-y-1/2">
                    <span className="absolute -left-px -top-px h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-accent" />
                    <span className="absolute -right-px -top-px h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-accent" />
                    <span className="absolute -bottom-px -left-px h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-accent" />
                    <span className="absolute -bottom-px -right-px h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-accent" />
                    <span className="scan-line absolute inset-x-2 h-px bg-accent shadow-[0_0_14px_2px_var(--accent)]" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-10">
                    <p className="flex items-center gap-2 text-[11px] text-white/85">
                      <ScanLine size={13} className="text-accent" /> Hold the QR inside the frame
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-1.5 text-[10.5px] text-faint">
                <LockKeyhole size={11} /> Camera frames never leave this device
              </p>
              {phase !== 'scanning' && (
                <button type="button" onClick={() => void startCamera()} className="btn btn-secondary btn-sm w-fit">
                  <Camera size={13} /> {phase === 'starting' ? 'Starting…' : 'Start camera'}
                </button>
              )}
            </div>

            {cameraError && (
              <div className="mx-4 mb-4 rounded-lg border border-warn/25 bg-warn/8 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
                  <div>
                    <p className="text-[11.5px] font-medium text-ink">Camera unavailable</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{cameraError}</p>
                    <button type="button" onClick={() => void startCamera()} className="btn btn-ghost btn-sm mt-2 !h-7 !px-0">
                      Try camera again <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <div className="space-y-4">
            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <Keyboard size={15} className="text-accent" />
                <h2 className="text-[13px] font-medium text-ink">Verify the code manually</h2>
              </div>
              <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
                If the camera is blocked or the sender read the code aloud, enter it here. The same validation runs before
                receipt can be confirmed.
              </p>
              <form onSubmit={handleManual} className="space-y-3">
                <TextField
                  label="Handoff code"
                  placeholder="H-2038"
                  value={manualCode}
                  autoFocus={params.get('mode') === 'manual'}
                  onChange={(event) => {
                    setManualCode(event.target.value.toUpperCase())
                    setManualError(null)
                  }}
                  error={manualError ?? undefined}
                  leadingIcon={<QrCode size={14} />}
                  hint="5–8 characters. You can also paste a full RELAY scan link."
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button type="submit" variant="primary" icon={ShieldCheck} fullWidth>
                  Verify code
                </Button>
              </form>

              {demoCodes.length > 0 && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="eyebrow mb-2 text-[8.5px]">Demo codes for testing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {demoCodes.map((handoff) => (
                      <button
                        key={handoff.id}
                        type="button"
                        onClick={() => {
                          setManualCode(handoff.code)
                          setManualError(null)
                        }}
                        className="chip font-mono text-[10px]"
                        title="Fill this demo code into the field"
                      >
                        {handoff.code}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[9.5px] leading-relaxed text-faint">
                    These are real codes from the demo workspace, not simulated scans. Only the signed-in receiver can
                    confirm a receipt.
                  </p>
                </div>
              )}
            </section>

            {scanError && (
              <section className="rounded-[var(--radius-md)] border border-danger/25 bg-danger/8 p-4">
                <div className="flex items-start gap-2.5">
                  <CameraOff size={16} className="mt-0.5 shrink-0 text-danger" />
                  <div>
                    <p className="text-[12px] font-medium text-ink">{scanError.title}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted">{scanError.message}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button type="button" onClick={reset} className="btn btn-secondary btn-sm">
                        Try again
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setScanError(null)
                          setPhase('idle')
                          setManualCode('')
                        }}
                        className="btn btn-ghost btn-sm"
                      >
                        <Keyboard size={12} /> Enter manually
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-[var(--radius-md)] border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-accent" />
                <p className="text-[11.5px] font-medium text-ink">What a valid scan proves</p>
              </div>
              <ul className="mt-2.5 space-y-2">
                {[
                  'The code belongs to a live handoff in your workspace.',
                  'The QR token matches the handoff it claims to be.',
                  'The handoff has been sent and is not cancelled.',
                  'Only the named receiver can record the receipt.',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[10.5px] leading-relaxed text-muted">
                    <Check size={12} className="mt-0.5 shrink-0 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {!online && (
              <div className="flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/8 px-3 py-2.5 text-[10.5px] text-warn">
                <WifiOff size={13} className="mt-0.5 shrink-0" />
                You are offline. Verification still runs locally, and a confirmed receipt is queued safely on this device.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ScanResult({
  handoff,
  method,
  isReceiver,
  canConfirm,
  alreadyRecorded,
  confirmed,
  condition,
  setCondition,
  note,
  setNote,
  photo,
  setPhoto,
  online,
  pending,
  error,
  onConfirm,
  onReset,
  onOpen,
  meId,
}: {
  handoff: HandoffView
  method: 'qr' | 'manual'
  isReceiver: boolean
  canConfirm: boolean
  alreadyRecorded: boolean
  confirmed: boolean
  condition: ItemCondition
  setCondition: (next: ItemCondition) => void
  note: string
  setNote: (next: string) => void
  photo?: string
  setPhoto: (next?: string) => void
  online: boolean
  pending: boolean
  error?: string
  onConfirm: () => void
  onReset: () => void
  onOpen: () => void
  meId?: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-4">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-success/6 px-4 py-3">
            <div className="flex items-center gap-2 text-success">
              <ShieldCheck size={16} />
              <span className="text-[12px] font-medium">
                {method === 'qr' ? 'QR verified against the workspace' : 'Code verified manually'}
              </span>
            </div>
            <Badge tone="success">Valid</Badge>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row">
              <ImageWithFallback
                src={handoff.item.image}
                alt={handoff.item.name}
                className="h-36 w-full shrink-0 rounded-xl border border-line sm:h-[128px] sm:w-[168px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
                  <ConditionPill condition={handoff.conditionOut} />
                  {handoff.team && <Badge tone="violet">{handoff.team.name}</Badge>}
                </div>
                <h2 className="mt-2 text-[19px] font-medium tracking-[-0.025em] text-ink">{handoff.item.name}</h2>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{handoff.description}</p>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                  <span>{handoff.code}</span>
                  <span>·</span>
                  <span className={handoff.isOverdue ? 'text-danger' : undefined}>{dueLabel(handoff.dueAt)}</span>
                  <span>·</span>
                  <span>{handoff.item.serial}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 divide-x divide-line rounded-lg border border-line bg-surface-2/40">
              {[
                { label: 'Sender', person: handoff.sender },
                { label: 'Receiver', person: handoff.receiver },
              ].map(({ label, person }) => (
                <div key={label} className="flex min-w-0 items-center gap-2.5 p-3">
                  <Avatar profile={person} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-faint">{label}</p>
                    <p className="truncate text-[11.5px] font-medium text-ink">
                      {person.id === meId ? 'You' : person.name}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {handoff.status === 'received' && handoff.proof && (
              <div className="mt-3 rounded-lg border border-success/20 bg-success/6 p-3">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-success">
                  <Check size={12} /> Receipt already recorded
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                  Condition {CONDITION_META[handoff.conditionIn ?? handoff.proof.condition].label.toLowerCase()} ·{' '}
                  {formatDateTime(handoff.proof.createdAt)} · {handoff.proof.type === 'qr' ? 'QR proof' : 'Manual proof'}
                </p>
              </div>
            )}
          </div>
        </section>

        {!isReceiver && !alreadyRecorded && (
          <div className="rounded-lg border border-info/25 bg-info/8 p-4">
            <p className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
              <CircleHelp size={14} className="text-info" /> Only the receiver can confirm this handoff
            </p>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
              You verified the code, but this handoff is addressed to {handoff.receiver.name}. Ask them to sign in and
              scan from their own device.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {confirmed ? (
          <section className="card flex flex-col items-center p-6 text-center sm:p-8">
            <SuccessMark size={62} />
            <h2 className="mt-4 text-[18px] font-medium tracking-[-0.02em] text-ink">Receipt confirmed</h2>
            <p className="mt-1.5 max-w-[320px] text-[11.5px] leading-relaxed text-muted">
              The condition record and proof are attached to {handoff.code}. The sender has been notified.
              {!online && ' This confirmation is stored on your device and will sync when you reconnect.'}
            </p>
            <div className="mt-5 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              <Button variant="primary" icon={ArrowRight} onClick={onOpen}>
                Open the handoff
              </Button>
              <Button variant="secondary" icon={RefreshCw} onClick={onReset}>
                Scan another
              </Button>
            </div>
          </section>
        ) : canConfirm ? (
          <section className="card p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-medium text-ink">Confirm receipt</h2>
              <Badge tone="accent">{method === 'qr' ? 'QR scan' : 'Manual'}</Badge>
            </div>
            <p className="mb-4 text-[11px] leading-relaxed text-muted">
              Record the item's condition as you receive it. This becomes the “after” side of the condition comparison.
            </p>
            <div className="space-y-4">
              <SelectField
                label="Condition on receipt"
                value={condition}
                onChange={(event) => setCondition(event.target.value as ItemCondition)}
                options={CONDITION_ORDER.map((value) => ({
                  value,
                  label: `${CONDITION_META[value].label} — ${CONDITION_META[value].blurb}`,
                }))}
              />
              <TextAreaField
                label="Note for the record"
                optional
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="e.g. Received with both lenses, strap and case. No new marks."
                maxLength={400}
                showCount
              />
              <SingleImageUpload
                label="Receipt photo"
                value={photo}
                onChange={setPhoto}
                aspect="aspect-[16/9]"
              />
              {error && (
                <p className="rounded-lg border border-danger/25 bg-danger/8 px-3 py-2 text-[10.5px] text-danger">{error}</p>
              )}
              {!online && (
                <div className="flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/8 px-3 py-2.5 text-[10.5px] text-warn">
                  <WifiOff size={13} className="mt-0.5 shrink-0" />
                  Offline mode: the receipt will be queued with duplicate protection and synced automatically.
                </div>
              )}
              <Button variant="primary" icon={ShieldCheck} fullWidth loading={pending} onClick={onConfirm}>
                Confirm receipt &amp; attach proof
              </Button>
              <p className="text-center text-[9.5px] text-faint">
                The proof is bound to {handoff.code} and cannot be replayed on another handoff.
              </p>
            </div>
          </section>
        ) : alreadyRecorded ? (
          <section className="card p-5">
            <div className="flex items-start gap-2.5">
              <ShieldCheck size={17} className="mt-0.5 text-success" />
              <div>
                <p className="text-[12.5px] font-medium text-ink">No action needed</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  This handoff is {handoff.status === 'returned' ? 'complete' : 'already in possession'}. Receipt proof is in
                  the trust record.
                </p>
                <Button variant="secondary" size="sm" className="mt-3" icon={ArrowRight} onClick={onOpen}>
                  View trust record
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="card p-5">
            <p className="flex items-center gap-2 text-[12px] font-medium text-ink">
              <AlertTriangle size={15} className="text-warn" /> This handoff is not ready for receipt
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              The handoff is currently {handoff.status.replace('_', ' ')}. Open it to see the next valid action.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" icon={ArrowRight} onClick={onOpen}>
              Open handoff
            </Button>
          </section>
        )}

        <div className="rounded-[var(--radius-md)] border border-line bg-surface-2/40 p-3.5">
          <p className="eyebrow mb-2 text-[8.5px]">Verification details</p>
          <div className="space-y-1.5 font-mono text-[10px] text-muted">
            <div className="flex justify-between gap-3">
              <span className="text-faint">Method</span>
              <span className="text-ink">{method === 'qr' ? 'Camera QR' : 'Manual code'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-faint">Handoff</span>
              <span className="text-ink">{handoff.code}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-faint">Item</span>
              <span>{handoff.item.serial}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-faint">Verified</span>
              <span>{formatDateTime(new Date())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
