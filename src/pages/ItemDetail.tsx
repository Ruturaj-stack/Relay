import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  FileText,
  MapPin,
  Package,
  PackagePlus,
  Pencil,
  ShieldCheck,
  Tag,
  TriangleAlert,
  UserRound,
  Wrench,
} from 'lucide-react'
import type { ItemCondition } from '@/types'
import { useArchiveItem, useUpdateItem, useWorkspace } from '@/hooks/useWorkspace'
import { enrichItem, getCurrentProfile, getProfile, itemHistory, profileReliability } from '@/lib/selectors'
import {
  CONDITION_META,
  CONDITION_ORDER,
  ITEM_STATUS,
  cn,
  dueLabel,
  formatCurrency,
  formatDate,
  formatDateTime,
  relativeTime,
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
  ProgressBar,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives'
import { ConfirmDialog, Menu, Modal } from '@/components/ui/overlays'
import { SelectField, TextAreaField } from '@/components/ui/forms'
import { ReportIssueDialog } from '@/components/ReportIssueDialog'
import { ItemFormDialog } from '@/components/items/ItemFormDialog'
import { toast } from '@/store/appStore'

export function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError, refetch } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const updateItem = useUpdateItem()
  const archive = useArchiveItem()
  const [editOpen, setEditOpen] = useState(params.get('edit') === '1')
  const [conditionOpen, setConditionOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [condition, setCondition] = useState<ItemCondition>('good')
  const [conditionNote, setConditionNote] = useState('')

  const me = data ? getCurrentProfile(data) : undefined
  const item = useMemo(() => (data && id ? enrichItem(data, id) : undefined), [data, id])
  const history = useMemo(() => (data && id ? itemHistory(data, id) : []), [data, id])
  const reliability = data && item ? profileReliability(data, item.holderId) : { completed: 0, onTimeRate: 0 }
  const owner = data && item ? getProfile(data, item.ownerId) : undefined

  useEffect(() => {
    if (params.get('edit') === '1' && item) {
      setEditOpen(true)
      const next = new URLSearchParams(params)
      next.delete('edit')
      setParams(next, { replace: true })
    }
  }, [params, setParams, item])

  useEffect(() => {
    if (item) setCondition(item.condition)
  }, [item])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-2/3 max-w-md" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[440px] rounded-[var(--radius-lg)] lg:col-span-8" />
          <Skeleton className="h-[440px] rounded-[var(--radius-lg)] lg:col-span-4" />
        </div>
      </div>
    )
  }

  if (isError || !data || !item) {
    return (
      <EmptyState
        icon={Package}
        title="This item could not be found"
        description="It may not exist in the demo workspace, or the record was removed."
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => navigate('/items')}>
              Back to items
            </Button>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reload
            </Button>
          </div>
        }
      />
    )
  }

  const isHolder = item.holderId === me?.id
  const isOwner = item.ownerId === me?.id
  const canManage = isOwner || isHolder || me?.role === 'owner' || me?.role === 'admin'

  const saveCondition = async () => {
    try {
      await updateItem.mutateAsync({ itemId: item.id, patch: { condition } })
      setConditionOpen(false)
      setConditionNote('')
      toast.success('Condition updated', `${item.name} is now marked ${CONDITION_META[condition].label.toLowerCase()}.`)
    } catch {
      // The mutation hook surfaces the error.
    }
  }

  const archiveItem = () => {
    archive.mutate(item.id, {
      onSuccess: () => {
        setArchiveOpen(false)
        navigate('/items')
      },
    })
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/items', label: 'All items' }}
        eyebrow={
          <>
            <span className="font-mono text-[10px] tracking-[0.14em] text-faint">{item.serial}</span>
            <span className="h-3 w-px bg-line-strong" />
            <Badge tone={ITEM_STATUS[item.status].tone}>{ITEM_STATUS[item.status].label}</Badge>
            <DemoBadge compact />
          </>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            {item.name}
            {item.condition === 'damaged' && <Badge tone="danger">Needs care</Badge>}
          </span>
        }
        description={item.description || 'No description has been added for this item.'}
        actions={
          <>
            <Button variant="primary" icon={ArrowLeftRight} onClick={() => navigate(`/handoffs/new?itemId=${item.id}`)}>
              New handoff
            </Button>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Menu
              label="Item actions"
              items={[
                { label: 'Update condition', icon: Wrench, onClick: () => setConditionOpen(true) },
                { label: 'Report an issue', icon: TriangleAlert, onClick: () => setIssueOpen(true) },
                {
                  label: 'Archive item',
                  icon: Package,
                  danger: true,
                  separator: true,
                  disabled: Boolean(item.activeHandoff) || item.status === 'unavailable',
                  onClick: () => setArchiveOpen(true),
                },
              ]}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <section className="card overflow-hidden">
            <div className="flex flex-col sm:flex-row">
              <ImageWithFallback
                src={item.image}
                alt={item.name}
                className="h-56 w-full shrink-0 border-b border-line sm:h-auto sm:min-h-[260px] sm:w-[280px] sm:border-b-0 sm:border-r"
                iconSize={34}
              />
              <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{item.category}</Badge>
                  <ConditionPill condition={item.condition} />
                  {item.activeHandoff && <Badge tone="info">{item.activeHandoff.code} active</Badge>}
                </div>

                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  {item.description || 'No item notes were added. Add a description so the next holder knows what is included.'}
                </p>

                {item.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Tag size={11} className="text-faint" />
                    {item.tags.map((tag) => (
                      <span key={tag} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-3 pt-4">
                  <Fact icon={UserRound} label="Owner" value={item.ownerId === me?.id ? 'You' : item.owner.name} />
                  <Fact icon={UserRound} label="Current holder" value={item.holderId === me?.id ? 'You' : item.holder.name} />
                  <Fact icon={MapPin} label="Location" value={item.location} />
                  <Fact icon={CircleDollarSign} label="Value" value={formatCurrency(item.value)} />
                  <Fact icon={CalendarDays} label="Acquired" value={formatDate(item.acquiredAt, 'short')} />
                  <Fact icon={Clock3} label="Updated" value={relativeTime(item.updatedAt)} />
                </div>
              </div>
            </div>

            {item.images.length > 1 && (
              <div className="grid grid-cols-3 gap-px border-t border-line bg-line sm:grid-cols-5">
                {item.images.map((image, index) => (
                  <a
                    key={`${image.slice(-16)}-${index}`}
                    href={image}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative aspect-[4/3] overflow-hidden bg-surface"
                  >
                    <ImageWithFallback src={image} alt={`${item.name} photo ${index + 1}`} className="h-full w-full transition-transform duration-300 group-hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink">Condition</h2>
                <ConditionPill condition={item.condition} />
              </div>
              <div className="rounded-lg border border-line bg-surface-2/50 p-3.5">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[11.5px] font-medium text-ink">{CONDITION_META[item.condition].label}</p>
                    <p className="mt-0.5 text-[10.5px] text-faint">{CONDITION_META[item.condition].blurb}</p>
                  </div>
                  <span className="font-mono text-[19px] leading-none text-ink">
                    {CONDITION_META[item.condition].score}
                    <span className="text-[10px] text-faint">/5</span>
                  </span>
                </div>
                <ProgressBar value={(CONDITION_META[item.condition].score / 5) * 100} tone={CONDITION_META[item.condition].tone} className="mt-3" />
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
                Last changed {formatDateTime(item.updatedAt)}. Condition is recorded again on every receipt and return.
              </p>
              <Button variant="secondary" size="sm" icon={Wrench} className="mt-3" onClick={() => setConditionOpen(true)}>
                Update condition
              </Button>
            </section>

            <section className="card p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-medium text-ink">Holder trust record</h2>
                <ShieldCheck size={14} className="text-success" />
              </div>
              <div className="flex items-center gap-3">
                <Avatar profile={item.holder} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-ink">
                    {item.holderId === me?.id ? 'You' : item.holder.name}
                  </p>
                  <p className="truncate text-[10.5px] text-faint">{item.holder.title}</p>
                  <Link to={`/people?person=${item.holderId}`} className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted hover:text-accent">
                    View profile <ChevronRight size={10} />
                  </Link>
                </div>
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-surface-2/50 p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-faint">Completed</p>
                  <p className="mt-1 text-[18px] font-medium leading-none text-ink tabular">{reliability.completed}</p>
                </div>
                <div className="rounded-lg border border-line bg-surface-2/50 p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-faint">On-time</p>
                  <p className="mt-1 text-[18px] font-medium leading-none text-ink tabular">{reliability.onTimeRate}%</p>
                </div>
              </div>
              <p className="mt-2.5 text-[9.5px] leading-relaxed text-faint">
                Based only on completed handoffs in this workspace. A small sample is not a prediction.
              </p>
            </section>
          </div>

          <section className="card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-medium text-ink">Chain of custody</h2>
                <p className="mt-0.5 text-[10.5px] text-faint">Every handoff this item has been part of.</p>
              </div>
              <Button variant="secondary" size="sm" icon={ArrowLeftRight} onClick={() => navigate(`/handoffs/new?itemId=${item.id}`)}>
                Hand off again
              </Button>
            </div>
            {history.length === 0 ? (
              <EmptyState
                compact
                icon={ArrowLeftRight}
                title="No handoffs yet"
                description="This item has not moved. Create a handoff when it does, and the record will start here."
              />
            ) : (
              <div className="relative">
                <span className="absolute bottom-2 left-[15px] top-2 w-px bg-line" aria-hidden="true" />
                <div className="space-y-1">
                  {history.map((handoff) => (
                    <Link
                      key={handoff.id}
                      to={`/handoffs/${handoff.id}`}
                      className="group relative flex items-start gap-3 rounded-lg py-2 pl-0 pr-2 transition-colors hover:bg-surface-2/60"
                    >
                      <span
                        className={cn(
                          'relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-surface',
                          handoff.isOverdue ? 'border-danger/30 text-danger' : 'border-line text-muted',
                        )}
                      >
                        <ArrowLeftRight size={13} />
                      </span>
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10px] text-ink">{handoff.code}</span>
                          <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
                          {handoff.proof && <Badge tone="success">Proof</Badge>}
                        </div>
                        <p className="mt-1 text-[10.5px] text-muted">
                          {handoff.sender.name} → {handoff.receiver.name}
                        </p>
                        <p className={cn('mt-0.5 text-[9.5px]', handoff.isOverdue ? 'text-danger' : 'text-faint')}>
                          {formatDateTime(handoff.createdAt)}
                          {handoff.status === 'returned'
                            ? ' · closed'
                            : handoff.status === 'cancelled'
                              ? ' · cancelled'
                              : ` · ${dueLabel(handoff.dueAt)}`}
                        </p>
                      </div>
                      <ChevronRight size={14} className="mt-2 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          {item.activeHandoff ? (
            <section className="card overflow-hidden">
              <div className="border-b border-line bg-accent-soft px-4 py-3">
                <p className="flex items-center gap-2 text-[11px] font-medium text-ink">
                  <ArrowLeftRight size={13} className="text-accent" /> Active handoff
                </p>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-ink">{item.activeHandoff.code}</span>
                  <StatusBadge status={item.activeHandoff.status} overdue={item.activeHandoff.isOverdue} />
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar profile={item.activeHandoff.sender} size="sm" />
                    <span className="text-[11px] text-muted">{item.activeHandoff.sender.name}</span>
                    <ArrowRight size={11} className="text-faint" />
                    <Avatar profile={item.activeHandoff.receiver} size="sm" />
                    <span className="text-[11px] text-muted">{item.activeHandoff.receiver.name}</span>
                  </div>
                  <p className="text-[10.5px] text-faint">{item.activeHandoff.description}</p>
                  <p className={cn('text-[10.5px]', item.activeHandoff.isOverdue ? 'font-medium text-danger' : 'text-muted')}>
                    {dueLabel(item.activeHandoff.dueAt)} · {formatDate(item.activeHandoff.dueAt, 'short')}
                  </p>
                </div>
                <Link to={`/handoffs/${item.activeHandoff.id}`} className="btn btn-primary btn-sm mt-3 w-full">
                  Open handoff <ArrowRight size={12} />
                </Link>
              </div>
            </section>
          ) : (
            <section className="card p-4">
              <p className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
                <ShieldCheck size={14} className="text-success" /> Ready to move
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                There is no active handoff for this item. It can be handed off immediately.
              </p>
              <Button variant="primary" size="sm" icon={PackagePlus} className="mt-3 w-full" onClick={() => navigate(`/handoffs/new?itemId=${item.id}`)}>
                Create a handoff
              </Button>
            </section>
          )}

          <section className="card p-4">
            <p className="eyebrow mb-2.5 text-[8.5px]">Ownership</p>
            <div className="flex items-center gap-2.5">
              <Avatar profile={item.owner} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-ink">
                  {item.ownerId === me?.id ? 'You' : item.owner.name}
                </p>
                <p className="truncate text-[10px] text-faint">{owner?.email}</p>
              </div>
              <Link to={`/people?person=${item.ownerId}`} className="btn btn-ghost btn-icon btn-sm" aria-label="Open owner profile">
                <UserRound size={14} />
              </Link>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-line pt-3 font-mono text-[10px]">
              <Line label="Serial" value={item.serial} />
              <Line label="Category" value={item.category} />
              <Line label="Condition" value={CONDITION_META[item.condition].label} />
              <Line label="Added" value={formatDate(item.createdAt)} />
              <Line label="Holding since" value={formatDate(item.updatedAt)} />
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border border-line bg-surface-2/40 p-3.5">
            <p className="eyebrow mb-2 text-[8.5px]">Before you hand it off</p>
            <ul className="space-y-2 text-[10.5px] leading-relaxed text-muted">
              {[
                'Check the accessories listed in the description.',
                'Photograph any existing wear before it leaves.',
                'Agree a return date everyone can keep.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={Pencil} onClick={() => setEditOpen(true)}>
                Edit item
              </Button>
              <Button variant="ghost" size="sm" icon={FileText} onClick={() => setIssueOpen(true)}>
                Report issue
              </Button>
            </div>
          )}
        </aside>
      </div>

      <ItemFormDialog open={editOpen} onClose={() => setEditOpen(false)} item={item} />

      <Modal
        open={conditionOpen}
        onClose={() => setConditionOpen(false)}
        title="Update condition"
        description="Record the item's condition now. This changes the item record; historical handoffs keep their own snapshots."
        icon={Wrench}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setConditionOpen(false)} disabled={updateItem.isPending}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void saveCondition()} disabled={updateItem.isPending}>
              {updateItem.isPending ? 'Saving…' : 'Save condition'}
            </button>
          </>
        }
      >
        <div className="space-y-4 pb-1">
          <SelectField
            label="Condition"
            value={condition}
            onChange={(event) => setCondition(event.target.value as ItemCondition)}
            options={CONDITION_ORDER.map((value) => ({
              value,
              label: `${CONDITION_META[value].label} — ${CONDITION_META[value].blurb}`,
            }))}
          />
          <TextAreaField
            label="Context"
            optional
            value={conditionNote}
            onChange={(event) => setConditionNote(event.target.value)}
            placeholder="e.g. Light scuff on the base, otherwise working perfectly."
            hint="Kept in this dialog for your reference. The item history records the condition change."
            maxLength={300}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={archiveItem}
        title={`Archive ${item.name}?`}
        description="Archived items stay in the record but are no longer available to hand off. Return or cancel any active handoff first."
        confirmLabel="Archive item"
        cancelLabel="Keep available"
        loading={archive.isPending}
      />

      <ReportIssueDialog open={issueOpen} onClose={() => setIssueOpen(false)} handoffId={item.activeHandoff?.id} />
    </div>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={12} className="mt-0.5 shrink-0 text-faint" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-faint">{label}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted">{value}</p>
      </div>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-faint">{label}</span>
      <span className="truncate text-muted">{value}</span>
    </div>
  )
}


