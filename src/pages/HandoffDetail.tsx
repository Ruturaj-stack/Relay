import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  Ban,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  MapPin,
  MessageSquarePlus,
  Package,
  QrCode,
  RotateCcw,
  Send,
  ShieldCheck,
  TriangleAlert,
  Undo2,
  UserRound,
  X,
} from 'lucide-react'
import type { HandoffView, ItemCondition } from '@/types'
import { useHandoffAction, useWorkspace } from '@/hooks/useWorkspace'
import { getHandoffView, getProfile } from '@/lib/selectors'
import {
  CONDITION_META,
  CONDITION_ORDER,
  cn,
  dueLabel,
  formatDate,
  formatDateTime,
  firstName,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  ConditionPill,
  DemoBadge,
  EmptyState,
  ImageWithFallback,
  RiskPill,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives'
import { Modal, ConfirmDialog } from '@/components/ui/overlays'
import { SelectField, TextAreaField } from '@/components/ui/forms'
import { HandoffQRCard } from '@/components/ui/qr'
import { ReportIssueDialog } from '@/components/ReportIssueDialog'
import {
  ConditionCompare,
  HandoffMeta,
  HandoffQRInline,
  HandoffTimeline,
  ProofCard,
  RiskPanel,
} from '@/components/handoff/HandoffPanels'
import { toast } from '@/store/appStore'

type DialogKind = 'decline' | 'cancel' | 'return' | 'confirm_return' | 'note' | null

export function HandoffDetailPage() {
  const { handoffId: id } = useParams<{ handoffId: string }>()
  const { data, isLoading, isError, refetch } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const action = useHandoffAction()
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [note, setNote] = useState('')
  const [condition, setCondition] = useState<ItemCondition>('good')
  const [pending, setPending] = useState<string | null>(null)
  const [openedReturn, setOpenedReturn] = useState(false)

  const handoff = useMemo(() => (data && id ? getHandoffView(data, id) : undefined), [data, id])
  const me = data?.currentUserId ? getProfile(data, data.currentUserId) : undefined
  const isSender = Boolean(handoff && me && handoff.senderId === me.id)
  const isReceiver = Boolean(handoff && me && handoff.receiverId === me.id)
  const returnStarted = Boolean(handoff?.events.some((event) => event.type === 'return_requested'))
  const canScan = isReceiver && handoff && ['awaiting_confirmation', 'in_transit', 'requested'].includes(handoff.status)
  const canCancel = isSender && handoff && !['returned', 'cancelled'].includes(handoff.status)
  const canNote = handoff && !['returned', 'cancelled'].includes(handoff.status)

  useEffect(() => {
    if (!handoff || openedReturn) return
    if (params.get('action') === 'return' && isReceiver && handoff.status === 'received' && !returnStarted) {
      setCondition(handoff.conditionIn ?? handoff.conditionOut)
      setDialog('return')
      setOpenedReturn(true)
      const next = new URLSearchParams(params)
      next.delete('action')
      setParams(next, { replace: true })
    }
  }, [handoff, isReceiver, openedReturn, params, returnStarted, setParams])

  const runAction = (
    kind: 'send' | 'accept' | 'transit' | 'start_return' | 'confirm_return' | 'decline' | 'cancel' | 'note',
    extra?: { note?: string; condition?: ItemCondition },
  ) => {
    if (!handoff) return
    setPending(kind)
    action.mutate(
      { handoffId: handoff.id, action: kind, note: extra?.note, condition: extra?.condition },
      {
        onSuccess: (result) => {
          setDialog(null)
          setNote('')
          if (kind === 'send') toast.success('Request sent', `${handoff.receiver.name} can now accept.`)
          if (kind === 'accept') toast.success('Request accepted', 'Scan the QR together to record proof.')
          if (kind === 'start_return') toast.success('Return started', 'The sender has been asked to confirm.')
          if (kind === 'confirm_return') toast.success('Handoff closed', 'The return is now in the trust record.')
          if (result.offline) toast.info('Saved offline', 'This change will sync when you reconnect.')
        },
        onSettled: () => setPending(null),
      },
    )
  }

  const openDialog = (kind: Exclude<DialogKind, null>) => {
    if (!handoff) return
    setNote('')
    setCondition(handoff.conditionIn ?? handoff.conditionOut)
    setDialog(kind)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-2/3 max-w-md" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[420px] rounded-[var(--radius-lg)] lg:col-span-8" />
          <Skeleton className="h-[420px] rounded-[var(--radius-lg)] lg:col-span-4" />
        </div>
      </div>
    )
  }

  if (isError || !data || !handoff) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="This handoff could not be found"
        description="It may have been removed from the demo workspace, or the link is no longer valid."
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => navigate('/handoffs')}>
              Back to handoffs
            </Button>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reload
            </Button>
          </div>
        }
      />
    )
  }

  const primary = (() => {
    if (handoff.status === 'draft' && isSender)
      return { label: 'Send request', icon: Send, run: () => runAction('send') }
    if (handoff.status === 'requested' && isReceiver)
      return { label: 'Accept request', icon: Check, run: () => runAction('accept') }
    if (canScan)
      return { label: 'Scan to confirm', icon: Camera, run: () => navigate(`/scan?code=${handoff.code}`) }
    if (handoff.status === 'awaiting_confirmation' && isSender)
      return { label: 'Mark in transit', icon: Send, run: () => runAction('transit') }
    if (handoff.status === 'received' && isReceiver && !returnStarted)
      return { label: 'Hand it back', icon: Undo2, run: () => openDialog('return') }
    if (handoff.status === 'received' && isSender && returnStarted)
      return { label: 'Confirm return', icon: ShieldCheck, run: () => openDialog('confirm_return') }
    return null
  })()

  const PrimaryIcon = primary?.icon

  return (
    <div>
      <PageHeader
        back={{ to: '/handoffs', label: 'All handoffs' }}
        eyebrow={
          <>
            <span className="font-mono text-[10px] tracking-[0.14em] text-faint">{handoff.code}</span>
            <span className="h-3 w-px bg-line-strong" />
            <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
            <DemoBadge compact />
          </>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {handoff.item.name}
            {handoff.isOverdue && <Badge tone="danger">Overdue</Badge>}
            {handoff.pendingSync && <Badge tone="warn">Waiting to sync</Badge>}
          </span>
        }
        description={handoff.description}
        actions={
          <>
            {primary && PrimaryIcon && (
              <Button
                variant="primary"
                icon={PrimaryIcon}
                loading={pending !== null}
                onClick={primary.run}
              >
                {primary.label}
              </Button>
            )}
            {canScan && (
              <Button variant="secondary" icon={QrCode} onClick={() => navigate(`/scan?code=${handoff.code}&mode=manual`)}>
                Enter code
              </Button>
            )}
            {canNote && (
              <Button variant="secondary" icon={MessageSquarePlus} onClick={() => openDialog('note')}>
                Add note
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <section className="card overflow-hidden">
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
              <ImageWithFallback
                src={handoff.item.image}
                alt={handoff.item.name}
                className="h-36 w-full shrink-0 rounded-xl border border-line sm:h-[152px] sm:w-[196px]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{handoff.item.category}</Badge>
                  <ConditionPill condition={handoff.conditionOut} />
                  {handoff.team && <Badge tone="violet">{handoff.team.name}</Badge>}
                </div>
                <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted">
                  {handoff.item.description || 'No item notes were added.'}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[9.5px] uppercase tracking-wider text-faint">
                  <span className="flex items-center gap-1"><Package size={10} /> {handoff.item.serial}</span>
                  <span className="flex items-center gap-1"><MapPin size={10} /> {handoff.item.location}</span>
                  <span className="flex items-center gap-1"><Clock3 size={10} /> {dueLabel(handoff.dueAt)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link to={`/items/${handoff.item.id}`} className="btn btn-secondary btn-sm">
                    Item record <ChevronRight size={11} />
                  </Link>
                  <Link
                    to={`/handoffs/new?itemId=${handoff.item.id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    <RotateCcw size={12} /> Hand off again
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <PersonBlock
                label="Sent by"
                profile={handoff.sender}
                isYou={handoff.senderId === me?.id}
              />
              <PersonBlock
                label="Received by"
                profile={handoff.receiver}
                isYou={handoff.receiverId === me?.id}
              />
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink">Condition record</h2>
                <span className="font-mono text-[9px] uppercase tracking-wider text-faint">Before / after</span>
              </div>
              <ConditionCompare handoff={handoff} />
            </section>

            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink">Handoff facts</h2>
                <RiskPill risk={handoff.risk} compact />
              </div>
              <HandoffMeta handoff={handoff} />
              {(isSender || isReceiver) && handoff.status !== 'cancelled' && (
                <div className="mt-3 border-t border-line pt-3">
                  <p className="eyebrow mb-2 text-[8.5px]">Quick controls</p>
                  <div className="flex flex-wrap gap-1.5">
                    {handoff.status === 'requested' && isSender && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => runAction('transit')} disabled={action.isPending}>
                        <Send size={12} /> Mark handed over
                      </button>
                    )}
                    {handoff.status === 'awaiting_confirmation' && <HandoffQRInline handoff={handoff} />}
                    {canCancel && (
                      <Button variant="danger" size="sm" icon={Ban} onClick={() => openDialog('cancel')}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-medium text-ink">Trust record</h2>
                <p className="mt-0.5 text-[10.5px] text-faint">
                  Every movement, verification and condition update in order.
                </p>
              </div>
              <Badge tone="success">
                <ShieldCheck size={10} /> {handoff.proof ? 'Proof attached' : 'Awaiting proof'}
              </Badge>
            </div>
            <HandoffTimeline handoff={handoff} />
          </section>

          {handoff.instructions && (
            <section className="card p-4 sm:p-5">
              <h2 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink">
                <FileText size={14} className="text-faint" /> Instructions for the receiver
              </h2>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-muted">{handoff.instructions}</p>
            </section>
          )}

          {handoff.photos.length > 0 && (
            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink">Condition photographs</h2>
                <span className="font-mono text-[9px] uppercase tracking-wider text-faint">
                  {handoff.photos.length} attached at handoff
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {handoff.photos.map((photo, index) => (
                  <a
                    key={`${photo.slice(-16)}-${index}`}
                    href={photo}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line"
                  >
                    <ImageWithFallback src={photo} alt={`Handoff condition ${index + 1}`} className="h-full w-full" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] text-white opacity-0 transition-all group-hover:bg-black/35 group-hover:opacity-100">
                      Open full size
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={TriangleAlert} onClick={() => setIssueOpen(true)}>
              Report an issue
            </Button>
            {canNote && (
              <Button variant="ghost" size="sm" icon={MessageSquarePlus} onClick={() => openDialog('note')}>
                Add a note to the record
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={Copy}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/handoffs/${handoff.id}`)
                  toast.success('Link copied', 'Share it with the other person on this handoff.')
                } catch {
                  toast.error('Could not copy the link', 'Your browser blocked clipboard access.')
                }
              }}
            >
              Copy link
            </Button>
          </div>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          {['requested', 'awaiting_confirmation', 'in_transit'].includes(handoff.status) && (
            <HandoffQRCard handoff={handoff} />
          )}

          {handoff.status === 'draft' && (
            <div className="rounded-[var(--radius-lg)] border border-line bg-surface p-4 text-center">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-2 text-faint">
                <QrCode size={19} strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-[12px] font-medium text-ink">QR activates on send</p>
              <p className="mx-auto mt-1 max-w-[240px] text-[10.5px] leading-relaxed text-faint">
                The scan link is unique to this handoff and cannot be used until the request has been sent.
              </p>
              {isSender && (
                <Button variant="primary" size="sm" className="mt-3" icon={Send} onClick={() => runAction('send')}>
                  Send request now
                </Button>
              )}
            </div>
          )}

          <ProofCard handoff={handoff} />

          {handoff.status === 'received' && (
            <div
              className={cn(
                'rounded-xl border p-3.5',
                returnStarted ? 'border-info/25 bg-info/8' : 'border-line bg-surface-2/40',
              )}
            >
              <div className="flex items-center gap-2">
                <Undo2 size={13} className={returnStarted ? 'text-info' : 'text-faint'} />
                <span className="text-[11.5px] font-medium text-ink">
                  {returnStarted ? 'Return in progress' : 'Return not started'}
                </span>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                {returnStarted
                  ? isSender
                    ? `${firstName(handoff.receiver.name)} marked the item as handed back. Confirm the return to close the chain.`
                    : 'The sender has been notified. They need to confirm the return to close the chain.'
                  : isReceiver
                    ? 'When you hand the item back, start the return so the sender can confirm it.'
                    : 'The receiver will start the return when they hand the item back.'}
              </p>
              {isReceiver && !returnStarted && (
                <Button variant="secondary" size="sm" className="mt-2.5" icon={Undo2} onClick={() => openDialog('return')}>
                  Start return
                </Button>
              )}
              {isSender && returnStarted && (
                <Button variant="primary" size="sm" className="mt-2.5" icon={ShieldCheck} onClick={() => openDialog('confirm_return')}>
                  Confirm return
                </Button>
              )}
            </div>
          )}

          {['requested', 'awaiting_confirmation', 'in_transit', 'received'].includes(handoff.status) && (
            <RiskPanel handoff={handoff} />
          )}

          {handoff.status === 'cancelled' && (
            <div className="rounded-xl border border-line bg-surface-2/40 p-4">
              <div className="flex items-center gap-2 text-[11.5px] font-medium text-muted">
                <X size={13} /> Handoff cancelled
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                Cancelled {handoff.cancelledAt ? formatDateTime(handoff.cancelledAt) : 'before completion'}. The record
                remains visible for the history of the item.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
            <p className="eyebrow mb-2 text-[8.5px]">Handoff identifiers</p>
            <div className="space-y-1.5 font-mono text-[10px] text-muted">
              <div className="flex justify-between gap-3">
                <span className="text-faint">Code</span>
                <span className="text-ink">{handoff.code}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-faint">Created</span>
                <span>{formatDate(handoff.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-faint">Due</span>
                <span className={handoff.isOverdue ? 'text-danger' : undefined}>{formatDate(handoff.dueAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-faint">Team</span>
                <span>{handoff.team?.name ?? 'Personal'}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ActionDialog
        kind={dialog}
        handoff={handoff}
        note={note}
        setNote={setNote}
        condition={condition}
        setCondition={setCondition}
        pending={pending}
        onClose={() => setDialog(null)}
        onConfirm={(kind, extra) => runAction(kind, extra)}
      />

      <ConfirmDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        onConfirm={() => runAction('cancel', { note: note.trim() || 'Cancelled by the sender.' })}
        title="Cancel this handoff?"
        description="The record stays in the history, but the QR stops working and the item becomes available again."
        confirmLabel="Cancel handoff"
        cancelLabel="Keep it open"
        loading={pending === 'cancel'}
      >
        <TextAreaField
          label="Reason"
          optional
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Let the other person know why."
          maxLength={300}
        />
      </ConfirmDialog>

      <ReportIssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} handoffId={handoff.id} />
    </div>
  )
}

function PersonBlock({
  label,
  profile,
  isYou,
}: {
  label: string
  profile: HandoffView['sender']
  isYou: boolean
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <Avatar profile={profile} size="md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-faint">
          {label} {isYou && <Badge tone="accent">You</Badge>}
        </p>
        <p className="mt-0.5 truncate text-[12.5px] font-medium text-ink">{profile.name}</p>
        <p className="truncate text-[10.5px] text-faint">{profile.title}</p>
      </div>
      <Link to={`/people?person=${profile.id}`} className="btn btn-ghost btn-icon btn-sm" aria-label={`Open ${profile.name}`}>
        <UserRound size={14} />
      </Link>
    </div>
  )
}

function ActionDialog({
  kind,
  handoff,
  note,
  setNote,
  condition,
  setCondition,
  pending,
  onClose,
  onConfirm,
}: {
  kind: DialogKind
  handoff: HandoffView
  note: string
  setNote: (value: string) => void
  condition: ItemCondition
  setCondition: (value: ItemCondition) => void
  pending: string | null
  onClose: () => void
  onConfirm: (kind: 'start_return' | 'confirm_return' | 'decline' | 'note', extra: { note?: string; condition?: ItemCondition }) => void
}) {
  if (kind === 'cancel' || kind === null) return null
  const config = {
    decline: {
      title: 'Decline this request',
      description: 'The sender will see your note and the handoff will be cancelled.',
      icon: X,
      confirm: 'Decline request',
      tone: 'danger' as const,
      requireNote: false,
    },
    return: {
      title: 'Start the return',
      description: 'Record the item condition and hand it back. The sender will confirm the return.',
      icon: Undo2,
      confirm: 'Start return',
      tone: 'primary' as const,
      requireNote: false,
    },
    confirm_return: {
      title: 'Confirm the return',
      description: 'Close the handoff chain. Check the condition before you confirm.',
      icon: ShieldCheck,
      confirm: 'Confirm return',
      tone: 'primary' as const,
      requireNote: false,
    },
    note: {
      title: 'Add a note',
      description: 'Notes are visible to both people and stay in the trust record.',
      icon: MessageSquarePlus,
      confirm: 'Add note',
      tone: 'primary' as const,
      requireNote: true,
    },
  }[kind]
  const actionKey = kind === 'return' ? 'start_return' : kind
  const Icon = config.icon
  const showCondition = kind === 'return' || kind === 'confirm_return'

  return (
    <Modal
      open
      onClose={onClose}
      title={config.title}
      description={config.description}
      icon={Icon}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending !== null}>
            Cancel
          </button>
          <button
            type="button"
            className={cn('btn', config.tone === 'danger' ? 'btn-danger' : 'btn-primary')}
            disabled={pending !== null || (config.requireNote && !note.trim())}
            onClick={() =>
              onConfirm(actionKey as 'start_return' | 'confirm_return' | 'decline' | 'note', {
                note: note.trim() || undefined,
                condition: showCondition ? condition : undefined,
              })
            }
          >
            {pending !== null ? 'Working…' : config.confirm}
          </button>
        </>
      }
    >
      <div className="space-y-3 pb-1">
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-2/50 p-2.5">
          <ImageWithFallback src={handoff.item.image} alt={handoff.item.name} className="h-10 w-10 rounded-lg border border-line" />
          <div className="min-w-0">
            <p className="truncate text-[11.5px] font-medium text-ink">{handoff.item.name}</p>
            <p className="font-mono text-[9px] text-faint">{handoff.code}</p>
          </div>
        </div>
        {showCondition && (
          <SelectField
            label="Condition now"
            value={condition}
            onChange={(event) => setCondition(event.target.value as ItemCondition)}
            options={CONDITION_ORDER.map((value) => ({
              value,
              label: `${CONDITION_META[value].label} — ${CONDITION_META[value].blurb}`,
            }))}
            hint="This is stored in the condition comparison and trust record."
          />
        )}
        <TextAreaField
          label={config.requireNote ? 'Note' : 'Note'}
          optional={!config.requireNote}
          required={config.requireNote}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={
            kind === 'decline'
              ? 'e.g. I am out of office and cannot collect it in time.'
              : kind === 'return'
                ? 'e.g. Handed back at the front desk with both fobs.'
                : kind === 'confirm_return'
                  ? 'e.g. Returned clean and complete.'
                  : 'e.g. Please include the braided charger.'
          }
          maxLength={400}
          showCount
        />
      </div>
    </Modal>
  )
}
