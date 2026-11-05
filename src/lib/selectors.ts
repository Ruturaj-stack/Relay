import type {
  DemoDatabase,
  Handoff,
  HandoffEvent,
  HandoffStatus,
  HandoffView,
  ItemView,
  Notification,
  Profile,
  ReturnRisk,
  Team,
  TeamMember,
  TeamRole,
  EventType,
} from '@/types'
import {
  ACTIVE_STATUSES,
  averageDuration,
  computeOverdue,
  estimateReturnRisk,
  formatDate,
  formatMonth,
  pct,
  startOfDay,
} from '@/lib/utils'

export function getProfile(db: DemoDatabase, id?: string | null): Profile | undefined {
  if (!id) return undefined
  return db.profiles.find((profile) => profile.id === id)
}

export function getCurrentProfile(db: DemoDatabase): Profile | undefined {
  return getProfile(db, db.currentUserId)
}

export function getItem(db: DemoDatabase, id: string) {
  return db.items.find((item) => item.id === id)
}

export function getTeam(db: DemoDatabase, id?: string) {
  if (!id) return undefined
  return db.teams.find((team) => team.id === id)
}

export function enrichHandoff(db: DemoDatabase, handoff: Handoff): HandoffView {
  const item = getItem(db, handoff.itemId) ?? db.items[0]
  const sender = getProfile(db, handoff.senderId) ?? db.profiles[0]
  const receiver = getProfile(db, handoff.receiverId) ?? db.profiles[1]
  const isOverdue = computeOverdue(handoff)
  const risk = estimateReturnRisk(handoff, { receiverHistory: db.handoffs })
  return {
    ...handoff,
    item,
    sender,
    receiver,
    team: getTeam(db, handoff.teamId),
    isOverdue,
    risk,
    needsMyAction: needsMyAction(handoff, db.currentUserId),
  }
}

export function needsMyAction(handoff: Handoff, currentUserId: string | null | undefined) {
  if (!currentUserId) return false
  if (handoff.status === 'requested' && handoff.receiverId === currentUserId) return true
  if (
    (handoff.status === 'awaiting_confirmation' || handoff.status === 'in_transit') &&
    handoff.receiverId === currentUserId
  )
    return true
  if (handoff.status === 'draft' && handoff.senderId === currentUserId) return true
  if (handoff.status === 'received' && computeOverdue(handoff) && handoff.senderId === currentUserId) return true
  if (handoff.status === 'received' && computeOverdue(handoff) && handoff.receiverId === currentUserId) return true
  return false
}

export function enrichItem(db: DemoDatabase, itemId: string): ItemView | undefined {
  const item = getItem(db, itemId)
  if (!item) return undefined
  const owner = getProfile(db, item.ownerId)
  const holder = getProfile(db, item.holderId)
  if (!owner || !holder) return undefined
  const activeHandoff = db.handoffs
    .filter(
      (handoff) =>
        handoff.itemId === item.id &&
        (ACTIVE_STATUSES.includes(handoff.status) || handoff.status === 'draft'),
    )
    .map((handoff) => enrichHandoff(db, handoff))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  return { ...item, owner, holder, activeHandoff }
}

export function allHandoffViews(db: DemoDatabase): HandoffView[] {
  return db.handoffs
    .map((handoff) => enrichHandoff(db, handoff))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export interface HandoffQuery {
  status?: HandoffStatus | 'all' | 'active' | 'attention'
  search?: string
  sort?: 'newest' | 'due' | 'oldest'
  personId?: string
  itemId?: string
  currentUserId?: string | null
}

export function queryHandoffs(db: DemoDatabase, query: HandoffQuery = {}): HandoffView[] {
  let list = allHandoffViews(db)
  const status = query.status ?? 'all'
  if (status === 'active') list = list.filter((handoff) => ACTIVE_STATUSES.includes(handoff.status))
  else if (status === 'attention')
    list = list.filter((handoff) => handoff.needsMyAction || handoff.isOverdue)
  else if (status !== 'all') list = list.filter((handoff) => handoff.status === status)

  if (query.personId) {
    list = list.filter(
      (handoff) => handoff.senderId === query.personId || handoff.receiverId === query.personId,
    )
  }
  if (query.itemId) list = list.filter((handoff) => handoff.itemId === query.itemId)
  if (query.currentUserId) {
    list = list.filter(
      (handoff) =>
        handoff.senderId === query.currentUserId ||
        handoff.receiverId === query.currentUserId ||
        (handoff.teamId && isTeamMember(db, handoff.teamId, query.currentUserId!)),
    )
  }

  if (query.search?.trim()) {
    const search = query.search.trim().toLowerCase()
    list = list.filter((handoff) => {
      const haystack = [
        handoff.item.name,
        handoff.code,
        handoff.description,
        handoff.sender.name,
        handoff.receiver.name,
        handoff.item.serial,
        handoff.team?.name ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }

  if (query.sort === 'due')
    list.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
  else if (query.sort === 'oldest')
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return list
}

export function getHandoffView(db: DemoDatabase, idOrCode: string): HandoffView | undefined {
  const handoff = db.handoffs.find(
    (entry) => entry.id === idOrCode || entry.code.toLowerCase() === idOrCode.toLowerCase(),
  )
  return handoff ? enrichHandoff(db, handoff) : undefined
}

export function getHandoffByCodeOrToken(db: DemoDatabase, code: string, token?: string) {
  const handoff = db.handoffs.find(
    (entry) => entry.code.toLowerCase() === code.toLowerCase() || entry.id === code,
  )
  if (!handoff) return { handoff: undefined, valid: false, reason: 'No handoff matches that code.' as string }
  if (token && handoff.token !== token)
    return { handoff, valid: false, reason: 'The QR token does not match this handoff.' }
  return { handoff, valid: true }
}

export function isTeamMember(db: DemoDatabase, teamId: string, profileId: string) {
  const team = getTeam(db, teamId)
  return Boolean(team?.members.some((member) => member.profileId === profileId))
}

export function getTeamRole(db: DemoDatabase, teamId: string, profileId: string): TeamRole | undefined {
  return getTeam(db, teamId)?.members.find((member) => member.profileId === profileId)?.role
}

export interface TeamView extends Team {
  memberProfiles: Array<Profile & { role: TeamRole; joinedAt: string }>
  activeHandoffs: number
  itemsCount: number
  pendingInvites: number
}

export function teamViews(db: DemoDatabase): TeamView[] {
  return db.teams.map((team) => {
    const memberProfiles = team.members
      .map((member) => {
        const profile = getProfile(db, member.profileId)
        return profile ? { ...profile, role: member.role, joinedAt: member.joinedAt } : null
      })
      .filter((entry): entry is Profile & TeamMember => Boolean(entry))
    const activeHandoffs = db.handoffs.filter(
      (handoff) => handoff.teamId === team.id && ACTIVE_STATUSES.includes(handoff.status),
    ).length
    const itemsCount = db.items.filter(
      (item) =>
        team.members.some((member) => member.profileId === item.holderId) ||
        team.members.some((member) => member.profileId === item.ownerId),
    ).length
    const pendingInvites = db.invitations.filter(
      (invite) => invite.teamId === team.id && invite.status === 'pending',
    ).length
    return { ...team, memberProfiles, activeHandoffs, itemsCount, pendingInvites }
  })
}

export function getTeamView(db: DemoDatabase, teamId: string) {
  return teamViews(db).find((team) => team.id === teamId)
}

export function notificationList(db: DemoDatabase, userId = db.currentUserId) {
  if (!userId) return []
  return db.notifications
    .filter((notification) => notification.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function unreadCount(db: DemoDatabase, userId = db.currentUserId) {
  return notificationList(db, userId).filter((notification) => !notification.read).length
}

export interface ActivityEntry {
  event: HandoffEvent
  handoff: HandoffView
  actor: Profile
}

export function activityFeed(
  db: DemoDatabase,
  options: { limit?: number; type?: EventType | 'all'; actorId?: string; days?: number; handoffId?: string } = {},
): ActivityEntry[] {
  const cutoff = options.days ? Date.now() - options.days * 86_400_000 : 0
  const entries: ActivityEntry[] = []
  for (const handoff of db.handoffs) {
    if (options.handoffId && handoff.id !== options.handoffId) continue
    const view = enrichHandoff(db, handoff)
    for (const event of handoff.events) {
      if (options.type && options.type !== 'all' && event.type !== options.type) continue
      if (options.actorId && event.actorId !== options.actorId) continue
      if (new Date(event.createdAt).getTime() < cutoff) continue
      const actor = getProfile(db, event.actorId) ?? db.profiles[0]
      entries.push({ event, handoff: view, actor })
    }
  }
  entries.sort((a, b) => new Date(b.event.createdAt).getTime() - new Date(a.event.createdAt).getTime())
  return options.limit ? entries.slice(0, options.limit) : entries
}

export interface DashboardStats {
  active: number
  inPossession: number
  pendingConfirmations: number
  overdue: number
  completed: number
  dueSoon: HandoffView[]
  needsAction: HandoffView[]
  activeChange: number
  totalCompletedRange: number
}

export function dashboardStats(db: DemoDatabase, days = 30): DashboardStats {
  const me = db.currentUserId
  const now = Date.now()
  const cutoff = now - days * 86_400_000
  const views = db.handoffs.map((handoff) => enrichHandoff(db, handoff))
  const active = views.filter((handoff) => ACTIVE_STATUSES.includes(handoff.status))
  const inPossession = db.items.filter((item) => item.holderId === me).length
  const pendingConfirmations = views.filter(
    (handoff) =>
      handoff.status === 'awaiting_confirmation' ||
      (handoff.status === 'in_transit' && handoff.receiverId === me),
  ).length
  const overdue = views.filter((handoff) => handoff.isOverdue).length
  const completed = views.filter((handoff) => handoff.status === 'returned').length
  const completedInRange = views.filter(
    (handoff) => handoff.status === 'returned' && handoff.returnedAt && new Date(handoff.returnedAt).getTime() >= cutoff,
  ).length
  const previousCutoff = cutoff - days * 86_400_000
  const previousCompleted = views.filter(
    (handoff) =>
      handoff.status === 'returned' &&
      handoff.returnedAt &&
      new Date(handoff.returnedAt).getTime() >= previousCutoff &&
      new Date(handoff.returnedAt).getTime() < cutoff,
  ).length
  const activeChange = previousCompleted ? Math.round(((completedInRange - previousCompleted) / previousCompleted) * 100) : 0
  const dueSoon = active
    .filter((handoff) => handoff.status !== 'requested')
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    .slice(0, 5)
  const needsAction = views.filter((handoff) => handoff.needsMyAction)
  return {
    active: active.length,
    inPossession,
    pendingConfirmations,
    overdue,
    completed,
    dueSoon,
    needsAction,
    activeChange,
    totalCompletedRange: completedInRange,
  }
}

export interface ActivityPoint {
  key: string
  label: string
  created: number
  completed: number
  due: number
}

export function activitySeries(db: DemoDatabase, days = 30): ActivityPoint[] {
  const bucketDays = days <= 14 ? 1 : days <= 45 ? 3 : 7
  const buckets = Math.ceil(days / bucketDays)
  const now = startOfDay(new Date())
  const points: ActivityPoint[] = []
  for (let index = buckets - 1; index >= 0; index--) {
    const end = new Date(now)
    end.setDate(end.getDate() - index * bucketDays)
    const start = new Date(end)
    start.setDate(start.getDate() - bucketDays + 1)
    const startTime = start.getTime()
    const endTime = end.getTime() + 86_400_000
    const created = db.handoffs.filter((handoff) => {
      const t = new Date(handoff.createdAt).getTime()
      return t >= startTime && t < endTime
    }).length
    const completed = db.handoffs.filter((handoff) => {
      if (!handoff.returnedAt) return false
      const t = new Date(handoff.returnedAt).getTime()
      return t >= startTime && t < endTime
    }).length
    const due = db.handoffs.filter((handoff) => {
      const t = new Date(handoff.dueAt).getTime()
      return t >= startTime && t < endTime && ACTIVE_STATUSES.includes(handoff.status)
    }).length
    points.push({
      key: end.toISOString(),
      label: formatDate(end, 'short'),
      created,
      completed,
      due,
    })
  }
  return points
}

export interface MonthlyPoint {
  key: string
  label: string
  created: number
  completed: number
  returnedLate: number
}

export function monthlySeries(db: DemoDatabase, months = 6): MonthlyPoint[] {
  const points: MonthlyPoint[] = []
  const now = new Date()
  for (let index = months - 1; index >= 0; index--) {
    const d = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const created = db.handoffs.filter((handoff) => {
      const t = new Date(handoff.createdAt).getTime()
      return t >= start && t < end
    }).length
    const completed = db.handoffs.filter((handoff) => {
      if (!handoff.returnedAt) return false
      const t = new Date(handoff.returnedAt).getTime()
      return t >= start && t < end
    }).length
    const returnedLate = db.handoffs.filter((handoff) => {
      if (!handoff.returnedAt) return false
      const t = new Date(handoff.returnedAt).getTime()
      return t >= start && t < end && new Date(handoff.returnedAt).getTime() > new Date(handoff.dueAt).getTime()
    }).length
    points.push({ key: d.toISOString(), label: formatMonth(d), created, completed, returnedLate })
  }
  return points
}

export interface AnalyticsSummary {
  total: number
  completed: number
  avgDurationMs: number
  overdueRate: number
  active: number
  overdue: number
  totalValue: number
  topItems: Array<{ id: string; name: string; image: string; count: number }>
  teamActivity: Array<{ id: string; name: string; color: string; count: number }>
  statusBreakdown: Array<{ status: HandoffStatus; label: string; count: number }>
  monthly: MonthlyPoint[]
  returnOnTimeRate: number
  avgResponseHours: number
}

export function analyticsSummary(db: DemoDatabase, days = 90): AnalyticsSummary {
  const cutoff = Date.now() - days * 86_400_000
  const inRange = db.handoffs.filter((handoff) => new Date(handoff.createdAt).getTime() >= cutoff)
  const completedInRange = inRange.filter((handoff) => handoff.status === 'returned' && handoff.returnedAt)
  const completedAll = db.handoffs.filter((handoff) => handoff.status === 'returned' && handoff.returnedAt)
  const durations = completedInRange
    .filter((handoff) => handoff.returnedAt)
    .map((handoff) => new Date(handoff.returnedAt!).getTime() - new Date(handoff.createdAt).getTime())
  const activeViews = db.handoffs.filter((handoff) => ACTIVE_STATUSES.includes(handoff.status))
  const overdue = activeViews.filter((handoff) => computeOverdue(handoff)).length
  const onTime = completedAll.filter(
    (handoff) => handoff.returnedAt && new Date(handoff.returnedAt).getTime() <= new Date(handoff.dueAt).getTime(),
  ).length
  const responseHours = completedAll
    .filter((handoff) => handoff.acceptedAt)
    .map(
      (handoff) =>
        (new Date(handoff.acceptedAt!).getTime() - new Date(handoff.requestedAt ?? handoff.createdAt).getTime()) /
        3_600_000,
    )

  const itemCounts = new Map<string, number>()
  for (const handoff of inRange) itemCounts.set(handoff.itemId, (itemCounts.get(handoff.itemId) ?? 0) + 1)
  const topItems = [...itemCounts.entries()]
    .map(([id, count]) => {
      const item = getItem(db, id)
      return item ? { id, name: item.name, image: item.image, count } : null
    })
    .filter((entry): entry is { id: string; name: string; image: string; count: number } => Boolean(entry))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const teamCounts = new Map<string, number>()
  for (const handoff of inRange) {
    if (!handoff.teamId) continue
    teamCounts.set(handoff.teamId, (teamCounts.get(handoff.teamId) ?? 0) + 1)
  }
  const teamActivity = db.teams
    .map((team) => ({ id: team.id, name: team.name, color: team.color, count: teamCounts.get(team.id) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  const statusOrder: HandoffStatus[] = [
    'draft',
    'requested',
    'awaiting_confirmation',
    'in_transit',
    'received',
    'returned',
    'cancelled',
  ]
  const statusBreakdown = statusOrder.map((status) => ({
    status,
    label:
      status === 'received'
        ? 'In possession'
        : status === 'awaiting_confirmation'
          ? 'Awaiting scan'
          : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
    count: db.handoffs.filter((handoff) => handoff.status === status).length,
  }))

  const totalValue = db.items.reduce((sum, item) => sum + (item.value ?? 0), 0)

  return {
    total: inRange.length,
    completed: completedInRange.length,
    avgDurationMs: averageDuration(durations),
    overdueRate: pct(overdue, activeViews.length),
    active: activeViews.length,
    overdue,
    totalValue,
    topItems,
    teamActivity,
    statusBreakdown,
    monthly: monthlySeries(db, days > 180 ? 12 : 6),
    returnOnTimeRate: pct(onTime, completedAll.length),
    avgResponseHours: averageDuration(responseHours) || 0,
  }
}

export function itemHistory(db: DemoDatabase, itemId: string) {
  return db.handoffs
    .filter((handoff) => handoff.itemId === itemId)
    .map((handoff) => enrichHandoff(db, handoff))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function riskFor(handoff: Handoff, db: DemoDatabase): ReturnRisk {
  return estimateReturnRisk(handoff, { receiverHistory: db.handoffs })
}

export function upcomingReturns(db: DemoDatabase): HandoffView[] {
  return allHandoffViews(db)
    .filter((handoff) => ['received', 'in_transit', 'awaiting_confirmation'].includes(handoff.status))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
}

export function searchWorkspace(db: DemoDatabase, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return { handoffs: [], items: [], people: [], teams: [] }
  return {
    handoffs: allHandoffViews(db)
      .filter((handoff) =>
        [handoff.item.name, handoff.code, handoff.description, handoff.sender.name, handoff.receiver.name]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
      .slice(0, 5),
    items: db.items
      .filter((item) =>
        [item.name, item.serial, item.category, item.tags.join(' ')].join(' ').toLowerCase().includes(q),
      )
      .slice(0, 4),
    people: db.profiles
      .filter((profile) =>
        [profile.name, profile.email, profile.title, profile.handle].join(' ').toLowerCase().includes(q),
      )
      .slice(0, 4),
    teams: db.teams
      .filter((team) => [team.name, team.description].join(' ').toLowerCase().includes(q))
      .slice(0, 3),
  }
}

export function notificationTypes(notifications: Notification[]) {
  const counts = new Map<string, number>()
  for (const notification of notifications) {
    counts.set(notification.type, (counts.get(notification.type) ?? 0) + 1)
  }
  return counts
}

export function nextHandoffCode(db: DemoDatabase) {
  const numbers = db.handoffs
    .map((handoff) => Number(handoff.code.replace(/\D/g, '')))
    .filter((value) => Number.isFinite(value))
  const next = Math.max(2047, ...numbers) + 1
  return `H-${next}`
}

export function activeHandoffsForTeam(db: DemoDatabase, teamId: string) {
  return allHandoffViews(db)
    .filter((handoff) => handoff.teamId === teamId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function profileReliability(db: DemoDatabase, profileId: string) {
  const completed = db.handoffs.filter((handoff) => handoff.receiverId === profileId && handoff.status === 'returned')
  const onTime = completed.filter(
    (handoff) => handoff.returnedAt && new Date(handoff.returnedAt).getTime() <= new Date(handoff.dueAt).getTime(),
  )
  return { completed: completed.length, onTimeRate: pct(onTime.length, completed.length) }
}
