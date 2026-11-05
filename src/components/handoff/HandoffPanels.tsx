import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  FileCheck2,
  History,
  Info,
  MapPin,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { HandoffView } from '@/types'
import {
  CONDITION_META,
  EVENT_META,
  cn,
  dueLabel,
  formatDate,
  formatDateTime,
  relativeTime,
  toneColor,
  toneStyle,
} from '@/lib/utils'
import { Avatar, Badge, ConditionPill, ImageWithFallback, ProgressBar, RiskPill } from '@/components/ui/primitives'

/* ------------------------------- Timeline -------------------------------- */

export function HandoffTimeline({ handoff, limit = 8 }: { handoff: HandoffView; limit?: number }) {
  const [expanded, setExpanded] = useState(false)
  const events = useMemo(
    () => [...handoff.events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [handoff.events],
  )
  const shown = expanded ? events : events.slice(0, limit)
  const actorFor = (actorId: string) => {
    if (actorId === handoff.sender.id) return handoff.sender
    if (actorId === handoff.receiver.id) return handoff.receiver
    return handoff.sender
  }

  return (
    <div>
      <ol className="relative space-y-0">
        {shown.map((event, index) => {
          const meta = EVENT_META[event.type]
          const actor = actorFor(event.actorId)
          return (
            <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < shown.length - 1 && (
                <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-line" aria-hidden="true" />
              )}
              <span
                className="relative z-10 flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full border"
                style={toneStyle(meta.tone)}
              >
                <EventIcon type={event.type} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[12px] font-medium text-ink">{meta.label}</span>
                  <span className="text-[10.5px] text-faint">by {actor.id === handoff.sender.id && actor.id === handoff.receiver.id ? actor.name : actor.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-faint">
                    {relativeTime(event.createdAt)}
                  </span>
                </div>
                {event.note && (
                  <p className="mt-1 rounded-lg border border-line bg-surface-2/50 px-2.5 py-2 text-[11px] leading-relaxed text-muted">
                    {event.note}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] text-faint" title={formatDateTime(event.createdAt)}>
                    {formatDate(event.createdAt, 'short')}
                  </span>
                  {event.meta?.condition && <ConditionPill condition={event.meta.condition as HandoffView['conditionOut']} showDot={false} />}
                  {event.meta?.method && (
                    <Badge tone="neutral">
                      {event.meta.method === 'qr' ? <Camera size={10} /> : <FileCheck2 size={10} />}
                      {event.meta.method === 'qr' ? 'QR scan' : 'Code verification'}
                    </Badge>
                  )}
                  {event.meta?.offline === 'true' && <Badge tone="warn">Recorded offline</Badge>}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {events.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted transition-colors hover:text-accent"
        >
          <History size={12} />
          {expanded ? 'Show recent only' : `Show all ${events.length} events`}
          <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

function EventIcon({ type }: { type: HandoffView['events'][number]['type'] }) {
  if (type === 'issue_reported') return <TriangleAlert size={13} />
  if (type === 'qr_scanned') return <Camera size={13} />
  if (type === 'received' || type === 'completed' || type === 'returned') return <CheckCircle2 size={13} />
  if (type === 'requested' || type === 'accepted') return <ArrowRight size={13} />
  if (type === 'proof_uploaded') return <ShieldCheck size={13} />
  return <Info size={13} />
}

/* ----------------------------- Condition diff ----------------------------- */

export function ConditionCompare({ handoff }: { handoff: HandoffView }) {
  const out = CONDITION_META[handoff.conditionOut]
  const incoming = handoff.conditionIn ? CONDITION_META[handoff.conditionIn] : null
  const changed = Boolean(handoff.conditionIn && handoff.conditionIn !== handoff.conditionOut)

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <ConditionTile
          label="At handoff"
          condition={handoff.conditionOut}
          date={handoff.receivedAt ? undefined : formatDate(handoff.createdAt, 'short')}
        />
        <ConditionTile
          label="At return"
          condition={handoff.conditionIn}
          date={handoff.receivedAt ? formatDate(handoff.receivedAt, 'short') : undefined}
          empty="Not recorded yet"
        />
      </div>
      <div
        className={cn(
          'mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[10.5px] leading-relaxed',
          changed
            ? 'border-warn/25 bg-warn/8 text-warn'
            : 'border-line bg-surface-2/50 text-faint',
        )}
      >
        {changed ? <TriangleAlert size={13} className="mt-0.5 shrink-0" /> : <Info size={13} className="mt-0.5 shrink-0" />}
        {changed ? (
          <span>
            Condition moved from <strong className="font-medium text-ink">{out.label}</strong> to{' '}
            <strong className="font-medium text-ink">{incoming?.label}</strong>. An issue note is the right next step if
            this was not expected.
          </span>
        ) : handoff.conditionIn ? (
          <span>Condition was recorded consistently at handoff and receipt.</span>
        ) : (
          <span>The receiving condition is recorded only when the receiver confirms with proof.</span>
        )}
      </div>
    </div>
  )
}

function ConditionTile({
  label,
  condition,
  date,
  empty,
}: {
  label: string
  condition?: HandoffView['conditionOut']
  date?: string
  empty?: string
}) {
  const meta = condition ? CONDITION_META[condition] : null
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow text-[8.5px]">{label}</span>
        {date && <span className="font-mono text-[8.5px] text-faint">{date}</span>}
      </div>
      {meta ? (
        <>
          <div className="mt-2">
            <ConditionPill condition={condition!} />
          </div>
          <p className="mt-2 text-[9.5px] leading-relaxed text-faint">{meta.blurb}</p>
        </>
      ) : (
        <p className="mt-2 text-[11px] text-faint">{empty ?? 'No condition recorded'}</p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Risk                                     */
/* -------------------------------------------------------------------------- */

export function RiskPanel({ handoff }: { handoff: HandoffView }) {
  const tone = handoff.risk.level === 'high' ? 'danger' : handoff.risk.level === 'medium' ? 'warn' : 'success'
  return (
    <div className="rounded-xl border border-line bg-surface-2/40 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-accent" />
          <span className="text-[11.5px] font-medium text-ink">Return risk</span>
        </div>
        <RiskPill risk={handoff.risk} />
      </div>
      <div className="mt-3">
        <ProgressBar value={handoff.risk.score} tone={tone} />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10.5px] text-muted">{handoff.risk.headline}</span>
          <span className="font-mono text-[9.5px] text-faint">{handoff.risk.score}/100</span>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {handoff.risk.factors.map((factor) => (
          <li key={factor} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-faint">
            <span
              className="mt-[5px] h-1 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: toneColor[tone] }}
            />
            {factor}
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-line pt-2.5 text-[9.5px] leading-relaxed text-faint">
        <strong className="font-medium text-muted">Estimate only.</strong> Calculated from due dates, recorded history and
        condition — never presented as a guarantee.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  Summary                                   */
/* -------------------------------------------------------------------------- */

export function HandoffMeta({ handoff }: { handoff: HandoffView }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <MetaCell icon={CalendarClock} label="Return due" value={dueLabel(handoff.dueAt)} danger={handoff.isOverdue} />
      <MetaCell icon={MapPin} label="Location" value={handoff.item.location} />
      <MetaCell icon={ShieldCheck} label="Proof" value={proofLabel(handoff)} />
      <MetaCell icon={History} label="Last movement" value={relativeTime(handoff.updatedAt)} />
    </div>
  )
}

function proofLabel(handoff: HandoffView) {
  if (!handoff.proof) return 'Not recorded'
  if (handoff.proof.type === 'qr') return 'QR scan verified'
  if (handoff.proof.type === 'manual') return 'Code verified'
  return 'Proof attached'
}

function MetaCell({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: typeof CalendarClock
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/40 px-2.5 py-2">
      <span className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wider text-faint">
        <Icon size={10} /> {label}
      </span>
      <p className={cn('mt-1 truncate text-[11px] font-medium', danger ? 'text-danger' : 'text-ink')} title={value}>
        {value}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                   Proof                                    */
/* -------------------------------------------------------------------------- */

export function ProofCard({ handoff }: { handoff: HandoffView }) {
  if (!handoff.proof) {
    return (
      <div className="rounded-xl border border-dashed border-line-strong/70 bg-surface-2/30 p-4 text-center">
        <ShieldCheck size={18} className="mx-auto text-faint" strokeWidth={1.5} />
        <p className="mt-2 text-[11.5px] font-medium text-muted">No digital proof yet</p>
        <p className="mt-1 text-[10px] leading-relaxed text-faint">
          The receiver adds proof by scanning the handoff QR or verifying the code.
        </p>
      </div>
    )
  }
  const proof = handoff.proof
  const submitter = proof.submittedById === handoff.receiver.id ? handoff.receiver : handoff.sender
  return (
    <div className="overflow-hidden rounded-xl border border-success/20 bg-success/[0.035]">
      <div className="flex items-center gap-2 border-b border-success/15 px-3 py-2.5">
        <ShieldCheck size={13} className="text-success" />
        <span className="text-[11px] font-medium text-ink">Digital proof</span>
        <Badge tone="success" className="ml-auto">
          {proof.type === 'qr' ? 'QR verified' : 'Code verified'}
        </Badge>
      </div>
      <div className="space-y-2.5 p-3">
        <div className="flex items-center gap-2">
          <Avatar profile={submitter} size="xs" />
          <div className="min-w-0">
            <p className="truncate text-[10.5px] text-ink">{submitter.name}</p>
            <p className="font-mono text-[9px] text-faint">{formatDateTime(proof.createdAt)}</p>
          </div>
          <ConditionPill condition={proof.condition} />
        </div>
        {proof.note && <p className="text-[10.5px] leading-relaxed text-muted">“{proof.note}”</p>}
        {proof.photo && (
          <ImageWithFallback src={proof.photo} alt="Receipt proof" className="h-28 w-full rounded-lg border border-line" />
        )}
        <p className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-wider text-faint">
          <ShieldCheck size={9} /> {proof.ipHint ?? 'Recorded on device'}
        </p>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*                                  QR link                                   */
/* -------------------------------------------------------------------------- */

export function HandoffQRInline({ handoff }: { handoff: HandoffView }) {
  return (
    <Link
      to={`/scan?code=${handoff.code}`}
      className="group flex items-center gap-3 rounded-xl border border-accent/25 bg-accent-soft p-3 transition-colors hover:border-accent/40"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-ink">
        <Camera size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-medium text-ink">Open the scanner</span>
        <span className="mt-0.5 block text-[10px] text-muted">Verify {handoff.code} in person</span>
      </span>
      <ArrowRight size={14} className="text-accent transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
