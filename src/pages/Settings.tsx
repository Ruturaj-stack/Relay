import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import {
  Bell,
  Check,
  CloudDownload,
  CloudOff,
  Database,
  Download,
  HardDrive,
  Laptop,
  LogOut,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  UserRound,
  WifiOff,
} from 'lucide-react'
import type { AppNotificationPreferences, Theme } from '@/types'
import { profileSchema } from '@/lib/validation'
import { useWorkspace, useProfileActions, useSignOut, useWorkspaceMaintenance } from '@/hooks/useWorkspace'
import { getCurrentProfile } from '@/lib/selectors'
import { useInstallPrompt } from '@/hooks/useViewport'
import { useSyncStore } from '@/store/syncStore'
import { useAppStore, toast } from '@/store/appStore'
import { cn, formatDate, relativeTime, roleLabel } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Avatar,
  Badge,
  Button,
  DemoBadge,
  EmptyState,
  Skeleton,
} from '@/components/ui/primitives'
import { SingleImageUpload, Switch, TextField } from '@/components/ui/forms'
import { ConfirmDialog } from '@/components/ui/overlays'

type ProfileValues = z.input<typeof profileSchema>
type ProfileOutput = z.output<typeof profileSchema>
type SettingsTab = 'profile' | 'notifications' | 'appearance' | 'data'

const TABS = [
  { value: 'profile', label: 'Profile', icon: UserRound },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'data', label: 'Data & device', icon: Database },
]

export function SettingsPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const tab = (params.get('tab') as SettingsTab) || 'profile'
  const user = data ? getCurrentProfile(data) : undefined
  const signOut = useSignOut()

  const setTab = (value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'profile') next.delete('tab')
    else next.set('tab', value)
    setParams(next, { replace: true })
  }

  if (isLoading) return <SettingsSkeleton />
  if (isError || !data || !user) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Settings could not load"
        description="Your profile lives in the demo workspace on this device. Try loading it again."
        action={
          <Button variant="primary" onClick={() => void refetch()}>
            Try again
          </Button>
        }
      />
    )
  }

  const validTab: SettingsTab = TABS.some((entry) => entry.value === tab) ? tab : 'profile'

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Account</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            Settings<span className="text-accent">.</span>
          </>
        }
        description="Your profile, notification choices, appearance and the data held on this device."
        actions={
          <>
            <Button variant="secondary" icon={CloudDownload} onClick={() => navigate('/activity')}>
              Activity record
            </Button>
            <Button
              variant="ghost"
              icon={LogOut}
              loading={signOut.isPending}
              onClick={() =>
                signOut.mutate(undefined, { onSuccess: () => navigate('/signin', { replace: true }) })
              }
            >
              Sign out
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[220px_1fr] lg:gap-6">
        <aside>
          <div className="card overflow-hidden lg:sticky lg:top-[84px]">
            <div className="flex items-center gap-3 border-b border-line p-4 lg:block lg:p-5">
              <Avatar profile={user} size="lg" />
              <div className="min-w-0 lg:mt-3">
                <p className="truncate text-[13px] font-medium text-ink">{user.name}</p>
                <p className="truncate text-[10.5px] text-faint">{user.title}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone={user.role === 'owner' ? 'accent' : 'neutral'}>{roleLabel(user.role)}</Badge>
                  <DemoBadge compact />
                </div>
              </div>
            </div>
            <nav className="scrollbar-none flex gap-1 overflow-x-auto p-2 lg:flex-col" aria-label="Settings sections">
              {TABS.map((entry) => {
                const active = entry.value === validTab
                const Icon = entry.icon
                return (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => setTab(entry.value)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium transition-colors',
                      active ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon size={14} strokeWidth={1.8} className={active ? 'text-accent' : 'text-faint'} />
                    {entry.label}
                  </button>
                )
              })}
            </nav>
            <div className="hidden border-t border-line p-3 lg:block">
              <button
                type="button"
                disabled={signOut.isPending}
                onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate('/signin', { replace: true }) })}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[12px] font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut size={14} /> {signOut.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          {validTab === 'profile' && <ProfileSection key={user.id} />}
          {validTab === 'notifications' && <NotificationsSection />}
          {validTab === 'appearance' && <AppearanceSection />}
          {validTab === 'data' && <DataSection />}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- Profile --------------------------------- */

function ProfileSection() {
  const { data } = useWorkspace()
  const user = data ? getCurrentProfile(data) : undefined
  const update = useProfileActions()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ProfileValues, unknown, ProfileOutput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      title: user?.title ?? '',
      phone: user?.phone ?? '',
      timezone: user?.timezone ?? 'UTC',
      avatar: user?.avatar,
    },
  })

  useEffect(() => {
    if (!user) return
    reset({
      name: user.name,
      email: user.email,
      title: user.title,
      phone: user.phone ?? '',
      timezone: user.timezone,
      avatar: user.avatar,
    })
  }, [user, reset])

  if (!data || !user) return null

  const avatar = watch('avatar')

  const submit = handleSubmit(async (values) => {
    await update.update.mutateAsync({
      profileId: user.id,
      patch: {
        name: values.name,
        email: values.email,
        title: values.title ?? '',
        phone: values.phone ?? '',
        timezone: values.timezone,
        avatar: values.avatar,
      },
    })
  })

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-[13.5px] font-medium text-ink">Public profile</h2>
          <p className="mt-0.5 text-[11px] text-faint">
            This is the name and contact your team sees on handoff records and activity.
          </p>
        </div>
        <div className="grid gap-5 p-4 sm:grid-cols-[180px_1fr] sm:p-5">
          <div>
            <SingleImageUpload
              label="Profile photo"
              value={avatar || undefined}
              onChange={(next) => setValue('avatar', next, { shouldDirty: true })}
              aspect="aspect-square"
            />
            <p className="mt-2 text-[10px] leading-relaxed text-faint">
              Images are stored locally in demo mode. Remove it to use your initials.
            </p>
          </div>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Full name" required error={errors.name?.message} {...register('name')} />
              <TextField label="Email" type="email" required error={errors.email?.message} {...register('email')} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Role or title" optional error={errors.title?.message} {...register('title')} />
              <TextField label="Phone" optional error={errors.phone?.message} {...register('phone')} />
            </div>
            <TextField
              label="Timezone"
              hint="Used for dates and reminders on this device."
              error={errors.timezone?.message}
              {...register('timezone')}
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[10px] text-faint">
            {update.update.isPending
              ? 'Saving profile…'
              : isDirty
                ? 'You have unsaved changes.'
                : 'Profile is up to date.'}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!isDirty || update.update.isPending} onClick={() => reset()}>
              Reset
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={update.update.isPending} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-[13.5px] font-medium text-ink">Workspace membership</h2>
          <p className="mt-0.5 text-[11px] text-faint">Account details from the demo workspace record.</p>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <InfoCell label="Workspace" value={data.organization.name} detail={data.organization.plan} />
          <InfoCell label="Access level" value={roleLabel(user.role)} detail="Local demo account" />
          <InfoCell label="Member since" value={formatDate(user.joinedAt, 'short')} detail={`Active ${relativeTime(user.lastActiveAt)}`} />
        </div>
        <div className="flex items-start gap-2 border-t border-line px-4 py-3 sm:px-5">
          <ShieldCheck size={13} className="mt-0.5 shrink-0 text-success" />
          <p className="text-[10px] leading-relaxed text-faint">
            Demo authentication is local to this browser. When a Supabase project is configured, the same profile fields map
            to the <span className="font-mono text-muted">profiles</span> table with row-level access rules.
          </p>
        </div>
      </section>
    </form>
  )
}

function InfoCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-faint">{label}</p>
      <p className="mt-1 truncate text-[12px] font-medium text-ink">{value}</p>
      <p className="mt-0.5 truncate text-[9.5px] capitalize text-faint">{detail}</p>
    </div>
  )
}

/* ----------------------------- Notifications ----------------------------- */

const PREF_GROUPS: Array<{
  title: string
  detail: string
  entries: Array<{ key: keyof AppNotificationPreferences; label: string; description: string }>
}> = [
  {
    title: 'Handoff activity',
    detail: 'What RELAY tells you about the things moving between people.',
    entries: [
      { key: 'handoffRequests', label: 'Handoff requests', description: 'When someone asks you to receive an item.' },
      { key: 'confirmations', label: 'Confirmations', description: 'When an acceptance, receipt or return is confirmed.' },
      { key: 'returnReminders', label: 'Return reminders', description: 'When a return has been started and needs closing.' },
      { key: 'overdue', label: 'Overdue returns', description: 'When an active handoff passes its agreed return date.' },
    ],
  },
  {
    title: 'Team & digest',
    detail: 'Shared activity and summaries. Email delivery is simulated in demo mode.',
    entries: [
      { key: 'teamActivity', label: 'Team activity', description: 'Invitations, member changes and shared gear updates.' },
      { key: 'emailDigest', label: 'Weekly email digest', description: 'A Monday summary of the workspace. Demo: nothing is emailed.' },
      { key: 'pushEnabled', label: 'Push notifications', description: 'Browser-level alerts when the app is installed. Requires permission.' },
    ],
  },
]

function NotificationsSection() {
  const prefs = useAppStore((state) => state.prefs)
  const updatePrefs = useAppStore((state) => state.updatePrefs)
  const [draft, setDraft] = useState<AppNotificationPreferences>(prefs)
  const dirty = useMemo(
    () => (Object.keys(draft) as Array<keyof AppNotificationPreferences>).some((key) => draft[key] !== prefs[key]),
    [draft, prefs],
  )

  const save = () => {
    updatePrefs(draft)
    toast.success('Notification preferences saved', 'They apply to this device and persist between visits.')
  }

  return (
    <div className="space-y-4">
      {PREF_GROUPS.map((group) => (
        <section key={group.title} className="card overflow-hidden">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-[13.5px] font-medium text-ink">{group.title}</h2>
            <p className="mt-0.5 text-[11px] text-faint">{group.detail}</p>
          </div>
          <div className="divide-y divide-line px-4 sm:px-5">
            {group.entries.map((entry) => (
              <Switch
                key={entry.key}
                checked={draft[entry.key]}
                onChange={(checked) => setDraft((previous) => ({ ...previous, [entry.key]: checked }))}
                label={entry.label}
                description={entry.description}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 border-t border-line bg-surface-2/30 px-4 py-2.5 sm:px-5">
            <Bell size={11} className="text-faint" />
            <span className="text-[9.5px] text-faint">Preferences are stored on this device.</span>
          </div>
        </section>
      ))}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-faint">{dirty ? 'You have unsaved notification changes.' : 'Everything is saved.'}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={!dirty} onClick={() => setDraft(prefs)}>
            Reset
          </Button>
          <Button variant="primary" size="sm" icon={Check} disabled={!dirty} onClick={save}>
            Save preferences
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Appearance ------------------------------- */

function AppearanceSection() {
  const theme = useAppStore((state) => state.theme)
  const setTheme = useAppStore((state) => state.setTheme)
  const collapsed = useAppStore((state) => state.sidebarCollapsed)
  const setCollapsed = useAppStore((state) => state.setSidebarCollapsed)
  const { canInstall, installed, promptInstall } = useInstallPrompt()

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-[13.5px] font-medium text-ink">Appearance</h2>
          <p className="mt-0.5 text-[11px] text-faint">Choose the surface that feels right in your working light.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <ThemeCard
            theme="dark"
            active={theme === 'dark'}
            onSelect={() => setTheme('dark')}
            title="Ink"
            description="Deep charcoal with an acid-lime accent. Built for long sessions and low light."
          />
          <ThemeCard
            theme="light"
            active={theme === 'light'}
            onSelect={() => setTheme('light')}
            title="Paper"
            description="Warm paper tones and soft ink. Easier in daylight or on a bright desk."
          />
        </div>
        <div className="border-t border-line px-4 py-1 sm:px-5">
          <Switch
            checked={collapsed}
            onChange={setCollapsed}
            label="Compact desktop sidebar"
            description="Keep navigation icon-only on large screens. The mobile bottom bar is unaffected."
          />
        </div>
        <div className="flex items-start gap-2 border-t border-line bg-surface-2/30 px-4 py-3 sm:px-5">
          <Sparkles size={12} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-[10px] leading-relaxed text-faint">
            RELAY respects your system's reduced-motion setting. Page transitions and count-up animations collapse to
            instant changes when motion is reduced.
          </p>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[13.5px] font-medium text-ink">Install RELAY</h2>
            {installed ? <Badge tone="success">Installed</Badge> : <DemoBadge compact />}
          </div>
          <p className="mt-0.5 text-[11px] text-faint">
            A full-screen app with an offline shell. Installation availability depends on your browser.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <Laptop size={16} className="text-faint" strokeWidth={1.7} />
            <p className="mt-2 text-[11.5px] font-medium text-ink">Desktop</p>
            <p className="mt-1 text-[10px] leading-relaxed text-faint">
              Chrome or Edge: use the install icon in the address bar, or the browser menu → Install RELAY.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <Smartphone size={16} className="text-faint" strokeWidth={1.7} />
            <p className="mt-2 text-[11.5px] font-medium text-ink">Mobile</p>
            <p className="mt-1 text-[10px] leading-relaxed text-faint">
              Safari: Share → Add to Home Screen. Chrome: menu → Add to Home screen.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[10px] text-faint">
            {installed
              ? 'RELAY is already running as an installed app.'
              : canInstall
                ? 'Your browser is ready to install RELAY.'
                : 'Use the browser-specific steps above if no prompt appears.'}
          </p>
          <Button
            variant={canInstall && !installed ? 'primary' : 'secondary'}
            size="sm"
            icon={Download}
            disabled={installed}
            onClick={async () => {
              const result = await promptInstall()
              if (result.outcome === 'unavailable')
                toast.info(
                  'Use your browser’s install option',
                  'Chrome/Edge: menu → Install app. Safari: Share → Add to Home Screen.',
                )
            }}
          >
            {installed ? 'Installed' : canInstall ? 'Install app' : 'How to install'}
          </Button>
        </div>
      </section>
    </div>
  )
}

function ThemeCard({
  theme,
  active,
  onSelect,
  title,
  description,
}: {
  theme: Theme
  active: boolean
  onSelect: () => void
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'group overflow-hidden rounded-xl border text-left transition-all',
        active ? 'border-accent/45 ring-1 ring-accent/20' : 'border-line hover:border-line-strong',
      )}
    >
      <div
        className={cn(
          'relative flex h-[96px] items-end gap-1.5 p-2.5',
          theme === 'dark' ? 'bg-[#0a0b0d]' : 'bg-[#f0ede4]',
        )}
      >
        <div
          className={cn(
            'flex h-full w-7 flex-col items-center gap-1 rounded-md border p-1',
            theme === 'dark' ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-white/60',
          )}
        >
          <span className="h-1 w-3 rounded-full bg-accent" />
          <span className={cn('h-0.5 w-3 rounded-full', theme === 'dark' ? 'bg-white/20' : 'bg-black/15')} />
          <span className={cn('h-0.5 w-3 rounded-full', theme === 'dark' ? 'bg-white/20' : 'bg-black/15')} />
          <span className={cn('h-0.5 w-3 rounded-full', theme === 'dark' ? 'bg-white/20' : 'bg-black/15')} />
        </div>
        <div className="flex h-full flex-1 flex-col gap-1">
          <div className={cn('h-2 w-2/3 rounded-full', theme === 'dark' ? 'bg-white/25' : 'bg-black/25')} />
          <div className="flex flex-1 gap-1">
            <div className={cn('flex-1 rounded border', theme === 'dark' ? 'border-white/10 bg-white/[0.04]' : 'border-black/10 bg-white/70')} />
            <div className={cn('flex-1 rounded border', theme === 'dark' ? 'border-white/10 bg-white/[0.04]' : 'border-black/10 bg-white/70')} />
          </div>
          <div className="h-1.5 w-1/3 rounded-full bg-accent/70" />
        </div>
        {active && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink">
            <Check size={11} strokeWidth={3} />
          </span>
        )}
      </div>
      <div className="flex items-start gap-3 border-t border-line bg-surface px-3 py-2.5">
        <span className="mt-0.5 text-faint">{theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}</span>
        <span className="min-w-0">
          <span className="block text-[11.5px] font-medium text-ink">{title}</span>
          <span className="mt-0.5 block text-[9.5px] leading-relaxed text-faint">{description}</span>
        </span>
      </div>
    </button>
  )
}

/* ------------------------------ Data & device ----------------------------- */

function DataSection() {
  const { data } = useWorkspace()
  const { reset, exportData } = useWorkspaceMaintenance()
  const pending = useSyncStore((state) => state.pending)
  const failed = useSyncStore((state) => state.failed)
  const syncing = useSyncStore((state) => state.syncing)
  const online = useSyncStore((state) => state.online)
  const lastSyncedAt = useSyncStore((state) => state.lastSyncedAt)
  const sync = useSyncStore((state) => state.sync)
  const retry = useSyncStore((state) => state.retry)
  const discard = useSyncStore((state) => state.discard)
  const [resetOpen, setResetOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const navigate = useNavigate()

  const storageSize = useMemo(() => {
    if (!data) return 0
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      return 0
    }
  }, [data])

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-line px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[13.5px] font-medium text-ink">Offline queue</h2>
              <Badge tone={!online ? 'warn' : failed ? 'danger' : pending ? 'info' : 'success'} dot>
                {!online ? 'Offline' : failed ? 'Needs review' : pending ? 'Pending' : 'Clear'}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-faint">
              Changes made offline are queued on this device and reconciled when the connection returns.
            </p>
          </div>
          <WifiOff size={15} className={online ? 'text-faint' : 'text-warn'} />
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <InfoCell label="Pending changes" value={String(pending)} detail="Waiting to sync" />
          <InfoCell label="Failed changes" value={String(failed)} detail="Need a decision" />
          <InfoCell
            label="Last sync"
            value={lastSyncedAt ? relativeTime(lastSyncedAt) : 'Not yet'}
            detail={online ? 'Connection available' : 'No connection'}
          />
        </div>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-[10px] leading-relaxed text-faint">
            Duplicate protection uses an idempotency key for every queued operation, so a retry cannot create a second
            handoff.
          </p>
          <div className="flex flex-wrap gap-2">
            {failed > 0 && (
              <>
                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDiscardOpen(true)}>
                  Discard failed
                </Button>
                <Button variant="secondary" size="sm" icon={RefreshCw} loading={syncing} onClick={() => void retry()}>
                  Retry
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              size="sm"
              icon={CloudOff}
              loading={syncing}
              disabled={!online || pending === 0}
              onClick={() => void sync()}
            >
              Sync now
            </Button>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-[13.5px] font-medium text-ink">Workspace data</h2>
          <p className="mt-0.5 text-[11px] text-faint">
            Everything in this demo is stored in this browser. Export a copy or restore the seeded workspace.
          </p>
        </div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <InfoCell label="Local database" value={formatBytes(storageSize)} detail="relay.demo.db" />
          <InfoCell label="Handoffs" value={String(data?.handoffs.length ?? 0)} detail={`${data?.items.length ?? 0} items`} />
          <InfoCell label="People" value={String(data?.profiles.length ?? 0)} detail={`${data?.teams.length ?? 0} teams`} />
        </div>
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <CloudDownload size={16} className="mt-0.5 shrink-0 text-faint" />
              <div>
                <p className="text-[11.5px] font-medium text-ink">Export the workspace</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-faint">
                  Download a JSON file with profiles, items, handoffs, events and notifications.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={Download}
              loading={exportData.isPending}
              onClick={() => exportData.mutate()}
            >
              Export JSON
            </Button>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-danger/20 bg-danger/[0.045] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <RotateCcw size={16} className="mt-0.5 shrink-0 text-danger" />
              <div>
                <p className="text-[11.5px] font-medium text-ink">Reset demo workspace</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-faint">
                  Restore the original seed data. Every local change, including queued offline edits, will be replaced.
                </p>
              </div>
            </div>
            <Button variant="danger" size="sm" icon={RotateCcw} onClick={() => setResetOpen(true)}>
              Reset demo
            </Button>
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-[13.5px] font-medium text-ink">Device & privacy</h2>
            <HardDrive size={13} className="text-faint" />
          </div>
          <p className="mt-0.5 text-[11px] text-faint">What leaves this browser, and what stays.</p>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <PrivacyLine
            icon={ShieldCheck}
            title="Demo mode has no server"
            body="No handoff, photo or profile is uploaded anywhere. Data is written to localStorage and IndexedDB on this device."
          />
          <PrivacyLine
            icon={Download}
            title="Export is your copy"
            body="The JSON export is generated locally from the same records the interface uses."
          />
          <PrivacyLine
            icon={Trash2}
            title="Reset is destructive"
            body="Resetting restores seed data instead of deleting it. To fully remove local data, clear this site's storage in your browser."
          />
        </div>
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-faint">RELAY 1.0 · Demo workspace</p>
          <Button variant="ghost" size="sm" icon={Settings2} onClick={() => navigate('/activity')}>
            Review activity
          </Button>
        </div>
      </section>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() =>
          reset.mutate(undefined, {
            onSettled: () => setResetOpen(false),
          })
        }
        loading={reset.isPending}
        title="Reset the demo workspace?"
        description="This replaces all local handoffs, items, teams, notifications and queued offline operations with the original seed data."
        confirmLabel="Reset demo workspace"
        cancelLabel="Keep my data"
      >
        <p className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted">
          Your exported JSON files are unaffected. This action cannot be undone from inside RELAY.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() =>
          void discard().then(() => {
            setDiscardOpen(false)
            toast.success('Failed changes discarded')
          })
        }
        title="Discard failed offline changes?"
        description={`${failed} queued change${failed === 1 ? '' : 's'} could not be applied. They will be removed from this device.`}
        confirmLabel="Discard changes"
      />
    </div>
  )
}

function PrivacyLine({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck
  title: string
  body: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-faint">
        <Icon size={13} strokeWidth={1.8} />
      </span>
      <div>
        <p className="text-[11.5px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[10.5px] leading-relaxed text-faint">{body}</p>
      </div>
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-[280px] rounded-[var(--radius-lg)]" />
        <div className="space-y-4">
          <Skeleton className="h-[320px] rounded-[var(--radius-lg)]" />
          <Skeleton className="h-[160px] rounded-[var(--radius-lg)]" />
        </div>
      </div>
    </div>
  )
}
