import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleAlert,
  FileText,
  ImageIcon,
  Package,
  Send,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import type { z } from 'zod'
import type { ItemView } from '@/types'
import { newHandoffSchema } from '@/lib/validation'
import { useCreateHandoff, useWorkspace } from '@/hooks/useWorkspace'
import { enrichItem, getCurrentProfile } from '@/lib/selectors'
import {
  CONDITION_META,
  CONDITION_ORDER,
  cn,
  dateInputValue,
  dueLabel,
  formatDate,
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
  Skeleton,
} from '@/components/ui/primitives'
import { ImageDropzone, SearchField, SelectField, TextAreaField } from '@/components/ui/forms'
import { toast } from '@/store/appStore'

type Values = z.input<typeof newHandoffSchema>
type ValuesOutput = z.output<typeof newHandoffSchema>
type Step = 0 | 1 | 2 | 3

const STEPS = [
  { title: 'Item', description: 'What is moving' },
  { title: 'People', description: 'Sender and receiver' },
  { title: 'Details', description: 'Dates, condition, photos' },
  { title: 'Review', description: 'Confirm and send' },
]

export function NewHandoffPage() {
  const { data, isLoading } = useWorkspace()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const create = useCreateHandoff()
  const [step, setStep] = useState<Step>(0)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState<'send' | 'draft' | null>(null)

  const me = data ? getCurrentProfile(data) : undefined
  const defaultDue = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + 3)
    return dateInputValue(date)
  }, [])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<Values, unknown, ValuesOutput>({
    resolver: zodResolver(newHandoffSchema),
    mode: 'onTouched',
    defaultValues: {
      itemId: params.get('itemId') ?? '',
      senderId: me?.id ?? '',
      receiverId: params.get('receiverId') ?? '',
      teamId: '',
      description: '',
      instructions: '',
      conditionOut: 'good',
      dueAt: defaultDue,
      photos: [],
    },
  })

  const itemId = watch('itemId')
  const senderId = watch('senderId')
  const receiverId = watch('receiverId')
  const teamId = watch('teamId')
  const conditionOut = watch('conditionOut')
  const photos = watch('photos') ?? []
  const description = watch('description')
  const dueAt = watch('dueAt')

  const selectedItem = useMemo(
    () => (data && itemId ? enrichItem(data, itemId) : undefined),
    [data, itemId],
  )
  const sender = data?.profiles.find((profile) => profile.id === senderId)
  const receiver = data?.profiles.find((profile) => profile.id === receiverId)

  useEffect(() => {
    if (!senderId && me) setValue('senderId', me.id)
  }, [me, senderId, setValue])

  const items = useMemo(() => {
    if (!data) return [] as ItemView[]
    const views = data.items
      .map((item) => enrichItem(data, item.id))
      .filter((item): item is ItemView => Boolean(item))
    const q = search.trim().toLowerCase()
    if (!q) return views
    return views.filter((item) =>
      [item.name, item.category, item.serial, item.owner.name, item.holder.name, item.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [data, search])

  const stageValid = async (next: Step) => {
    const fieldsByStep: Record<Step, Array<keyof Values>> = {
      0: ['itemId'],
      1: ['senderId', 'receiverId'],
      2: ['description', 'dueAt', 'conditionOut', 'instructions'],
      3: [],
    }
    const valid = await trigger(fieldsByStep[step])
    if (valid) setStep(Math.min(next, 3) as Step)
  }

  const submit = (send: boolean) => {
    if (!selectedItem || !sender || !receiver) return
    setSubmitting(send ? 'send' : 'draft')
    create.mutate(
      {
        itemId: selectedItem.id,
        senderId: sender.id,
        receiverId: receiver.id,
        teamId: teamId || undefined,
        description,
        instructions: watch('instructions') ?? '',
        conditionOut,
        dueAt: new Date(`${dueAt}T18:00:00`).toISOString(),
        photos,
        send,
      },
      {
        onSuccess: (result) => {
          toast.success(
            send ? 'Handoff sent' : 'Draft saved',
            send
              ? `${receiver.name} has been asked to accept.`
              : 'Send it when the details are ready.',
          )
          navigate(`/handoffs/${result.handoff.id}`)
        },
        onSettled: () => setSubmitting(null),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-12 w-2/3 max-w-md" />
        <Skeleton className="h-[420px] rounded-[var(--radius-lg)]" />
      </div>
    )
  }

  if (!data || !me) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Your session is not available"
        description="Sign in again to create a handoff."
        action={
          <Button variant="primary" onClick={() => navigate('/signin')}>
            Sign in
          </Button>
        }
      />
    )
  }

  const canSend = Boolean(selectedItem && sender && receiver)

  return (
    <div>
      <PageHeader
        back={{ to: '/handoffs', label: 'All handoffs' }}
        eyebrow={
          <>
            <span className="eyebrow">New transfer</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Start a handoff<span className="text-accent">.</span>
          </>
        }
        description="Name the item, choose who is involved and record the condition you are handing over."
      />

      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {STEPS.map((entry, index) => {
          const active = step === index
          const complete = step > index
          return (
            <button
              key={entry.title}
              type="button"
              onClick={() => {
                if (index < step) setStep(index as Step)
              }}
              disabled={index > step}
              className={cn(
                'flex flex-col gap-1 rounded-lg border px-2.5 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:gap-2.5 sm:px-3',
                active
                  ? 'border-accent/40 bg-accent-soft'
                  : complete
                    ? 'border-line bg-surface-2/60 hover:border-line-strong'
                    : 'border-line bg-surface/40 opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]',
                  active
                    ? 'border-accent bg-accent text-accent-ink'
                    : complete
                      ? 'border-accent/30 bg-accent/10 text-accent'
                      : 'border-line-strong text-faint',
                )}
              >
                {complete ? <Check size={11} strokeWidth={2.6} /> : index + 1}
              </span>
              <span className="min-w-0">
                <span className={cn('block truncate text-[11.5px] font-medium', active ? 'text-ink' : 'text-muted')}>
                  {entry.title}
                </span>
                <span className="hidden truncate text-[9.5px] text-faint sm:block">{entry.description}</span>
              </span>
            </button>
          )
        })}
      </div>

      <form
        onSubmit={handleSubmit(() => submit(true))}
        className="grid gap-4 lg:grid-cols-12"
      >
        <div className="space-y-4 lg:col-span-8">
          {step === 0 && (
            <section className="card p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[13.5px] font-medium text-ink">Choose the item</h2>
                  <p className="mt-0.5 text-[11px] text-faint">Only items that are available or already in a handoff can be selected.</p>
                </div>
                <div className="w-full sm:w-[230px]">
                  <SearchField value={search} onChange={setSearch} placeholder="Search inventory…" />
                </div>
              </div>
              {items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No matching items"
                  description="Try a different search or add a new item to the inventory first."
                  compact
                  action={
                    <Button variant="secondary" size="sm" onClick={() => navigate('/items?add=1')}>
                      Add an item
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {items.map((item) => {
                    const active = itemId === item.id
                    const busy = Boolean(item.activeHandoff && item.activeHandoff.senderId !== senderId)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setValue('itemId', item.id, { shouldValidate: true })}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border p-3 text-left transition-all',
                          active
                            ? 'border-accent/50 bg-accent-soft'
                            : 'border-line bg-surface-2/35 hover:border-line-strong hover:bg-surface-2',
                        )}
                      >
                        <ImageWithFallback
                          src={item.image}
                          alt={item.name}
                          className="h-14 w-14 shrink-0 rounded-lg border border-line"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-[12px] font-medium text-ink">{item.name}</p>
                            {active && <Check size={14} className="shrink-0 text-accent" />}
                          </div>
                          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">{item.serial}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <ConditionPill condition={item.condition} showDot={false} />
                            <Badge tone={item.status === 'available' ? 'success' : 'info'}>
                              {item.status === 'available' ? 'Available' : item.status === 'in_handoff' ? 'In handoff' : 'Unavailable'}
                            </Badge>
                          </div>
                          {item.activeHandoff && (
                            <p className={cn('mt-1.5 line-clamp-1 text-[9px]', busy ? 'text-warn' : 'text-faint')}>
                              {busy
                                ? `Active: ${item.activeHandoff.code} with ${item.activeHandoff.receiver.name}`
                                : `${item.holder.id === me.id ? 'You hold it' : `Held by ${item.holder.name}`} · ${item.activeHandoff.code}`}
                            </p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {errors.itemId && <p className="field-error">{errors.itemId.message}</p>}
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="primary" iconRight={ArrowRight} onClick={() => void stageValid(1)} disabled={!itemId}>
                  Continue
                </Button>
              </div>
            </section>
          )}

          {step === 1 && (
            <>
              <section className="card p-4 sm:p-5">
                <h2 className="text-[13.5px] font-medium text-ink">Who is sending?</h2>
                <p className="mt-0.5 text-[11px] text-faint">This is the person accountable for handing the item over.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.profiles.map((profile) => {
                    const active = senderId === profile.id
                    const locked = me.role === 'member' && profile.id !== me.id
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          setValue('senderId', profile.id, { shouldValidate: true })
                          if (receiverId === profile.id) setValue('receiverId', '')
                        }}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                          active ? 'border-accent/50 bg-accent-soft' : 'border-line bg-surface-2/35 hover:bg-surface-2',
                          locked && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <Avatar profile={profile} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[11.5px] font-medium text-ink">
                            {profile.name} {profile.id === me.id && <Badge tone="accent">You</Badge>}
                          </p>
                          <p className="truncate text-[10px] text-faint">{profile.title}</p>
                        </div>
                        {active && <Check size={13} className="shrink-0 text-accent" />}
                      </button>
                    )
                  })}
                </div>
                {errors.senderId && <p className="field-error">{errors.senderId.message}</p>}
              </section>

              <section className="card p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[13.5px] font-medium text-ink">Who is receiving?</h2>
                    <p className="mt-0.5 text-[11px] text-faint">They will accept, then scan the QR to record proof.</p>
                  </div>
                  <UserRound size={18} className="text-faint" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.profiles
                    .filter((profile) => profile.id !== senderId)
                    .map((profile) => {
                      const active = receiverId === profile.id
                      return (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => setValue('receiverId', profile.id, { shouldValidate: true })}
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors',
                            active ? 'border-accent/50 bg-accent-soft' : 'border-line bg-surface-2/35 hover:bg-surface-2',
                          )}
                        >
                          <Avatar profile={profile} size="md" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11.5px] font-medium text-ink">{profile.name}</p>
                            <p className="truncate text-[10px] text-faint">{profile.title}</p>
                          </div>
                          {active && <Check size={13} className="shrink-0 text-accent" />}
                        </button>
                      )
                    })}
                </div>
                {errors.receiverId && <p className="field-error">{errors.receiverId.message}</p>}
                <div className="mt-4 flex justify-between">
                  <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => setStep(0)}>
                    Back
                  </Button>
                  <Button type="button" variant="primary" iconRight={ArrowRight} onClick={() => void stageValid(2)} disabled={!senderId || !receiverId}>
                    Continue
                  </Button>
                </div>
              </section>
            </>
          )}

          {step === 2 && (
            <section className="card p-4 sm:p-5">
              <h2 className="text-[13.5px] font-medium text-ink">Details of the handoff</h2>
              <p className="mt-0.5 text-[11px] text-faint">Context helps the receiver know what to do and when it is due back.</p>
              <div className="mt-4 space-y-4">
                <TextAreaField
                  label="What is this for?"
                  required
                  placeholder="e.g. Client sprint in Munich. Needs the Figma cache and the updated type test."
                  error={errors.description?.message}
                  maxLength={600}
                  showCount
                  {...register('description')}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="conditionOut">Condition at handoff</label>
                    <select id="conditionOut" className="select" {...register('conditionOut')}>
                      {CONDITION_ORDER.map((value) => (
                        <option key={value} value={value}>
                          {CONDITION_META[value].label} — {CONDITION_META[value].blurb}
                        </option>
                      ))}
                    </select>
                    {errors.conditionOut && <p className="field-error">{errors.conditionOut.message}</p>}
                  </div>
                  <div>
                    <label className="label" htmlFor="dueAt">Return by</label>
                    <div className="relative">
                      <input
                        id="dueAt"
                        type="date"
                        min={dateInputValue(new Date())}
                        className="input pr-10"
                        {...register('dueAt')}
                      />
                      <CalendarClock size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
                    </div>
                    {errors.dueAt ? (
                      <p className="field-error">{errors.dueAt.message}</p>
                    ) : (
                      <p className="field-hint">{dueAt ? dueLabel(new Date(`${dueAt}T18:00:00`)) : 'Choose a return date'}</p>
                    )}
                  </div>
                </div>

                <SelectField
                  label="Team"
                  optional
                  value={teamId}
                  options={[
                    { value: '', label: 'Personal handoff' },
                    ...data.teams.map((team) => ({ value: team.id, label: team.name })),
                  ]}
                  {...register('teamId')}
                  hint="Team handoffs are visible to everyone in that team."
                />

                <TextAreaField
                  label="Instructions for the receiver"
                  optional
                  placeholder="Chargers, accessories, access codes, where to return it — anything they should not have to ask about."
                  error={errors.instructions?.message}
                  maxLength={800}
                  showCount
                  {...register('instructions')}
                />

                <ImageDropzone
                  value={photos}
                  onChange={(next) => setValue('photos', next, { shouldValidate: true })}
                  max={6}
                  hint="Photographs of the current condition. They stay with the handoff record."
                />
                {errors.photos && <p className="field-error">{errors.photos.message}</p>}
              </div>
              <div className="mt-4 flex justify-between">
                <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button type="button" variant="primary" iconRight={ArrowRight} onClick={() => void stageValid(3)}>
                  Review
                </Button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="card overflow-hidden">
              <div className="border-b border-line px-4 py-4 sm:px-5">
                <h2 className="text-[13.5px] font-medium text-ink">Review the handoff</h2>
                <p className="mt-0.5 text-[11px] text-faint">Nothing is sent until you choose one of the buttons below.</p>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <ImageWithFallback
                    src={selectedItem?.image}
                    alt={selectedItem?.name ?? 'Item'}
                    className="h-16 w-16 shrink-0 rounded-xl border border-line"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{selectedItem?.name}</p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-faint">{selectedItem?.serial}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <ConditionPill condition={conditionOut} />
                      <Badge tone="neutral">{selectedItem?.category}</Badge>
                      {teamId && <Badge tone="violet">{data.teams.find((team) => team.id === teamId)?.name}</Badge>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                    <p className="eyebrow text-[8.5px]">From</p>
                    <div className="mt-2 flex items-center gap-2">
                      {sender && <Avatar profile={sender} size="sm" />}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-ink">{sender?.name}</p>
                        <p className="truncate text-[9.5px] text-faint">{sender?.title}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                    <p className="eyebrow text-[8.5px]">To</p>
                    <div className="mt-2 flex items-center gap-2">
                      {receiver && <Avatar profile={receiver} size="sm" />}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-ink">{receiver?.name}</p>
                        <p className="truncate text-[9.5px] text-faint">{receiver?.title}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                  <p className="eyebrow text-[8.5px]">Description</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted">{description}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5 font-mono text-[9px] uppercase tracking-wider text-faint">
                    <span className="flex items-center gap-1"><CalendarClock size={10} /> Due {formatDate(new Date(`${dueAt}T18:00:00`))}</span>
                    <span className="flex items-center gap-1"><ImageIcon size={10} /> {photos.length} photos</span>
                    <span className="flex items-center gap-1"><Users size={10} /> {teamId ? 'Team visible' : 'Private'}</span>
                  </div>
                </div>

                {photos.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {photos.slice(0, 4).map((photo, index) => (
                      <ImageWithFallback key={index} src={photo} alt={`Condition ${index + 1}`} className="aspect-square rounded-lg border border-line" />
                    ))}
                  </div>
                )}

                <div className="rounded-lg border border-warn/25 bg-warn/8 px-3 py-2.5 text-[10.5px] leading-relaxed text-warn">
                  <span className="flex items-start gap-2">
                    <Sparkles size={13} className="mt-0.5 shrink-0" />
                    Return risk is an estimate. It is computed from due date, condition photos and recorded return history. It
                    will never be shown as a fact.
                  </span>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <Button type="button" variant="ghost" icon={ArrowLeft} onClick={() => setStep(2)}>
                  Back
                </Button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="secondary"
                    icon={FileText}
                    loading={submitting === 'draft'}
                    disabled={!canSend || submitting !== null}
                    onClick={() => submit(false)}
                  >
                    Save as draft
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    icon={Send}
                    loading={submitting === 'send'}
                    disabled={!canSend || submitting !== null}
                  >
                    Send request
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <div className="card p-4">
            <p className="eyebrow mb-3">Live summary</p>
            <div className="space-y-3">
              <SummaryLine icon={Package} label="Item" value={selectedItem?.name} placeholder="Not chosen" />
              <SummaryLine icon={UserRound} label="Sender" value={sender?.name} placeholder="Not chosen" />
              <SummaryLine icon={UserRound} label="Receiver" value={receiver?.name} placeholder="Not chosen" />
              <SummaryLine icon={CalendarClock} label="Return by" value={dueAt ? formatDate(new Date(`${dueAt}T18:00:00`)) : undefined} placeholder="Not chosen" />
              <SummaryLine icon={ImageIcon} label="Photos" value={photos.length ? `${photos.length} attached` : 'None yet'} />
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={13} className="text-accent" />
              <p className="text-[11.5px] font-medium text-ink">What happens next</p>
            </div>
            <ol className="mt-3 space-y-2.5">
              {[
                'The receiver accepts the request.',
                'You hand over the item together.',
                'The receiver scans the QR to record proof and condition.',
                'They return it, and you confirm the return to close the chain.',
              ].map((entry, index) => (
                <li key={entry} className="flex gap-2.5 text-[10.5px] leading-relaxed text-faint">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[8px] text-muted">
                    {index + 1}
                  </span>
                  {entry}
                </li>
              ))}
            </ol>
            <Link to="/scan" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-medium text-accent hover:underline">
              Preview the scanner <ChevronRight size={11} />
            </Link>
          </div>

          {selectedItem?.activeHandoff && selectedItem.activeHandoff.senderId !== senderId && (
            <div className="rounded-xl border border-warn/25 bg-warn/8 p-3.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-warn">
                <CircleAlert size={12} /> This item is already moving
              </p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-warn/90">
                It is part of {selectedItem.activeHandoff.code} until that handoff closes. Creating a second transfer with a
                different sender will be rejected.
              </p>
              <Link to={`/handoffs/${selectedItem.activeHandoff.id}`} className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-medium text-warn hover:underline">
                Open current handoff <ChevronRight size={11} />
              </Link>
            </div>
          )}
        </aside>
      </form>

      {create.isError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/8 px-3 py-2.5 text-[11.5px] text-danger">
          <CircleAlert size={14} className="mt-0.5 shrink-0" />
          {create.error.message}
        </div>
      )}
    </div>
  )
}

function SummaryLine({
  icon: Icon,
  label,
  value,
  placeholder,
}: {
  icon: typeof Package
  label: string
  value?: string
  placeholder?: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-faint">
        <Icon size={11} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-medium uppercase tracking-wider text-faint">{label}</p>
        <p className={cn('mt-0.5 truncate text-[11px]', value ? 'font-medium text-ink' : 'text-faint')}>
          {value ?? placeholder ?? '—'}
        </p>
      </div>
    </div>
  )
}
