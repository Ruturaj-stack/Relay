export type ID = string

export type Theme = 'dark' | 'light'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

export type ItemCondition = 'excellent' | 'good' | 'fair' | 'worn' | 'damaged'

export type ItemStatus = 'available' | 'in_handoff' | 'unavailable'

export type ItemCategory =
  | 'Computing'
  | 'Photo & Video'
  | 'Audio'
  | 'Access'
  | 'Documents'
  | 'Field Gear'
  | 'Other'

export type HandoffStatus =
  | 'draft'
  | 'requested'
  | 'awaiting_confirmation'
  | 'in_transit'
  | 'received'
  | 'returned'
  | 'cancelled'

export type EventType =
  | 'created'
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'qr_scanned'
  | 'handed_over'
  | 'received'
  | 'condition_updated'
  | 'return_requested'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'note'
  | 'issue_reported'
  | 'proof_uploaded'

export type NotificationType =
  | 'handoff_request'
  | 'confirmation'
  | 'return_reminder'
  | 'overdue'
  | 'team_invite'
  | 'system'
  | 'issue'

export type ProofType = 'qr' | 'manual' | 'photo' | 'signature'

export interface Profile {
  id: ID
  name: string
  email: string
  handle: string
  title: string
  phone?: string
  avatar?: string
  accent: string
  timezone: string
  role: WorkspaceRole
  joinedAt: string
  lastActiveAt: string
}

export interface TeamMember {
  profileId: ID
  role: TeamRole
  joinedAt: string
}

export interface Team {
  id: ID
  name: string
  description: string
  color: string
  icon: string
  members: TeamMember[]
  createdAt: string
}

export interface Item {
  id: ID
  name: string
  description: string
  category: ItemCategory
  serial: string
  ownerId: ID
  holderId: ID
  status: ItemStatus
  condition: ItemCondition
  image: string
  images: string[]
  tags: string[]
  location: string
  value?: number
  acquiredAt: string
  createdAt: string
  updatedAt: string
}

export interface HandoffEvent {
  id: ID
  handoffId: ID
  type: EventType
  actorId: ID
  createdAt: string
  note?: string
  meta?: Record<string, string>
}

export interface HandoffProof {
  id: ID
  type: ProofType
  submittedById: ID
  createdAt: string
  condition: ItemCondition
  note?: string
  photo?: string
  ipHint?: string
}

export interface Handoff {
  id: ID
  code: string
  token: string
  itemId: ID
  senderId: ID
  receiverId: ID
  teamId?: ID
  status: HandoffStatus
  description: string
  instructions: string
  conditionOut: ItemCondition
  conditionIn?: ItemCondition
  dueAt: string
  createdAt: string
  updatedAt: string
  requestedAt?: string
  acceptedAt?: string
  receivedAt?: string
  returnedAt?: string
  cancelledAt?: string
  photos: string[]
  proof?: HandoffProof
  events: HandoffEvent[]
  pendingSync?: boolean
  createdOffline?: boolean
}

export interface ReturnRisk {
  /** Estimated — never presented as an actual measurement. */
  level: 'low' | 'medium' | 'high'
  score: number
  headline: string
  detail: string
  factors: string[]
}

export interface HandoffView extends Handoff {
  item: Item
  sender: Profile
  receiver: Profile
  team?: Team
  isOverdue: boolean
  risk: ReturnRisk
  needsMyAction: boolean
}

export interface ItemView extends Item {
  owner: Profile
  holder: Profile
  activeHandoff?: HandoffView
}

export interface Notification {
  id: ID
  userId: ID
  type: NotificationType
  title: string
  body: string
  href: string
  read: boolean
  createdAt: string
  handoffId?: ID
}

export interface Invitation {
  id: ID
  teamId: ID
  email: string
  role: TeamRole
  invitedById: ID
  status: 'pending' | 'accepted' | 'expired'
  createdAt: string
}

export interface Organization {
  id: ID
  name: string
  slug: string
  plan: 'studio' | 'team' | 'personal'
  createdAt: string
}

export interface DemoDatabase {
  version: number
  organization: Organization
  profiles: Profile[]
  teams: Team[]
  items: Item[]
  handoffs: Handoff[]
  notifications: Notification[]
  invitations: Invitation[]
  currentUserId: ID | null
  seededAt: string
}

export interface SessionUser {
  id: ID
  name: string
  email: string
  avatar?: string
}

export interface HandoffFilters {
  status?: HandoffStatus | 'all' | 'active' | 'attention'
  search?: string
  sort?: 'newest' | 'due' | 'oldest'
  personId?: ID
}

export interface ItemFilters {
  category?: ItemCategory | 'all'
  status?: ItemStatus | 'all'
  search?: string
  sort?: 'name' | 'recent' | 'condition'
}

export interface AnalyticsRange {
  label: string
  days: number
  bucket: 'day' | 'week' | 'month'
}

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  title: string
  description?: string
  variant: ToastVariant
  action?: { label: string; href?: string; onClick?: () => void }
}

export interface OfflineOperation {
  id: string
  kind: 'handoff.create' | 'handoff.status' | 'item.create' | 'proof.attach' | 'issue.report'
  payload: Record<string, unknown>
  createdAt: string
  attempts: number
  status: 'pending' | 'syncing' | 'failed'
  error?: string
  idempotencyKey: string
}

export interface AppNotificationPreferences {
  handoffRequests: boolean
  confirmations: boolean
  returnReminders: boolean
  overdue: boolean
  teamActivity: boolean
  emailDigest: boolean
  pushEnabled: boolean
}

export interface HandoffPayload {
  version: 1
  code: string
  token: string
  itemId: string
}
