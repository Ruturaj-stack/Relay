import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Mail,
  Package,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import type { TeamRole } from '@/types'
import { useTeamActions, useWorkspace } from '@/hooks/useWorkspace'
import {
  activeHandoffsForTeam,
  enrichItem,
  getCurrentProfile,
  getProfile,
  getTeamRole,
  getTeamView,
} from '@/lib/selectors'
import {
  TEAM_ROLE_META,
  canManageTeam,
  cn,
  dueLabel,
  formatDate,
  relativeTime,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  DemoBadge,
  EmptyState,
  ImageWithFallback,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives'
import { ConfirmDialog, Menu } from '@/components/ui/overlays'
import { InviteMemberDialog } from '@/components/people/InviteMemberDialog'
import { toast } from '@/store/appStore'

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useWorkspace()
  const actions = useTeamActions()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  const team = data && teamId ? getTeamView(data, teamId) : undefined
  const me = data ? getCurrentProfile(data) : undefined
  const myRole = data && team && me ? getTeamRole(data, team.id, me.id) : undefined
  const canManage = canManageTeam(myRole)
  const handoffs = useMemo(() => (data && team ? activeHandoffsForTeam(data, team.id) : []), [data, team])
  const items = useMemo(() => {
    if (!data || !team) return []
    const memberIds = new Set(team.members.map((member) => member.profileId))
    return data.items
      .filter((item) => memberIds.has(item.ownerId) || memberIds.has(item.holderId))
      .map((item) => enrichItem(data, item.id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 6)
  }, [data, team])
  const invites = useMemo(
    () => (data && team ? data.invitations.filter((invite) => invite.teamId === team.id && invite.status === 'pending') : []),
    [data, team],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-1/2 max-w-md" />
        <div className="grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[420px] rounded-[var(--radius-lg)] lg:col-span-7" />
          <Skeleton className="h-[420px] rounded-[var(--radius-lg)] lg:col-span-5" />
        </div>
      </div>
    )
  }

  if (isError || !data || !team) {
    return (
      <EmptyState
        icon={UsersRound}
        title="This team could not be found"
        description="It may have been removed from the demo workspace, or your account no longer has access."
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => navigate('/people?tab=teams')}>
              All teams
            </Button>
            <Button variant="secondary" onClick={() => void refetch()}>
              Reload
            </Button>
          </div>
        }
      />
    )
  }

  const activeHandoffCount = handoffs.filter((handoff) =>
    ['requested', 'awaiting_confirmation', 'in_transit', 'received'].includes(handoff.status),
  ).length

  const changeRole = (profileId: string, role: TeamRole) => {
    actions.role.mutate(
      { teamId: team.id, profileId, role },
      {
        onSuccess: () => toast.success('Role updated', `The member is now ${TEAM_ROLE_META[role].label.toLowerCase()}.`),
      },
    )
  }

  return (
    <div>
      <PageHeader
        back={{ to: '/people?tab=teams', label: 'All teams' }}
        eyebrow={
          <>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">Team</span>
            </span>
            <span className="h-3 w-px bg-line-strong" />
            {myRole ? <Badge tone={TEAM_ROLE_META[myRole].tone}>You · {TEAM_ROLE_META[myRole].label}</Badge> : <Badge tone="neutral">Not a member</Badge>}
            <DemoBadge compact />
          </>
        }
        title={
          <>
            {team.name}
            <span className="text-accent">.</span>
          </>
        }
        description={team.description || 'A shared team for handoffs, equipment and access.'}
        actions={
          <>
            {canManage && (
              <Button variant="secondary" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                Invite
              </Button>
            )}
            <Button variant="primary" icon={ArrowLeftRight} onClick={() => navigate('/handoffs/new')}>
              New handoff
            </Button>
          </>
        }
      />

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Members" value={team.memberProfiles.length} note="Across every role" accent={team.color} />
          <Stat label="Active handoffs" value={activeHandoffCount} note="In motion now" accent="var(--info)" />
          <Stat label="Shared items" value={team.itemsCount} note="Owned or held by members" accent="var(--accent)" />
          <Stat label="Pending invites" value={invites.length} note="Waiting to be accepted" accent="var(--violet)" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-[13px] font-medium text-ink">Members</h2>
                <p className="mt-0.5 text-[10px] text-faint">Roles control invitations, role changes and removals.</p>
              </div>
              <AvatarStack profiles={team.memberProfiles} max={6} size="xs" />
            </div>
            <div className="divide-y divide-line">
              {team.memberProfiles
                .slice()
                .sort((a, b) => TEAM_ROLE_META[b.role].rank - TEAM_ROLE_META[a.role].rank)
                .map((member) => {
                  const isMe = member.id === me?.id
                  const isOwner = member.role === 'owner'
                  return (
                    <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar profile={member} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link to={`/people?person=${member.id}`} className="truncate text-[12px] font-medium text-ink hover:text-accent">
                            {member.name}
                          </Link>
                          {isMe && <Badge tone="accent">You</Badge>}
                          {isOwner && <ShieldCheck size={12} className="text-accent" />}
                        </div>
                        <p className="truncate text-[10px] text-faint">
                          {member.title} · joined {formatDate(member.joinedAt, 'short')}
                        </p>
                      </div>
                      {canManage && !isOwner && !isMe ? (
                        <Menu
                          label={`Change role for ${member.name}`}
                          trigger={<span className="badge border-line bg-surface-2 text-muted">{TEAM_ROLE_META[member.role].label}</span>}
                          items={[
                            { label: 'Make admin', icon: ShieldCheck, onClick: () => changeRole(member.id, 'admin') },
                            { label: 'Make member', icon: Check, onClick: () => changeRole(member.id, 'member') },
                            { label: 'Make viewer', icon: UsersRound, onClick: () => changeRole(member.id, 'viewer') },
                            {
                              label: 'Remove from team',
                              icon: UserMinus,
                              danger: true,
                              separator: true,
                              onClick: () => setRemoveTarget(member.id),
                            },
                          ]}
                        />
                      ) : (
                        <Badge tone={TEAM_ROLE_META[member.role].tone}>{TEAM_ROLE_META[member.role].label}</Badge>
                      )}
                    </div>
                  )
                })}
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-medium text-ink">Pending invitations</h2>
              {canManage && (
                <Button variant="ghost" size="sm" icon={UserPlus} onClick={() => setInviteOpen(true)}>
                  Invite
                </Button>
              )}
            </div>
            {invites.length === 0 ? (
              <EmptyState
                compact
                icon={Mail}
                title="No pending invitations"
                description={canManage ? 'Invite a teammate to share this team’s gear and record.' : 'There are no invitations waiting for this team.'}
                action={canManage ? <Button variant="secondary" size="sm" onClick={() => setInviteOpen(true)}>Invite someone</Button> : undefined}
              />
            ) : (
              <div className="divide-y divide-line">
                {invites.map((invite) => {
                  const inviter = getProfile(data, invite.invitedById)
                  return (
                    <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-faint">
                        <Mail size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-medium text-ink">{invite.email}</p>
                        <p className="truncate text-[9.5px] text-faint">
                          Invited by {inviter?.name ?? 'a teammate'} · {relativeTime(invite.createdAt)}
                        </p>
                      </div>
                      <Badge tone={TEAM_ROLE_META[invite.role].tone}>{TEAM_ROLE_META[invite.role].label}</Badge>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => actions.cancelInvite.mutate(invite.id)}
                          aria-label={`Cancel invitation for ${invite.email}`}
                          className="btn btn-ghost btn-icon btn-sm text-faint hover:text-danger"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-medium text-ink">Shared inventory</h2>
              <Link to="/items" className="text-[10px] text-muted hover:text-accent">
                All items <ChevronRight size={10} className="inline" />
              </Link>
            </div>
            {items.length === 0 ? (
              <EmptyState compact icon={Package} title="No shared items" description="Items owned or held by team members will appear here." />
            ) : (
              <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
                {items.map((item) => (
                  <Link key={item.id} to={`/items/${item.id}`} className="group bg-surface p-2.5 transition-colors hover:bg-surface-2">
                    <ImageWithFallback src={item.image} alt={item.name} className="aspect-[16/10] w-full rounded-md border border-line" iconSize={18} />
                    <p className="mt-2 truncate text-[11px] font-medium text-ink group-hover:text-accent">{item.name}</p>
                    <p className="mt-0.5 truncate font-mono text-[8.5px] uppercase tracking-wider text-faint">
                      {item.holder.id === me?.id ? 'With you' : item.holder.name.split(' ')[0]}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-5">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-[13px] font-medium text-ink">Team handoffs</h2>
                <p className="mt-0.5 text-[10px] text-faint">Everything routed through this team.</p>
              </div>
              <Badge tone="neutral">{handoffs.length}</Badge>
            </div>
            {handoffs.length === 0 ? (
              <EmptyState compact icon={ArrowLeftRight} title="No team handoffs" description="Handoffs assigned to this team will collect here." />
            ) : (
              <div className="divide-y divide-line">
                {handoffs.slice(0, 8).map((handoff) => (
                  <Link key={handoff.id} to={`/handoffs/${handoff.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
                    <ImageWithFallback src={handoff.item.image} alt={handoff.item.name} className="h-9 w-9 shrink-0 rounded-lg border border-line" iconSize={14} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-medium text-ink">{handoff.item.name}</p>
                      <p className="truncate text-[9.5px] text-faint">
                        {handoff.code} · {handoff.sender.name.split(' ')[0]} → {handoff.receiver.name.split(' ')[0]}
                      </p>
                      <p className={cn('mt-0.5 text-[9px]', handoff.isOverdue ? 'text-danger' : 'text-faint')}>
                        {handoff.status === 'returned' ? 'Closed' : dueLabel(handoff.dueAt)}
                      </p>
                    </div>
                    <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card p-4">
            <p className="eyebrow mb-2.5 text-[8.5px]">Team record</p>
            <div className="space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-faint">Created</span>
                <span className="text-muted">{formatDate(team.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-faint">Members</span>
                <span className="text-muted">{team.memberProfiles.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-faint">Active</span>
                <span className="text-muted">{activeHandoffCount}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-faint">Your role</span>
                <span className="text-muted">{myRole ? TEAM_ROLE_META[myRole].label : 'Not a member'}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-2 border-t border-line pt-3">
              <Link to={`/handoffs?filter=active`} className="btn btn-secondary btn-sm flex-1">
                Team handoffs <ArrowUpRight size={11} />
              </Link>
              <Link to={`/activity`} className="btn btn-ghost btn-sm flex-1">
                Activity <ArrowRight size={11} />
              </Link>
            </div>
          </section>

          <section className="rounded-[var(--radius-md)] border border-line bg-surface-2/40 p-3.5">
            <p className="flex items-center gap-2 text-[11.5px] font-medium text-ink">
              <ShieldCheck size={14} className="text-success" /> How roles work
            </p>
            <ul className="mt-2.5 space-y-2 text-[10px] leading-relaxed text-muted">
              <li><span className="text-ink">Owner</span> — full control, including other owners.</li>
              <li><span className="text-ink">Admin</span> — invite, change roles and remove members.</li>
              <li><span className="text-ink">Member</span> — create and receive handoffs.</li>
              <li><span className="text-ink">Viewer</span> — read the record only.</li>
            </ul>
          </section>
        </aside>
      </div>

      {inviteOpen && <InviteMemberDialog teamId={team.id} onClose={() => setInviteOpen(false)} />}

      <ConfirmDialog
        open={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return
          actions.remove.mutate(
            { teamId: team.id, profileId: removeTarget },
            { onSettled: () => setRemoveTarget(null) },
          )
        }}
        title="Remove this member?"
        description="They will lose access to this team's shared record. Their past handoffs stay in the workspace history."
        confirmLabel="Remove member"
        cancelLabel="Keep member"
        loading={actions.remove.isPending}
      />
    </div>
  )
}

function Stat({ label, value, note, accent }: { label: string; value: number; note: string; accent: string }) {
  return (
    <div className="p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-faint">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <p className="mt-2 text-[25px] font-medium leading-none tracking-[-0.04em] text-ink tabular">{value}</p>
      <p className="mt-1.5 text-[9.5px] text-faint">{note}</p>
    </div>
  )
}
