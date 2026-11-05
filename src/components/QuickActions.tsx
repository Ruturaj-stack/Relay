import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  HandCoins,
  PackageCheck,
  Plus,
  ScanLine,
  Send,
  TriangleAlert,
  Undo2,
  Zap,
} from 'lucide-react'
import { cn, dueLabel } from '@/lib/utils'
import { queryHandoffs } from '@/lib/selectors'
import { useHandoffAction, useWorkspace } from '@/hooks/useWorkspace'
import { useAppStore } from '@/store/appStore'
import { useSyncStore } from '@/store/syncStore'
import { Button, EmptyState, ImageWithFallback, RiskPill, StatusBadge } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/overlays'
import { ReportIssueDialog } from '@/components/ReportIssueDialog'

export function QuickActionsSheet() {
  const open = useAppStore((state) => state.quickOpen)
  const setOpen = useAppStore((state) => state.setQuickOpen)
  const [mode, setMode] = useState<'main' | 'return'>('main')
  const [issueOpen, setIssueOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const { data } = useWorkspace()
  const online = useSyncStore((state) => state.online)
  const action = useHandoffAction()
  const navigate = useNavigate()

  const needsYou = useMemo(
    () => (data ? queryHandoffs(data, { status: 'attention' }).filter((handoff) => handoff.needsMyAction).slice(0, 3) : []),
    [data],
  )
  const myReceived = useMemo(
    () =>
      data
        ? queryHandoffs(data, { status: 'active' }).filter(
            (handoff) => handoff.receiverId === data.currentUserId && handoff.status === 'received',
          )
        : [],
    [data],
  )

  const go = (path: string) => {
    setOpen(false)
    setMode('main')
    navigate(path)
  }

  const quickAction = (
    label: string,
    description: string,
    Icon: typeof ScanLine,
    onClick: () => void,
    accent?: boolean,
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[92px] flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition-all active:scale-[0.985]',
        accent
          ? 'border-accent/30 bg-accent-soft hover:border-accent/50'
          : 'border-line bg-surface-2/50 hover:border-line-strong hover:bg-surface-2',
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border',
          accent ? 'border-accent/30 bg-accent text-accent-ink' : 'border-line bg-surface text-muted',
        )}
      >
        <Icon size={16} strokeWidth={1.8} />
      </span>
      <span>
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-[10.5px] leading-relaxed text-faint">{description}</span>
      </span>
    </button>
  )

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          setMode('main')
        }}
        title={mode === 'main' ? 'Quick actions' : 'Return an item'}
        description={
          mode === 'main'
            ? 'Move something, close a loop, or flag a problem in a few taps.'
            : 'Choose the item you are handing back. You will confirm its condition on the next screen.'
        }
        icon={mode === 'main' ? Zap : Undo2}
        size="md"
        footer={
          mode === 'main' ? (
            <div className="flex w-full items-center justify-between text-[10px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', online ? 'bg-success' : 'bg-warn')} />
                {online ? 'Synced with your workspace' : 'Offline · changes saved on device'}
              </span>
              <button type="button" onClick={() => go('/scan')} className="inline-flex items-center gap-1 text-accent">
                Open scanner <ArrowRight size={11} />
              </button>
            </div>
          ) : undefined
        }
      >
        {mode === 'main' ? (
          <div className="space-y-5 pb-1">
            {needsYou.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <span className="eyebrow">Needs you</span>
                  <span className="font-mono text-[9px] text-accent">{needsYou.length} waiting</span>
                </div>
                <div className="space-y-2">
                  {needsYou.map((handoff) => {
                    const receiverAction = handoff.status === 'requested'
                    const canConfirm =
                      handoff.receiverId === data?.currentUserId &&
                      ['awaiting_confirmation', 'in_transit'].includes(handoff.status)
                    const canSend = handoff.status === 'draft'
                    return (
                      <div
                        key={handoff.id}
                        className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2/50 p-2.5"
                      >
                        <ImageWithFallback
                          src={handoff.item.image}
                          alt={handoff.item.name}
                          className="h-10 w-10 shrink-0 rounded-lg border border-line"
                          iconSize={15}
                        />
                        <button type="button" onClick={() => go(`/handoffs/${handoff.id}`)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-[11.5px] font-medium text-ink">{handoff.item.name}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-faint">
                            <Clock3 size={9} /> {dueLabel(handoff.dueAt)} · {handoff.code}
                          </p>
                        </button>
                        {receiverAction && (
                          <button
                            type="button"
                            disabled={action.isPending && pendingId === handoff.id}
                            onClick={() => {
                              setPendingId(handoff.id)
                              action.mutate(
                                { handoffId: handoff.id, action: 'accept', actorId: data?.currentUserId ?? undefined },
                                { onSuccess: () => go(`/handoffs/${handoff.id}`) },
                              )
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            {action.isPending && pendingId === handoff.id ? (
                              '…'
                            ) : (
                              <>
                                <Check size={12} /> Accept
                              </>
                            )}
                          </button>
                        )}
                        {canSend && (
                          <button
                            type="button"
                            disabled={action.isPending}
                            onClick={() => {
                              setPendingId(handoff.id)
                              action.mutate(
                                { handoffId: handoff.id, action: 'send' },
                                { onSuccess: () => go(`/handoffs/${handoff.id}`) },
                              )
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            <Send size={12} /> Send
                          </button>
                        )}
                        {canConfirm && (
                          <button
                            type="button"
                            onClick={() => go(`/scan?code=${handoff.code}`)}
                            className="btn btn-primary btn-sm"
                          >
                            <ScanLine size={12} /> Scan
                          </button>
                        )}
                        {!receiverAction && !canConfirm && !canSend && (
                          <button type="button" onClick={() => go(`/handoffs/${handoff.id}`)} className="btn btn-secondary btn-sm">
                            Open <ChevronRight size={11} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section>
              <span className="eyebrow mb-2 block">Move something</span>
              <div className="grid grid-cols-2 gap-2.5">
                {quickAction('Scan QR', 'Confirm a handoff in person', ScanLine, () => go('/scan'), true)}
                {quickAction('Receive item', 'Review incoming handoffs', PackageCheck, () => go('/scan?mode=receive'))}
                {quickAction('Return item', 'Hand something back', Undo2, () => setMode('return'))}
                {quickAction('New handoff', 'Start a tracked transfer', Plus, () => go('/handoffs/new'))}
              </div>
            </section>

            <section className="space-y-2">
              <button
                type="button"
                onClick={() => setIssueOpen(true)}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:border-danger/25 hover:bg-danger/5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger/20 bg-danger/10 text-danger">
                  <TriangleAlert size={15} />
                </span>
                <span className="flex-1">
                  <span className="block text-[12px] font-medium text-ink">Report an issue</span>
                  <span className="mt-0.5 block text-[10.5px] text-faint">Damage, missing parts or a blocked handoff</span>
                </span>
                <ChevronRight size={15} className="text-faint" />
              </button>

              {data?.currentUserId && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    navigate(`/people?person=${data.currentUserId}`)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted">
                    <HandCoins size={15} />
                  </span>
                  <span className="flex-1">
                    <span className="block text-[12px] font-medium text-ink">My items & history</span>
                    <span className="mt-0.5 block text-[10.5px] text-faint">See what you hold and what you have handed off</span>
                  </span>
                  <ChevronRight size={15} className="text-faint" />
                </button>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-3 pb-1">
            <button
              type="button"
              onClick={() => setMode('main')}
              className="mb-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
            >
              <ArrowLeft size={12} /> Back to quick actions
            </button>
            {myReceived.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="Nothing to return"
                description="You are not currently holding anything that needs to go back."
                compact
                action={
                  <Button variant="secondary" size="sm" onClick={() => go('/items')}>
                    View my items
                  </Button>
                }
              />
            ) : (
              myReceived.map((handoff) => (
                <button
                  key={handoff.id}
                  type="button"
                  onClick={() => go(`/handoffs/${handoff.id}?action=return`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/50 p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                >
                  <ImageWithFallback
                    src={handoff.item.image}
                    alt={handoff.item.name}
                    className="h-11 w-11 shrink-0 rounded-lg border border-line"
                    iconSize={16}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink">{handoff.item.name}</span>
                    <span className="mt-0.5 block text-[10px] text-faint">
                      {handoff.code} · {dueLabel(handoff.dueAt)}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
                      <RiskPill risk={handoff.risk} compact />
                    </span>
                  </span>
                  <ChevronRight size={15} className="text-faint" />
                </button>
              ))
            )}
          </div>
        )}
      </Modal>
      <ReportIssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} />
    </>
  )
}
