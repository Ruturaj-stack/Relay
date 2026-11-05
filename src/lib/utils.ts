import type {
  EventType,
  Handoff,
  HandoffStatus,
  ItemCategory,
  ItemCondition,
  NotificationType,
  ReturnRisk,
  TeamRole,
  WorkspaceRole,
} from '@/types'

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function uid(prefix = 'id') {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 12)
  return `${prefix}_${random ?? Math.random().toString(36).slice(2, 14)}`
}

export function codes(n = 5) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/* ---------------------------------- Dates --------------------------------- */

export function nowIso() {
  return new Date().toISOString()
}

export function offsetIso(options: { days?: number; hours?: number; minutes?: number; from?: Date }) {
  const base = options.from ? new Date(options.from) : new Date()
  base.setDate(base.getDate() + (options.days ?? 0))
  base.setHours(base.getHours() + (options.hours ?? 0))
  base.setMinutes(base.getMinutes() + (options.minutes ?? 0))
  return base.toISOString()
}

export function startOfDay(date: Date | string) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a: Date | string, b: Date | string) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function formatDate(date: string | Date, style: 'long' | 'medium' | 'short' = 'medium') {
  const d = new Date(date)
  if (style === 'long')
    return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
  if (style === 'short') return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
}

export function formatTime(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(date))
}

export function formatDateTime(date: string | Date) {
  return `${formatDate(date, 'short')} · ${formatTime(date)}`
}

export function formatMonth(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(date))
}

export function relativeTime(date: string | Date) {
  const value = new Date(date).getTime()
  const diff = value - Date.now()
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < 60_000) return 'just now'
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute')
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour')
  if (abs < 2_592_000_000) return rtf.format(Math.round(diff / 86_400_000), 'day')
  if (abs < 31_536_000_000) return rtf.format(Math.round(diff / 2_592_000_000), 'month')
  return rtf.format(Math.round(diff / 31_536_000_000), 'year')
}

export function dueLabel(date: string | Date) {
  const target = startOfDay(date).getTime()
  const today = startOfDay(new Date()).getTime()
  const diffDays = Math.round((target - today) / 86_400_000)
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays === -1) return '1 day overdue'
  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`
  if (diffDays < 7) return `Due in ${diffDays} days`
  return `Due ${formatDate(date, 'short')}`
}

export function dayHeading(date: string | Date) {
  const d = new Date(date)
  if (isSameDay(d, new Date())) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(d)
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const minutes = Math.round(ms / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

export function averageDuration(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function daysBetween(a: string | Date, b: string | Date) {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000)
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function dateInputValue(date?: string | Date | null) {
  if (!date) return ''
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* -------------------------------- Identity -------------------------------- */

export function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function firstName(name: string) {
  return name.split(' ')[0]
}

export function rosterLabel(ids: string[], names: string[]) {
  if (!ids.length) return names.join(', ')
  if (ids.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} +${ids.length - 2}`
}

/* ---------------------------------- Money --------------------------------- */

export function formatCurrency(value?: number) {
  if (value === undefined) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/* -------------------------------- Metadata -------------------------------- */

export type Tone = 'accent' | 'info' | 'warn' | 'danger' | 'success' | 'violet' | 'neutral'

export const toneColor: Record<Tone, string> = {
  accent: 'var(--accent)',
  info: 'var(--info)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  success: 'var(--success)',
  violet: 'var(--violet)',
  neutral: 'var(--muted)',
}

export function toneStyle(tone: Tone, subtle = true) {
  const color = toneColor[tone]
  return {
    color: tone === 'accent' ? 'var(--accent)' : color,
    backgroundColor: subtle ? `color-mix(in srgb, ${color} 11%, transparent)` : undefined,
    borderColor: subtle ? `color-mix(in srgb, ${color} 22%, transparent)` : undefined,
  }
}

export const HANDOFF_STATUS: Record<HandoffStatus, { label: string; short: string; tone: Tone; description: string }> = {
  draft: {
    label: 'Draft',
    short: 'Draft',
    tone: 'neutral',
    description: 'Prepared but not yet sent to the receiver.',
  },
  requested: {
    label: 'Requested',
    short: 'Requested',
    tone: 'accent',
    description: 'Waiting for the receiver to accept the handoff request.',
  },
  awaiting_confirmation: {
    label: 'Awaiting scan',
    short: 'Awaiting',
    tone: 'warn',
    description: 'Accepted. Waiting for the receiver to scan the QR and confirm receipt.',
  },
  in_transit: {
    label: 'In transit',
    short: 'In transit',
    tone: 'info',
    description: 'The item is on its way. Receipt has not been confirmed yet.',
  },
  received: {
    label: 'In possession',
    short: 'Received',
    tone: 'success',
    description: 'The receiver confirmed receipt with a digital proof.',
  },
  returned: {
    label: 'Returned',
    short: 'Returned',
    tone: 'violet',
    description: 'The item has been returned and the handoff chain is complete.',
  },
  cancelled: {
    label: 'Cancelled',
    short: 'Cancelled',
    tone: 'neutral',
    description: 'This handoff was cancelled before completion.',
  },
}

export const OVERDUE_META = { label: 'Overdue', short: 'Overdue', tone: 'danger' as Tone }

export function getDisplayStatus(handoff: Handoff, isOverdue: boolean) {
  if (isOverdue) return { ...OVERDUE_META, key: 'overdue' as const, description: 'The return date has passed.' }
  const meta = HANDOFF_STATUS[handoff.status]
  return { ...meta, key: handoff.status, description: meta.description }
}

export const ACTIVE_STATUSES: HandoffStatus[] = ['requested', 'awaiting_confirmation', 'in_transit', 'received']
export const ATTENTION_STATUSES: HandoffStatus[] = ['requested', 'awaiting_confirmation']

export function computeOverdue(handoff: Handoff, now = new Date()) {
  if (handoff.status !== 'received' && handoff.status !== 'in_transit' && handoff.status !== 'awaiting_confirmation')
    return false
  return new Date(handoff.dueAt).getTime() < now.getTime()
}

export const CONDITION_META: Record<ItemCondition, { label: string; tone: Tone; score: number; blurb: string }> = {
  excellent: { label: 'Excellent', tone: 'success', score: 5, blurb: 'Like new, no visible wear' },
  good: { label: 'Good', tone: 'accent', score: 4, blurb: 'Light wear, fully functional' },
  fair: { label: 'Fair', tone: 'warn', score: 3, blurb: 'Visible wear, works as expected' },
  worn: { label: 'Worn', tone: 'warn', score: 2, blurb: 'Heavy cosmetic wear' },
  damaged: { label: 'Damaged', tone: 'danger', score: 1, blurb: 'Needs attention or repair' },
}

export const CONDITION_ORDER: ItemCondition[] = ['excellent', 'good', 'fair', 'worn', 'damaged']

export const ITEM_STATUS: Record<string, { label: string; tone: Tone }> = {
  available: { label: 'Available', tone: 'success' },
  in_handoff: { label: 'In handoff', tone: 'info' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
}

export const CATEGORIES: ItemCategory[] = [
  'Computing',
  'Photo & Video',
  'Audio',
  'Access',
  'Documents',
  'Field Gear',
  'Other',
]

export const EVENT_META: Record<EventType, { label: string; tone: Tone; sentence: string }> = {
  created: { label: 'Handoff created', tone: 'neutral', sentence: 'created this handoff' },
  requested: { label: 'Request sent', tone: 'accent', sentence: 'sent the handoff request' },
  accepted: { label: 'Request accepted', tone: 'accent', sentence: 'accepted the handoff request' },
  declined: { label: 'Request declined', tone: 'danger', sentence: 'declined the handoff request' },
  qr_scanned: { label: 'QR code scanned', tone: 'violet', sentence: 'scanned the handoff QR code' },
  handed_over: { label: 'Item handed over', tone: 'info', sentence: 'marked the item as in transit' },
  received: { label: 'Receipt confirmed', tone: 'success', sentence: 'confirmed receipt of the item' },
  condition_updated: { label: 'Condition updated', tone: 'warn', sentence: 'updated the item condition' },
  return_requested: { label: 'Return started', tone: 'info', sentence: 'started the return handoff' },
  returned: { label: 'Item returned', tone: 'violet', sentence: 'confirmed the item was returned' },
  completed: { label: 'Handoff completed', tone: 'success', sentence: 'closed the handoff chain' },
  cancelled: { label: 'Handoff cancelled', tone: 'neutral', sentence: 'cancelled the handoff' },
  note: { label: 'Note added', tone: 'neutral', sentence: 'added a note' },
  issue_reported: { label: 'Issue reported', tone: 'danger', sentence: 'reported an issue' },
  proof_uploaded: { label: 'Proof uploaded', tone: 'violet', sentence: 'attached digital proof' },
}

export const NOTIFICATION_META: Record<NotificationType, { label: string; tone: Tone }> = {
  handoff_request: { label: 'Handoff request', tone: 'accent' },
  confirmation: { label: 'Confirmation', tone: 'success' },
  return_reminder: { label: 'Return reminder', tone: 'warn' },
  overdue: { label: 'Overdue', tone: 'danger' },
  team_invite: { label: 'Team', tone: 'violet' },
  system: { label: 'System', tone: 'neutral' },
  issue: { label: 'Issue', tone: 'danger' },
}

export const TEAM_ROLE_META: Record<TeamRole, { label: string; tone: Tone; rank: number }> = {
  owner: { label: 'Owner', tone: 'accent', rank: 4 },
  admin: { label: 'Admin', tone: 'violet', rank: 3 },
  member: { label: 'Member', tone: 'neutral', rank: 2 },
  viewer: { label: 'Viewer', tone: 'neutral', rank: 1 },
}

export function roleLabel(role: WorkspaceRole) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function canManageTeam(role: TeamRole | undefined) {
  return role === 'owner' || role === 'admin'
}

/* ------------------------------- Return risk ------------------------------- */

interface RiskContext {
  receiverHistory?: Handoff[]
  now?: Date
}

/**
 * Deliberately transparent heuristic. It is presented to users as an estimate,
 * never as an actual fact. Uses real signals from the workspace's recorded data.
 */
export function estimateReturnRisk(handoff: Handoff, context: RiskContext = {}): ReturnRisk {
  const now = context.now ?? new Date()
  const due = new Date(handoff.dueAt).getTime()
  const dayMs = 86_400_000
  const daysToDue = Math.ceil((due - now.getTime()) / dayMs)
  const factors: string[] = []
  let score = 14

  if (handoff.status === 'received' || handoff.status === 'in_transit' || handoff.status === 'awaiting_confirmation') {
    if (daysToDue < 0) {
      score += 48
      factors.push(`${Math.abs(daysToDue)} day${Math.abs(daysToDue) === 1 ? '' : 's'} past the agreed return date`)
    } else if (daysToDue <= 1) {
      score += 24
      factors.push('Return is due within 24 hours')
    } else if (daysToDue <= 3) {
      score += 12
      factors.push(`Due in ${daysToDue} days`)
    } else {
      factors.push(`Comfortable runway — due in ${daysToDue} days`)
    }
  } else {
    score -= 6
    factors.push('Receipt has not been confirmed yet')
  }

  const history = context.receiverHistory ?? []
  const returns = history.filter((h) => h.receiverId === handoff.receiverId && h.status === 'returned' && h.returnedAt)
  const lateReturns = returns.filter((h) => h.returnedAt && new Date(h.returnedAt).getTime() > new Date(h.dueAt).getTime())
  if (returns.length >= 2) {
    const onTimeRate = Math.round(((returns.length - lateReturns.length) / returns.length) * 100)
    if (onTimeRate >= 90) {
      score -= 10
      factors.push(`${onTimeRate}% on-time return record`)
    } else if (onTimeRate < 70) {
      score += 14
      factors.push(`${lateReturns.length} late return${lateReturns.length === 1 ? '' : 's'} on record`)
    } else {
      factors.push(`${onTimeRate}% on-time return record`)
    }
  } else {
    factors.push('Limited return history for this receiver')
  }

  if (handoff.conditionOut === 'fair' || handoff.conditionOut === 'worn') {
    score += 6
    factors.push('Item was already showing wear at handoff')
  }
  if (handoff.photos.length === 0) {
    score += 5
    factors.push('No condition photographs attached')
  } else {
    factors.push('Condition photographs on file')
  }

  score = Math.max(4, Math.min(96, score))
  if (score >= 62)
    return {
      level: 'high',
      score,
      headline: 'High return risk',
      detail: 'Several signals suggest this return may need a nudge.',
      factors,
    }
  if (score >= 33)
    return {
      level: 'medium',
      score,
      headline: 'Worth watching',
      detail: 'A few small signals suggest a follow-up could help.',
      factors,
    }
  return {
    level: 'low',
    score,
    headline: 'Low return risk',
    detail: 'Timing and history look healthy for this handoff.',
    factors,
  }
}

/* ----------------------------------- QR ----------------------------------- */

export function handoffQrValue(code: string, token: string) {
  return `relay://handoff/${code}?token=${token}`
}

export function handoffLink(code: string, token: string) {
  return `${window.location.origin}/scan?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`
}

export interface ParsedScan {
  code: string
  token?: string
  raw: string
}

export function parseScanValue(raw: string): ParsedScan | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^relay:\/\/handoff\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed.replace(/^relay:/, 'https:'))
      const segments = url.pathname.split('/').filter(Boolean)
      const code = segments[segments.length - 1]
      if (!/^H-[A-Z0-9]{4,8}$/i.test(code)) return null
      return { code: code.toUpperCase(), token: url.searchParams.get('token') ?? undefined, raw: trimmed }
    } catch {
      return null
    }
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.pathname.startsWith('/scan')) {
        const code = url.searchParams.get('code')
        if (!code) return null
        return { code: code.toUpperCase(), token: url.searchParams.get('token') ?? undefined, raw: trimmed }
      }
      return null
    } catch {
      return null
    }
  }
  if (/^H-[A-Z0-9]{4,8}$/i.test(trimmed)) return { code: trimmed.toUpperCase(), raw: trimmed }
  if (/^[A-Z0-9]{5,8}$/i.test(trimmed)) return { code: `H-${trimmed.toUpperCase()}`, raw: trimmed }
  return null
}

export function normalizeCode(value: string) {
  const parsed = parseScanValue(value)
  return parsed?.code ?? null
}

/* ---------------------------------- Files --------------------------------- */

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/') && file.size <= 8 * 1024 * 1024
}

export function downloadBlob(content: BlobPart, filename: string, type = 'text/plain') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = dataUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const escape = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h] ?? '')).join(','))].join('\n')
}

export function pct(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural
}
