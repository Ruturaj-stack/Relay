import type {
  DemoDatabase,
  Handoff,
  HandoffEvent,
  HandoffStatus,
  Item,
  ItemCondition,
  Notification,
  Team,
  TeamRole,
  WorkspaceRole,
} from '@/types'
import { loadDatabase, resetDatabase, setDemoUser, updateDatabase } from '@/lib/demoDb'
import { enqueueOperation } from '@/lib/offline'
import { getCurrentProfile, getHandoffView, getProfile, getItem, getTeam, nextHandoffCode } from '@/lib/selectors'
import { codes, nowIso, sleep, uid } from '@/lib/utils'

export class ApiError extends Error {
  code: string
  constructor(message: string, code = 'api_error') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

async function latency(base = 160) {
  if (!isOnline()) return
  await sleep(base + Math.random() * 140)
}

function requireCurrentUser(db: DemoDatabase) {
  const user = getCurrentProfile(db)
  if (!user) throw new ApiError('Your session has expired. Sign in again.', 'unauthorized')
  return user
}

function createEvent(
  handoffId: string,
  type: HandoffEvent['type'],
  actorId: string,
  note?: string,
  meta?: Record<string, string>,
): HandoffEvent {
  return { id: uid('ev'), handoffId, type, actorId, createdAt: nowIso(), note, meta }
}

function pushNotification(
  db: DemoDatabase,
  notification: Omit<Notification, 'id' | 'createdAt' | 'read'> & { createdAt?: string; read?: boolean },
) {
  db.notifications.unshift({
    ...notification,
    id: uid('notif'),
    read: notification.read ?? false,
    createdAt: notification.createdAt ?? nowIso(),
  })
}

export interface CreateHandoffInput {
  itemId: string
  senderId: string
  receiverId: string
  teamId?: string
  description: string
  instructions?: string
  conditionOut: ItemCondition
  dueAt: string
  photos: string[]
  send: boolean
}

export interface HandoffMutationResult {
  handoff: Handoff
  offline: boolean
}

/* --------------------------------- Queries -------------------------------- */

export async function fetchWorkspace(): Promise<DemoDatabase> {
  await latency(110)
  try {
    return structuredClone(loadDatabase())
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : 'The workspace could not be loaded.',
      'workspace_load_failed',
    )
  }
}

export async function validateHandoffCode(code: string, token?: string) {
  await latency(220)
  const db = loadDatabase()
  const handoff = db.handoffs.find(
    (entry) => entry.code.toLowerCase() === code.toLowerCase() || entry.id === code,
  )
  if (!handoff) throw new ApiError('That code does not match any handoff in this workspace.', 'scan_not_found')
  if (token && handoff.token !== token) throw new ApiError('The QR token is invalid or has expired.', 'scan_invalid')
  if (handoff.status === 'cancelled') throw new ApiError('This handoff was cancelled.', 'scan_cancelled')
  if (handoff.status === 'returned')
    throw new ApiError('This handoff is already complete. No further confirmation is needed.', 'scan_complete')
  if (handoff.status === 'draft') throw new ApiError('This handoff has not been sent yet.', 'scan_draft')
  return getHandoffView(db, handoff.id)!
}

/* ------------------------------- Handoffs -------------------------------- */

export async function createHandoff(input: CreateHandoffInput): Promise<HandoffMutationResult> {
  await latency(260)
  const offline = !isOnline()
  let created: Handoff | null = null
  const idempotencyKey = `handoff.create:${uid('key')}`

  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const sender = getProfile(db, input.senderId)
    const receiver = getProfile(db, input.receiverId)
    const item = getItem(db, input.itemId)
    if (!sender) throw new ApiError('The selected sender no longer exists.', 'sender_missing')
    if (!receiver) throw new ApiError('The selected receiver no longer exists.', 'receiver_missing')
    if (!item) throw new ApiError('The selected item no longer exists.', 'item_missing')
    if (sender.id === receiver.id) throw new ApiError('Sender and receiver need to be different people.', 'same_person')
    if (!input.description.trim()) throw new ApiError('Add a short description for the receiver.', 'validation')
    if (!input.dueAt || Number.isNaN(new Date(input.dueAt).getTime()))
      throw new ApiError('Choose a valid return date.', 'validation')
    if (sender.id !== user.id && user.role === 'member')
      throw new ApiError('You can only create handoffs you are sending.', 'forbidden')
    const active = db.handoffs.find(
      (handoff) =>
        handoff.itemId === item.id &&
        ['requested', 'awaiting_confirmation', 'in_transit', 'received'].includes(handoff.status),
    )
    if (active && active.senderId !== sender.id)
      throw new ApiError(`${item.name} is already in an active handoff (${active.code}).`, 'item_busy')

    const now = nowIso()
    const id = uid('handoff')
    const code = nextHandoffCode(db)
    const events: HandoffEvent[] = []
    const handoff: Handoff = {
      id,
      code,
      token: uid('tk'),
      itemId: item.id,
      senderId: sender.id,
      receiverId: receiver.id,
      teamId: input.teamId,
      status: input.send ? 'requested' : 'draft',
      description: input.description.trim(),
      instructions: input.instructions?.trim() ?? '',
      conditionOut: input.conditionOut,
      dueAt: new Date(input.dueAt).toISOString(),
      createdAt: now,
      updatedAt: now,
      requestedAt: input.send ? now : undefined,
      photos: input.photos,
      events,
      pendingSync: offline,
      createdOffline: offline,
    }
    events.push(createEvent(id, 'created', user.id, input.send ? 'Handoff created and prepared for sending.' : 'Draft handoff created.'))
    if (input.send) {
      events.push(
        createEvent(id, 'requested', user.id, `Request sent to ${receiver.name}.`, {
          due: new Date(input.dueAt).toISOString(),
          ...(offline ? { offline: 'true' } : {}),
        }),
      )
      pushNotification(db, {
        userId: receiver.id,
        type: 'handoff_request',
        title: `${user.name} requested ${item.name}`,
        body: input.description.slice(0, 140),
        href: `/handoffs/${id}`,
        handoffId: id,
      })
      item.status = 'in_handoff'
      item.holderId = sender.id
      item.updatedAt = now
    }
    db.handoffs.unshift(handoff)
    created = handoff
  })

  if (!created) throw new ApiError('The handoff could not be created.', 'create_failed')
  const createdHandoff: Handoff = created
  if (offline) {
    await enqueueOperation('handoff.create', { handoffId: createdHandoff.id, code: createdHandoff.code }, idempotencyKey)
  }
  return { handoff: structuredClone(createdHandoff), offline }
}

export type HandoffAction =
  | 'send'
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'transit'
  | 'receive'
  | 'start_return'
  | 'confirm_return'
  | 'note'
  | 'issue'

export interface HandoffActionInput {
  handoffId: string
  action: HandoffAction
  note?: string
  condition?: ItemCondition
  photo?: string
  method?: 'qr' | 'manual'
  actorId?: string
}

const ACTOR_FIELD: Partial<Record<HandoffAction, 'sender' | 'receiver'>> = {
  send: 'sender',
  decline: 'receiver',
  accept: 'receiver',
  cancel: 'sender',
  transit: 'sender',
  receive: 'receiver',
  start_return: 'receiver',
  confirm_return: 'sender',
}

export async function updateHandoff(input: HandoffActionInput): Promise<HandoffMutationResult> {
  await latency(200)
  const offline = !isOnline()
  let updated: Handoff | null = null
  const idempotencyKey = `handoff.${input.action}:${input.handoffId}:${Date.now()}`

  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const handoff = db.handoffs.find((entry) => entry.id === input.handoffId)
    if (!handoff) throw new ApiError('This handoff no longer exists.', 'not_found')
    const actorIsSender = handoff.senderId === user.id
    const actorIsReceiver = handoff.receiverId === user.id
    if (!actorIsSender && !actorIsReceiver && user.role !== 'owner' && user.role !== 'admin')
      throw new ApiError('You do not have access to this handoff.', 'forbidden')
    const who = ACTOR_FIELD[input.action]
    if (who === 'receiver' && !actorIsReceiver)
      throw new ApiError('Only the receiver can do that.', 'forbidden')
    if (who === 'sender' && !actorIsSender) throw new ApiError('Only the sender can do that.', 'forbidden')

    const now = nowIso()
    const item = getItem(db, handoff.itemId)
    const sender = getProfile(db, handoff.senderId)
    const receiver = getProfile(db, handoff.receiverId)

    const transition = (status: HandoffStatus) => {
      handoff.status = status
      handoff.updatedAt = now
      if (offline) handoff.pendingSync = true
    }

    switch (input.action) {
      case 'send': {
        if (handoff.status !== 'draft') throw new ApiError('This handoff has already been sent.', 'invalid_state')
        if (!sender || !receiver) throw new ApiError('The people on this handoff are unavailable.', 'missing_person')
        transition('requested')
        handoff.requestedAt = now
        handoff.events.push(createEvent(handoff.id, 'requested', user.id, `Request sent to ${receiver.name}.`))
        pushNotification(db, {
          userId: receiver.id,
          type: 'handoff_request',
          title: `${sender.name} requested ${item?.name ?? 'an item'}`,
          body: handoff.description.slice(0, 140),
          href: `/handoffs/${handoff.id}`,
          handoffId: handoff.id,
        })
        if (item) {
          item.status = 'in_handoff'
          item.holderId = sender.id
          item.updatedAt = now
        }
        break
      }
      case 'accept': {
        if (handoff.status !== 'requested') throw new ApiError('This request is no longer open.', 'invalid_state')
        transition('awaiting_confirmation')
        handoff.acceptedAt = now
        handoff.events.push(createEvent(handoff.id, 'accepted', user.id, `${user.name} accepted the request.`))
        if (sender)
          pushNotification(db, {
            userId: sender.id,
            type: 'confirmation',
            title: `${user.name} accepted the ${item?.name ?? 'handoff'}`,
            body: 'Collect the item together and have the receiver scan the QR to confirm receipt.',
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        break
      }
      case 'decline': {
        if (handoff.status !== 'requested') throw new ApiError('This request is no longer open.', 'invalid_state')
        transition('cancelled')
        handoff.cancelledAt = now
        handoff.events.push(createEvent(handoff.id, 'declined', user.id, input.note || 'Request declined.'))
        if (sender)
          pushNotification(db, {
            userId: sender.id,
            type: 'system',
            title: `${user.name} declined the ${item?.name ?? 'handoff'}`,
            body: input.note || 'Open the handoff for details.',
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        if (item && item.status === 'in_handoff') item.status = 'available'
        break
      }
      case 'cancel': {
        if (['returned', 'cancelled'].includes(handoff.status))
          throw new ApiError('This handoff is already closed.', 'invalid_state')
        transition('cancelled')
        handoff.cancelledAt = now
        handoff.events.push(createEvent(handoff.id, 'cancelled', user.id, input.note || 'Handoff cancelled by sender.'))
        if (receiver)
          pushNotification(db, {
            userId: receiver.id,
            type: 'system',
            title: `Handoff ${handoff.code} was cancelled`,
            body: `${sender?.name ?? 'The sender'} cancelled ${item?.name ?? 'the handoff'}.`,
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        if (item && item.status === 'in_handoff') item.status = 'available'
        break
      }
      case 'transit': {
        if (!['requested', 'awaiting_confirmation'].includes(handoff.status))
          throw new ApiError('The item cannot be marked in transit from this state.', 'invalid_state')
        transition('in_transit')
        handoff.events.push(
          createEvent(handoff.id, 'handed_over', user.id, input.note || 'Marked as in transit.', {
            method: 'In person',
          }),
        )
        if (receiver)
          pushNotification(db, {
            userId: receiver.id,
            type: 'confirmation',
            title: `${item?.name ?? 'Your item'} is on the way`,
            body: 'Scan the handoff QR or verify the code when you receive it.',
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        break
      }
      case 'receive': {
        if (!['awaiting_confirmation', 'in_transit', 'requested'].includes(handoff.status))
          throw new ApiError('Receipt has already been confirmed for this handoff.', 'invalid_state')
        const condition = input.condition ?? handoff.conditionOut
        transition('received')
        handoff.receivedAt = now
        handoff.conditionIn = condition
        handoff.proof = {
          id: uid('proof'),
          type: input.method === 'qr' ? 'qr' : 'manual',
          submittedById: user.id,
          createdAt: now,
          condition,
          note: input.note,
          photo: input.photo,
          ipHint: input.method === 'qr' ? 'Camera scan · verified' : 'Manual code verification',
        }
        if (input.method === 'qr')
          handoff.events.push(
            createEvent(handoff.id, 'qr_scanned', user.id, `QR verified against ${handoff.code}.`, {
              method: 'qr',
              ...(offline ? { offline: 'true' } : {}),
            }),
          )
        else
          handoff.events.push(
            createEvent(handoff.id, 'qr_scanned', user.id, `Code ${handoff.code} verified manually.`, {
              method: 'manual',
            }),
          )
        handoff.events.push(
          createEvent(handoff.id, 'received', user.id, input.note || `Condition confirmed as ${condition}.`, {
            condition,
          }),
        )
        handoff.events.push(createEvent(handoff.id, 'proof_uploaded', user.id, 'Digital proof attached.', {
          proofType: handoff.proof.type,
        }))
        if (item) {
          item.holderId = receiver?.id ?? user.id
          item.condition = condition
          item.status = 'in_handoff'
          item.updatedAt = now
        }
        if (sender)
          pushNotification(db, {
            userId: sender.id,
            type: 'confirmation',
            title: `${user.name} confirmed receipt of ${item?.name ?? 'the item'}`,
            body: `Condition: ${condition}. Proof recorded at ${new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        break
      }
      case 'start_return': {
        if (handoff.status !== 'received') throw new ApiError('Only received items can be returned.', 'invalid_state')
        handoff.updatedAt = now
        handoff.events.push(
          createEvent(handoff.id, 'return_requested', user.id, input.note || 'Return handed back to the owner.'),
        )
        if (offline) handoff.pendingSync = true
        if (sender)
          pushNotification(db, {
            userId: sender.id,
            type: 'return_reminder',
            title: `${user.name} returned ${item?.name ?? 'an item'}`,
            body: 'Confirm the return to close the handoff chain.',
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        break
      }
      case 'confirm_return': {
        if (handoff.status !== 'received') throw new ApiError('This handoff is not awaiting a return.', 'invalid_state')
        transition('returned')
        handoff.returnedAt = now
        if (input.condition) handoff.conditionIn = input.condition
        handoff.events.push(
          createEvent(handoff.id, 'returned', user.id, input.note || 'Return confirmed by the sender.', {
            condition: input.condition ?? handoff.conditionIn ?? handoff.conditionOut,
          }),
        )
        handoff.events.push(createEvent(handoff.id, 'completed', user.id, 'Handoff chain closed.'))
        if (item) {
          item.holderId = item.ownerId
          item.status = 'available'
          item.condition = input.condition ?? handoff.conditionIn ?? item.condition
          item.updatedAt = now
        }
        if (receiver)
          pushNotification(db, {
            userId: receiver.id,
            type: 'confirmation',
            title: `${item?.name ?? 'Item'} return confirmed`,
            body: `Handoff ${handoff.code} is now complete. Thanks for closing the loop.`,
            href: `/handoffs/${handoff.id}`,
            handoffId: handoff.id,
          })
        break
      }
      case 'note': {
        if (!input.note?.trim()) throw new ApiError('Write a note first.', 'validation')
        handoff.updatedAt = now
        handoff.events.push(createEvent(handoff.id, 'note', user.id, input.note.trim()))
        break
      }
      case 'issue': {
        if (!input.note?.trim()) throw new ApiError('Describe the issue first.', 'validation')
        handoff.updatedAt = now
        handoff.events.push(createEvent(handoff.id, 'issue_reported', user.id, input.note.trim()))
        const team = getTeam(db, handoff.teamId)
        if (team) {
          for (const member of team.members) {
            if (member.profileId === user.id) continue
            pushNotification(db, {
              userId: member.profileId,
              type: 'issue',
              title: `Issue reported on ${item?.name ?? handoff.code}`,
              body: input.note.trim().slice(0, 140),
              href: `/handoffs/${handoff.id}`,
              handoffId: handoff.id,
            })
          }
        }
        break
      }
      default:
        throw new ApiError('That action is not supported.', 'unknown_action')
    }
    handoff.updatedAt = now
    updated = handoff
  })

  if (!updated) throw new ApiError('The handoff could not be updated.', 'update_failed')
  if (offline) {
    await enqueueOperation(
      input.action === 'receive' || input.action === 'issue' ? 'handoff.status' : 'handoff.status',
      { handoffId: input.handoffId, action: input.action, status: (updated as Handoff).status },
      idempotencyKey,
    )
  }
  return { handoff: structuredClone(updated), offline }
}

export async function addHandoffNote(handoffId: string, note: string) {
  return updateHandoff({ handoffId, action: 'note', note })
}

export async function reportIssue(input: { handoffId?: string; title: string; detail: string }) {
  await latency(200)
  const offline = !isOnline()
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    if (input.handoffId) {
      const handoff = db.handoffs.find((entry) => entry.id === input.handoffId)
      if (!handoff) throw new ApiError('That handoff no longer exists.', 'not_found')
      handoff.events.push(createEvent(handoff.id, 'issue_reported', user.id, `${input.title} — ${input.detail}`))
      handoff.updatedAt = nowIso()
    }
    const team = db.teams.find((entry) => entry.members.some((member) => member.profileId === user.id))
    for (const member of team?.members ?? []) {
      if (member.profileId === user.id) continue
      pushNotification(db, {
        userId: member.profileId,
        type: 'issue',
        title: `Issue reported: ${input.title}`,
        body: input.detail.slice(0, 140),
        href: input.handoffId ? `/handoffs/${input.handoffId}` : '/activity',
        handoffId: input.handoffId,
      })
    }
    pushNotification(db, {
      userId: user.id,
      type: 'issue',
      title: 'Issue logged',
      body: `${input.title} was recorded and shared with your team.`,
      href: input.handoffId ? `/handoffs/${input.handoffId}` : '/activity',
      handoffId: input.handoffId,
      createdAt: nowIso(),
    })
  })
  if (offline) {
    await enqueueOperation('issue.report', { ...input, createdAt: nowIso() }, `issue:${Date.now()}`)
  }
  return { offline }
}

export async function generateProof(input: {
  handoffId: string
  condition: ItemCondition
  note?: string
  photo?: string
  method?: 'qr' | 'manual'
}): Promise<HandoffMutationResult> {
  return updateHandoff({ ...input, action: 'receive' })
}

/* ---------------------------------- Items --------------------------------- */

export interface CreateItemInput {
  name: string
  description?: string
  category: Item['category']
  serial?: string
  ownerId: string
  condition: ItemCondition
  location?: string
  value?: number
  image?: string
  tags?: string[]
}

export async function createItem(input: CreateItemInput): Promise<{ item: Item; offline: boolean }> {
  await latency(220)
  const offline = !isOnline()
  let created: Item | null = null
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const owner = getProfile(db, input.ownerId)
    if (!owner) throw new ApiError('Choose a valid owner.', 'owner_missing')
    if (input.name.trim().length < 2) throw new ApiError('Give the item a name.', 'validation')
    if (db.items.some((item) => item.name.toLowerCase() === input.name.trim().toLowerCase()))
      throw new ApiError('An item with that name already exists.', 'duplicate_item')
    const now = nowIso()
    const item: Item = {
      id: uid('item'),
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      category: input.category,
      serial: input.serial?.trim() || `RELAY-${codes(4)}`,
      ownerId: owner.id,
      holderId: owner.id,
      status: 'available',
      condition: input.condition,
      image: input.image || '/img/studio.jpg',
      images: input.image ? [input.image] : [],
      tags: input.tags ?? [],
      location: input.location?.trim() || 'Studio · Unassigned',
      value: input.value,
      acquiredAt: now,
      createdAt: now,
      updatedAt: now,
    }
    db.items.unshift(item)
    created = item
    pushNotification(db, {
      userId: user.id,
      type: 'system',
      title: `${item.name} added to the inventory`,
      body: `Owned by ${owner.name}. Ready to be handed off.`,
      href: `/items/${item.id}`,
    })
  })
  if (!created) throw new ApiError('The item could not be created.', 'create_failed')
  if (offline) await enqueueOperation('item.create', { itemId: (created as Item).id }, `item.create:${uid('key')}`)
  return { item: structuredClone(created), offline }
}

export async function updateItem(itemId: string, patch: Partial<CreateItemInput> & { status?: Item['status'] }) {
  await latency(160)
  let updated: Item | null = null
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const item = getItem(db, itemId)
    if (!item) throw new ApiError('Item not found.', 'not_found')
    if (user.role === 'member' && item.ownerId !== user.id && item.holderId !== user.id)
      throw new ApiError('Only the owner or holder can edit this item.', 'forbidden')
    Object.assign(item, {
      ...patch,
      name: patch.name?.trim() ?? item.name,
      updatedAt: nowIso(),
    })
    updated = item
  })
  return updated
}

export async function archiveItem(itemId: string) {
  await latency(140)
  updateDatabase((db) => {
    const item = getItem(db, itemId)
    if (!item) throw new ApiError('Item not found.', 'not_found')
    const active = db.handoffs.some(
      (handoff) =>
        handoff.itemId === itemId &&
        ['requested', 'awaiting_confirmation', 'in_transit', 'received'].includes(handoff.status),
    )
    if (active) throw new ApiError('Return or cancel the active handoff before archiving this item.', 'item_busy')
    item.status = 'unavailable'
    item.updatedAt = nowIso()
  })
}

/* ------------------------------ Notifications ----------------------------- */

export async function markNotificationRead(id: string) {
  updateDatabase((db) => {
    const notification = db.notifications.find((entry) => entry.id === id)
    if (notification) notification.read = true
  })
}

export async function markAllNotificationsRead(userId?: string) {
  await latency(90)
  updateDatabase((db) => {
    const target = userId ?? db.currentUserId
    db.notifications.filter((entry) => entry.userId === target).forEach((entry) => (entry.read = true))
  })
}

export async function clearReadNotifications() {
  updateDatabase((db) => {
    db.notifications = db.notifications.filter((entry) => entry.userId !== db.currentUserId || !entry.read)
  })
}

/* --------------------------------- People --------------------------------- */

export async function createTeam(input: { name: string; description?: string; color: string }) {
  await latency(240)
  let created: Team | null = null
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    if (input.name.trim().length < 2) throw new ApiError('Give the team a name.', 'validation')
    if (db.teams.some((team) => team.name.toLowerCase() === input.name.trim().toLowerCase()))
      throw new ApiError('A team with that name already exists.', 'duplicate_team')
    const now = nowIso()
    const team: Team = {
      id: uid('team'),
      name: input.name.trim(),
      description: input.description?.trim() ?? '',
      color: input.color,
      icon: 'users',
      members: [{ profileId: user.id, role: 'owner', joinedAt: now }],
      createdAt: now,
    }
    db.teams.push(team)
    created = team
  })
  if (!created) throw new ApiError('The team could not be created.', 'create_failed')
  return structuredClone(created)
}

export async function inviteMember(input: { teamId: string; email: string; role: TeamRole }) {
  await latency(220)
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const team = getTeam(db, input.teamId)
    if (!team) throw new ApiError('Team not found.', 'not_found')
    const membership = team.members.find((member) => member.profileId === user.id)
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin'))
      throw new ApiError('You need admin access to invite people to this team.', 'forbidden')
    if (!input.email.includes('@')) throw new ApiError('Enter a valid email address.', 'validation')
    if (db.invitations.some((invite) => invite.teamId === input.teamId && invite.status === 'pending' && invite.email === input.email.toLowerCase()))
      throw new ApiError('There is already a pending invitation for that email.', 'duplicate_invite')
    const existing = db.profiles.find((profile) => profile.email.toLowerCase() === input.email.toLowerCase())
    if (existing && team.members.some((member) => member.profileId === existing.id))
      throw new ApiError('That person is already a member of this team.', 'already_member')
    db.invitations.unshift({
      id: uid('invite'),
      teamId: input.teamId,
      email: input.email.toLowerCase(),
      role: input.role,
      invitedById: user.id,
      status: 'pending',
      createdAt: nowIso(),
    })
    if (existing) {
      pushNotification(db, {
        userId: existing.id,
        type: 'team_invite',
        title: `${user.name} invited you to ${team.name}`,
        body: `You were invited as ${input.role}. Open People to respond.`,
        href: `/people/${team.id}`,
      })
    }
  })
}

export async function cancelInvitation(invitationId: string) {
  updateDatabase((db) => {
    db.invitations = db.invitations.filter((invite) => invite.id !== invitationId)
  })
}

export async function acceptInvitation(invitationId: string) {
  await latency(180)
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const invite = db.invitations.find((entry) => entry.id === invitationId)
    if (!invite) throw new ApiError('Invitation not found.', 'not_found')
    const team = getTeam(db, invite.teamId)
    if (!team) throw new ApiError('Team not found.', 'not_found')
    if (!team.members.some((member) => member.profileId === user.id)) {
      team.members.push({ profileId: user.id, role: invite.role, joinedAt: nowIso() })
    }
    invite.status = 'accepted'
  })
}

export async function updateTeamMemberRole(input: { teamId: string; profileId: string; role: TeamRole }) {
  await latency(150)
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const team = getTeam(db, input.teamId)
    if (!team) throw new ApiError('Team not found.', 'not_found')
    const mine = team.members.find((member) => member.profileId === user.id)
    if (!mine || (mine.role !== 'owner' && mine.role !== 'admin'))
      throw new ApiError('Only team owners and admins can change roles.', 'forbidden')
    const target = team.members.find((member) => member.profileId === input.profileId)
    if (!target) throw new ApiError('That person is not on this team.', 'not_found')
    if (target.role === 'owner' && mine.role !== 'owner')
      throw new ApiError('Only an owner can change another owner.', 'forbidden')
    target.role = input.role
  })
}

export async function removeTeamMember(input: { teamId: string; profileId: string }) {
  await latency(150)
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    const team = getTeam(db, input.teamId)
    if (!team) throw new ApiError('Team not found.', 'not_found')
    const mine = team.members.find((member) => member.profileId === user.id)
    if (!mine || (mine.role !== 'owner' && mine.role !== 'admin'))
      throw new ApiError('Only team owners and admins can remove members.', 'forbidden')
    if (input.profileId === user.id) throw new ApiError('You cannot remove yourself from a team.', 'forbidden')
    team.members = team.members.filter((member) => member.profileId !== input.profileId)
  })
}

/* --------------------------------- Account -------------------------------- */

export async function updateProfile(profileId: string, patch: Partial<Pick<ProfileUpdate, keyof ProfileUpdate>>) {
  await latency(180)
  updateDatabase((db) => {
    const user = requireCurrentUser(db)
    if (user.id !== profileId) throw new ApiError('You can only edit your own profile.', 'forbidden')
    const profile = getProfile(db, profileId)
    if (!profile) throw new ApiError('Profile not found.', 'not_found')
    Object.assign(profile, patch)
  })
}

interface ProfileUpdate {
  name: string
  email: string
  title: string
  phone: string
  timezone: string
  avatar?: string
}

export async function signInDemo(email: string, password: string) {
  await latency(380)
  if (!password) throw new ApiError('Enter your password.', 'validation')
  const db = loadDatabase()
  const profile = db.profiles.find((entry) => entry.email.toLowerCase() === email.trim().toLowerCase())
  if (!profile) throw new ApiError('No demo account matches that email. Use one of the demo accounts below.', 'no_account')
  setDemoUser(profile.id)
  return profile
}

export async function signUpDemo(input: { name: string; email: string; password: string; workspaceName: string }) {
  await latency(420)
  if (input.password.length < 8) throw new ApiError('Use at least 8 characters for your password.', 'validation')
  let created = null
  updateDatabase((db) => {
    const email = input.email.trim().toLowerCase()
    if (db.profiles.some((profile) => profile.email.toLowerCase() === email))
      throw new ApiError('An account already exists with that email.', 'email_exists')
    const profile = {
      id: uid('profile'),
      name: input.name.trim(),
      email,
      handle: input.name.toLowerCase().replace(/\s+/g, '.').slice(0, 20),
      title: 'Workspace member',
      avatar: undefined,
      accent: 'var(--accent)',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      role: 'member' as WorkspaceRole,
      joinedAt: nowIso(),
      lastActiveAt: nowIso(),
    }
    db.profiles.push(profile)
    db.organization.name = input.workspaceName.trim() || db.organization.name
    db.currentUserId = profile.id
    created = profile
  })
  return created
}

export async function signOutDemo() {
  await latency(140)
  setDemoUser(null)
}

export async function resetWorkspace() {
  await latency(260)
  resetDatabase()
}

export async function exportWorkspaceData() {
  return structuredClone(loadDatabase())
}
