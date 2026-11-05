import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Mail,
  Plus,
  SearchX,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import type { z } from 'zod'
import type { Profile } from '@/types'
import { teamSchema } from '@/lib/validation'
import { useTeamActions, useWorkspace } from '@/hooks/useWorkspace'
import {
  getCurrentProfile,
  getProfile,
  getTeamRole,
  profileReliability,
  queryHandoffs,
  teamViews,
  type TeamView,
} from '@/lib/selectors'
import {
  TEAM_ROLE_META,
  canManageTeam,
  cn,
  formatDate,
  pct,
  relativeTime,
  roleLabel,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  CopyButton,
  DemoBadge,
  EmptyState,
  Skeleton,
  StatusBadge,
} from '@/components/ui/primitives'
import { SearchField, TextAreaField, TextField } from '@/components/ui/forms'
import { Tabs } from '@/components/ui/tabs'
import { Modal } from '@/components/ui/overlays'
import { InviteMemberDialog } from '@/components/people/InviteMemberDialog'

type TabKey = 'people' | 'teams' | 'invitations'

export function PeoplePage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState<string | null>(null)

  const rawTab = params.get('tab') as TabKey | null
  const tab: TabKey = rawTab && ['people', 'teams', 'invitations'].includes(rawTab) ? rawTab : 'people'
  const personId = params.get('person')
  const me = data ? getCurrentProfile(data) : undefined
  const teams = data ? teamViews(data) : []
  const person = data && personId ? getProfile(data, personId) : undefined

  const setTab = (next: TabKey) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'people') nextParams.delete('tab')
    else nextParams.set('tab', next)
    setParams(nextParams, { replace: true })
  }

  const closePerson = () => {
    const next = new URLSearchParams(params)
    next.delete('person')
    setParams(next, { replace: true })
  }

  const people = useMemo(() => {
    if (!data) return [] as Profile[]
    let list = data.profiles
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((profile) =>
        [profile.name, profile.email, profile.title, profile.handle].join(' ').toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      if (a.id === data.currentUserId) return -1
      if (b.id === data.currentUserId) return 1
      return a.name.localeCompare(b.name)
    })
  }, [data, search])

  const invitations = useMemo(() => {
    if (!data) return { mine: [], sent: [] }
    const mine = data.invitations.filter(
      (invite) => invite.status === 'pending' && me && invite.email.toLowerCase() === me.email.toLowerCase(),
    )
    const myTeamIds = new Set(
      teams.filter((team) => team.members.some((member) => member.profileId === me?.id)).map((team) => team.id),
    )
    const sent = data.invitations.filter(
      (invite) =>
        invite.status === 'pending' &&
        myTeamIds.has(invite.teamId) &&
        !(me && invite.email.toLowerCase() === me.email.toLowerCase()),
    )
    return { mine, sent }
  }, [data, me, teams])

  const pendingForMe = invitations.mine.length

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Members &amp; access</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            People &amp; teams<span className="text-accent">.</span>
          </>
        }
        description="The people behind every handoff. Roles decide who can send, receive and manage shared gear."
        actions={
          <>
            <Button variant="secondary" icon={UserPlus} onClick={() => setCreateOpen(true)}>
              New team
            </Button>
            <Button variant="primary" icon={Users} onClick={() => navigate('/handoffs/new')}>
              New handoff
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={tab}
          onChange={(value) => setTab(value as TabKey)}
          items={[
            { value: 'people', label: 'People', count: data?.profiles.length, icon: Users },
            { value: 'teams', label: 'Teams', count: teams.length, icon: UsersRound },
            { value: 'invitations', label: 'Invitations', count: pendingForMe, icon: Mail },
          ]}
        />
        {tab === 'people' && (
          <div className="w-full md:w-[260px]">
            <SearchField value={search} onChange={setSearch} placeholder="Search people, roles, emails…" />
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[190px] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={ShieldCheck}
          title="People could not load"
          description="Try again. The workspace data is stored locally and is not lost."
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : tab === 'people' ? (
        people.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={`No people match “${search}”`}
            description="Try a name, email, handle or role. Search is limited to this workspace."
            action={
              <Button variant="secondary" onClick={() => setSearch('')}>
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((profile) => {
              const reliability = data ? profileReliability(data, profile.id) : { completed: 0, onTimeRate: 0 }
              const memberTeams = teams.filter((team) =>
                team.members.some((member) => member.profileId === profile.id),
              )
              return (
                <motion.button
                  layout
                  key={profile.id}
                  type="button"
                  onClick={() => {
                    const next = new URLSearchParams(params)
                    next.set('person', profile.id)
                    setParams(next)
                  }}
                  className="card card-hover group p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <Avatar profile={profile} size="lg" online={profile.lastActiveAt > new Date(Date.now() - 3_600_000).toISOString()} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-medium text-ink">{profile.name}</span>
                        {profile.id === me?.id && <Badge tone="accent">You</Badge>}
                        {profile.role === 'owner' && <ShieldCheck size={13} className="text-accent" />}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">{profile.title}</p>
                      <p className="mt-0.5 truncate font-mono text-[9.5px] text-faint">{profile.email}</p>
                    </div>
                    <ChevronRight size={15} className="mt-1 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {memberTeams.slice(0, 2).map((team) => (
                      <span key={team.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[9.5px] text-muted">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.name}
                      </span>
                    ))}
                    {memberTeams.length > 2 && <span className="text-[9.5px] text-faint">+{memberTeams.length - 2}</span>}
                    {memberTeams.length === 0 && <span className="text-[9.5px] text-faint">No shared teams</span>}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                    <div className="flex items-center gap-2 text-[9.5px] text-faint">
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={10} className="text-success" /> {reliability.onTimeRate}% on time
                      </span>
                      <span>·</span>
                      <span>{reliability.completed} returns</span>
                    </div>
                    <span className="font-mono text-[8.5px] uppercase tracking-wider text-faint">
                      {roleLabel(profile.role)}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )
      ) : tab === 'teams' ? (
        teams.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No teams yet"
            description="Create a team to share gear, track handoffs together and manage roles."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>
                Create a team
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((team) => {
              const role = me ? getTeamRole(data, team.id, me.id) : undefined
              return (
                <div key={team.id} className="card card-hover overflow-hidden">
                  <div className="h-1 w-full" style={{ backgroundColor: team.color }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/people/${team.id}`} className="flex min-w-0 items-start gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line"
                          style={{ backgroundColor: `color-mix(in srgb, ${team.color} 14%, var(--surface-2))`, color: team.color }}
                        >
                          <UsersRound size={17} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-ink hover:text-accent">{team.name}</span>
                          <span className="mt-0.5 block line-clamp-1 text-[10.5px] text-faint">{team.description}</span>
                        </span>
                      </Link>
                      {role && <Badge tone={TEAM_ROLE_META[role].tone}>{TEAM_ROLE_META[role].label}</Badge>}
                    </div>

                    <div className="mt-3.5 flex items-center justify-between gap-2">
                      <AvatarStack profiles={team.memberProfiles} max={5} size="sm" />
                      <span className="text-[9.5px] text-faint">{team.memberProfiles.length} members</span>
                    </div>

                    <div className="mt-3.5 grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface-2/40">
                      <MiniStat label="Active" value={team.activeHandoffs} />
                      <MiniStat label="Items" value={team.itemsCount} />
                      <MiniStat label="Invites" value={team.pendingInvites} />
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Link to={`/people/${team.id}`} className="btn btn-secondary btn-sm flex-1">
                        Open team <ArrowRight size={12} />
                      </Link>
                      {role && canManageTeam(role) && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInviteOpen(team.id)}>
                          <UserPlus size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-accent" />
                <h2 className="text-[12.5px] font-medium text-ink">Invitations for you</h2>
              </div>
              <Badge tone={pendingForMe ? 'accent' : 'neutral'}>{pendingForMe} pending</Badge>
            </div>
            {invitations.mine.length === 0 ? (
              <EmptyState compact icon={Mail} title="No invitations waiting" description="When someone invites you to a team, it will appear here." />
            ) : (
              <div className="divide-y divide-line">
                {invitations.mine.map((invite) => {
                  const team = teams.find((entry) => entry.id === invite.teamId)
                  return (
                    <InviteRow key={invite.id} invite={invite} team={team} showAccept />
                  )
                })}
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-info" />
                <h2 className="text-[12.5px] font-medium text-ink">Pending in your teams</h2>
              </div>
              <span className="font-mono text-[9.5px] text-faint">{invitations.sent.length}</span>
            </div>
            {invitations.sent.length === 0 ? (
              <EmptyState compact icon={UserPlus} title="No pending invitations" description="Invite people from a team page to grow the workspace." />
            ) : (
              <div className="divide-y divide-line">
                {invitations.sent.map((invite) => {
                  const team = teams.find((entry) => entry.id === invite.teamId)
                  const role = me && team ? getTeamRole(data, team.id, me.id) : undefined
                  return <InviteRow key={invite.id} invite={invite} team={team} canCancel={canManageTeam(role)} />
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <PersonDialog profile={person} teamList={teams} onClose={closePerson} />
      <CreateTeamDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => navigate(`/people/${id}`)} />
      {inviteOpen && data && <InviteMemberDialog teamId={inviteOpen} onClose={() => setInviteOpen(null)} />}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2.5 text-center">
      <p className="text-[16px] font-medium leading-none text-ink tabular">{value}</p>
      <p className="mt-1 text-[8.5px] uppercase tracking-wider text-faint">{label}</p>
    </div>
  )
}

function InviteRow({
  invite,
  team,
  showAccept,
  canCancel,
}: {
  invite: { id: string; email: string; role: string; createdAt: string; invitedById: string; teamId: string }
  team?: TeamView
  showAccept?: boolean
  canCancel?: boolean
}) {
  const { data } = useWorkspace()
  const actions = useTeamActions()
  const inviter = data ? getProfile(data, invite.invitedById) : undefined
  const roleMeta = invite.role in TEAM_ROLE_META ? TEAM_ROLE_META[invite.role as keyof typeof TEAM_ROLE_META] : undefined
  return (
    <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-muted">
          <Mail size={15} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-medium text-ink">{showAccept ? `Invitation to ${team?.name ?? 'a team'}` : invite.email}</p>
          <p className="mt-0.5 truncate text-[10px] text-faint">
            {team?.name ?? 'Team'} · invited by {inviter?.name ?? 'a teammate'} · {relativeTime(invite.createdAt)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {roleMeta && <Badge tone={roleMeta.tone}>{roleMeta.label}</Badge>}
        {showAccept && (
          <Button variant="primary" size="sm" icon={Check} loading={actions.acceptInvite.isPending} onClick={() => actions.acceptInvite.mutate(invite.id)}>
            Join
          </Button>
        )}
        {canCancel && (
          <Button variant="ghost" size="sm" icon={X} loading={actions.cancelInvite.isPending} onClick={() => actions.cancelInvite.mutate(invite.id)}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

function PersonDialog({ profile, teamList, onClose }: { profile?: Profile; teamList: TeamView[]; onClose: () => void }) {
  const { data } = useWorkspace()
  if (!profile || !data) return null
  const reliability = profileReliability(data, profile.id)
  const memberTeams = teamList.filter((team) => team.members.some((member) => member.profileId === profile.id))
  const handoffs = queryHandoffs(data, { personId: profile.id, sort: 'newest' }).slice(0, 4)
  const active = handoffs.filter((handoff) => ['requested', 'awaiting_confirmation', 'in_transit', 'received'].includes(handoff.status))
  const isMe = profile.id === data.currentUserId

  return (
    <Modal
      open
      onClose={onClose}
      title={profile.name}
      description={`${profile.title} · ${profile.handle}`}
      icon={Users}
      size="lg"
      footer={
        <>
          <CopyButton value={profile.email} label="Copy email" />
          {!isMe && (
            <Link to={`/handoffs/new?receiverId=${profile.id}`} className="btn btn-primary">
              <Sparkles size={13} /> Hand off to {profile.name.split(' ')[0]}
            </Link>
          )}
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/50 p-4 sm:flex-row sm:items-center">
          <Avatar profile={profile} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[15px] font-medium text-ink">{profile.name}</span>
              {isMe && <Badge tone="accent">You</Badge>}
              <Badge tone={profile.role === 'owner' ? 'accent' : 'neutral'}>{roleLabel(profile.role)}</Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">{profile.title}</p>
            <p className="mt-1 truncate font-mono text-[10px] text-faint">{profile.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-faint">
              <span className="flex items-center gap-1"><Mail size={10} /> {profile.timezone}</span>
              <span>Joined {formatDate(profile.joinedAt, 'short')}</span>
              <span>Active {relativeTime(profile.lastActiveAt)}</span>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-1">
            <div className="rounded-lg border border-line bg-surface p-2.5 text-center">
              <p className="text-[18px] font-medium leading-none text-ink tabular">{reliability.onTimeRate}%</p>
              <p className="mt-1 text-[8.5px] uppercase tracking-wider text-faint">On time</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-2.5 text-center">
              <p className="text-[18px] font-medium leading-none text-ink tabular">{reliability.completed}</p>
              <p className="mt-1 text-[8.5px] uppercase tracking-wider text-faint">Returns</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <section>
            <p className="eyebrow mb-2 text-[8.5px]">Teams</p>
            {memberTeams.length === 0 ? (
              <p className="text-[10.5px] text-faint">Not part of a shared team yet.</p>
            ) : (
              <div className="space-y-1.5">
                {memberTeams.map((team) => {
                  const member = team.members.find((entry) => entry.profileId === profile.id)
                  return (
                    <Link
                      key={team.id}
                      to={`/people/${team.id}`}
                      className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:bg-surface-2"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color }} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-ink">{team.name}</span>
                      {member && <Badge tone={TEAM_ROLE_META[member.role].tone}>{TEAM_ROLE_META[member.role].label}</Badge>}
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <p className="eyebrow mb-2 text-[8.5px]">Active handoffs</p>
            {active.length === 0 ? (
              <p className="text-[10.5px] text-faint">Nothing active right now.</p>
            ) : (
              <div className="space-y-1.5">
                {active.map((handoff) => (
                  <Link key={handoff.id} to={`/handoffs/${handoff.id}`} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-ink">{handoff.item.name}</span>
                      <span className="block font-mono text-[9px] text-faint">{handoff.code}</span>
                    </span>
                    <StatusBadge status={handoff.status} overdue={handoff.isOverdue} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow text-[8.5px]">Recent record</p>
            <span className="text-[9px] text-faint">{handoffs.length} shown</span>
          </div>
          {handoffs.length === 0 ? (
            <p className="text-[10.5px] text-faint">No handoffs recorded for this person yet.</p>
          ) : (
            <div className="divide-y divide-line rounded-lg border border-line">
              {handoffs.map((handoff) => (
                <Link key={handoff.id} to={`/handoffs/${handoff.id}`} className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-ink">{handoff.item.name}</p>
                    <p className="truncate text-[9.5px] text-faint">
                      {handoff.code} · {relativeTime(handoff.createdAt)} · {handoff.sender.name} → {handoff.receiver.name}
                    </p>
                  </div>
                  <BadgeCheck size={13} className={handoff.proof ? 'text-success' : 'text-faint'} />
                  <ArrowUpRight size={12} className="text-faint" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5 text-[10px] leading-relaxed text-faint">
          On-time rate is calculated from completed handoffs only ({pct(reliability.completed - Math.round((reliability.completed * reliability.onTimeRate) / 100), reliability.completed)} late). Small samples are not a prediction of future behaviour.
        </div>
      </div>
    </Modal>
  )
}

type TeamValues = z.input<typeof teamSchema>
type TeamOutput = z.output<typeof teamSchema>

function CreateTeamDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const actions = useTeamActions()
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeamValues, unknown, TeamOutput>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: '', description: '', color: 'var(--accent)' },
  })
  const color = watch('color')
  const palette = ['var(--accent)', 'var(--info)', 'var(--violet)', 'var(--warn)', 'var(--success)', 'var(--danger)']

  useEffect(() => {
    if (open) reset({ name: '', description: '', color: 'var(--accent)' })
  }, [open, reset])

  const submit = handleSubmit(async (values) => {
    try {
      const team = await actions.create.mutateAsync(values)
      onCreated(team.id)
      onClose()
    } catch {
      // Toast is handled by the mutation.
    }
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create a team"
      description="Teams share gear, handoffs and a trust record. You become the owner."
      icon={UsersRound}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={actions.create.isPending}>
            Cancel
          </button>
          <button type="submit" form="team-form" className="btn btn-primary" disabled={actions.create.isPending}>
            {actions.create.isPending ? 'Creating…' : 'Create team'}
          </button>
        </>
      }
    >
      <form id="team-form" onSubmit={submit} className="space-y-4 pb-1">
        <TextField label="Team name" required placeholder="e.g. Field Production" error={errors.name?.message} {...register('name')} />
        <TextAreaField label="Description" optional placeholder="What does this team share?" error={errors.description?.message} maxLength={200} showCount {...register('description')} />
        <div>
          <span className="label">Team colour</span>
          <div className="flex flex-wrap gap-2">
            {palette.map((entry) => (
              <button
                key={entry}
                type="button"
                aria-label={`Use colour ${entry}`}
                aria-pressed={color === entry}
                onClick={() => setValue('color', entry, { shouldValidate: true })}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform',
                  color === entry ? 'scale-110 border-ink' : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: entry }}
              >
                {color === entry && <Check size={13} style={{ color: 'var(--accent-ink)' }} />}
              </button>
            ))}
          </div>
          <p className="field-hint">Used in team chips and activity markers.</p>
        </div>
      </form>
    </Modal>
  )
}

export function TeamLink({ team }: { team: TeamView }) {
  return (
    <Link to={`/people/${team.id}`} className="inline-flex items-center gap-1.5 text-[10px] text-muted hover:text-accent">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: team.color }} />
      {team.name}
      <ChevronRight size={10} />
    </Link>
  )
}
