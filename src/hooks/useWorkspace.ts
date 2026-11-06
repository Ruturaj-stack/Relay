import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DemoDatabase, ItemCondition, Team, TeamRole } from '@/types'
import {
  acceptInvitation,
  archiveItem,
  cancelInvitation,
  clearReadNotifications,
  createHandoff,
  createItem,
  createTeam,
  exportWorkspaceData,
  fetchWorkspace,
  generateProof,
  inviteMember,
  markAllNotificationsRead,
  markNotificationRead,
  removeTeamMember,
  reportIssue,
  resetWorkspace,
  signInDemo,
  signOutDemo,
  signUpDemo,
  updateHandoff,
  updateItem,
  updateProfile,
  updateTeamMemberRole,
} from '@/lib/api'
import type { CreateHandoffInput, CreateItemInput, HandoffActionInput, HandoffMutationResult } from '@/lib/api'
import { getCurrentProfile } from '@/lib/selectors'
import { toast } from '@/store/appStore'

const workspaceKey = ['workspace'] as const

export function useWorkspace() {
  return useQuery({
    queryKey: workspaceKey,
    queryFn: fetchWorkspace,
    staleTime: 15_000,
    retry: 1,
  })
}

export function useCurrentUser() {
  const query = useWorkspace()
  const profile = query.data ? getCurrentProfile(query.data) : undefined
  return {
    ...query,
    user: profile,
    isAuthenticated: Boolean(profile),
    organization: query.data?.organization,
  }
}

function useInvalidate() {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: workspaceKey })
  }
}

export function useSignIn() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => signInDemo(input.email, input.password),
    onSuccess: async (profile) => {
      await invalidate()
      toast.success(`Welcome back, ${profile.name.split(' ')[0]}`, 'Your workspace is ready.')
    },
    onError: (error: Error) => toast.error('Could not sign in', error.message),
  })
}

export function useSignUp() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: signUpDemo,
    onSuccess: async () => {
      await invalidate()
      toast.success('Account created', 'You are signed in to the demo workspace.')
    },
    onError: (error: Error) => toast.error('Could not create account', error.message),
  })
}

export function useSignOut() {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signOutDemo,
    onSuccess: () => {
      queryClient.clear()
      invalidate()
    },
    onError: (error: Error) => toast.error('Could not sign out', error.message),
  })
}

export function useCreateHandoff() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateHandoffInput) => createHandoff(input),
    onSuccess: async (result) => {
      await invalidate()
      if (result.offline) {
        toast.info('Handoff saved on this device', 'It will sync automatically when you are back online.')
      }
    },
    onError: (error: Error) => toast.error('Handoff not created', error.message),
  })
}

export function useHandoffAction() {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: HandoffActionInput) => updateHandoff(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: workspaceKey })
      const previous = queryClient.getQueryData<DemoDatabase>(workspaceKey)
      if (previous) {
        queryClient.setQueryData<DemoDatabase>(workspaceKey, {
          ...previous,
          handoffs: previous.handoffs.map((handoff) =>
            handoff.id === input.handoffId ? { ...handoff, pendingSync: true } : handoff,
          ),
        })
      }
      return { previous }
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(workspaceKey, context.previous)
      toast.error('Action failed', error.message)
    },
    onSuccess: async (result) => {
      await invalidate()
      if (result.offline) toast.info('Change saved offline', 'RELAY will reconcile it when the connection returns.')
    },
  })
}

export function useConfirmReceipt() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: {
      handoffId: string
      condition: ItemCondition
      note?: string
      photo?: string
      method?: 'qr' | 'manual'
    }) => generateProof(input),
    onSuccess: async (result) => {
      await invalidate()
      toast.success(
        'Receipt confirmed',
        result.offline
          ? 'Proof is stored on this device and will sync when you reconnect.'
          : 'The proof and condition record are now on the handoff timeline.',
      )
    },
    onError: (error: Error) => toast.error('Confirmation failed', error.message),
  })
}

export function useCreateItem() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateItemInput) => createItem(input),
    onSuccess: async (result) => {
      await invalidate()
      toast.success('Item added', result.offline ? 'Saved on this device until you reconnect.' : 'It is ready to hand off.')
    },
    onError: (error: Error) => toast.error('Item not added', error.message),
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: { itemId: string; patch: Record<string, unknown> }) =>
      updateItem(input.itemId, input.patch),
    onSuccess: async () => {
      await invalidate()
      toast.success('Item updated')
    },
    onError: (error: Error) => toast.error('Item not updated', error.message),
  })
}

export function useArchiveItem() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (itemId: string) => archiveItem(itemId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Item archived', 'It will no longer appear as available.')
    },
    onError: (error: Error) => toast.error('Item not archived', error.message),
  })
}

export function useNotificationActions() {
  const invalidate = useInvalidate()
  const queryClient = useQueryClient()
  const read = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: (id) => {
      const previous = queryClient.getQueryData<DemoDatabase>(workspaceKey)
      if (previous) {
        queryClient.setQueryData<DemoDatabase>(workspaceKey, {
          ...previous,
          notifications: previous.notifications.map((notification) =>
            notification.id === id ? { ...notification, read: true } : notification,
          ),
        })
      }
      return { previous }
    },
    onError: (error: Error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(workspaceKey, context.previous)
      toast.error('Could not update notification', error.message)
    },
    onSettled: invalidate,
  })
  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: async () => {
      await invalidate()
      toast.success('All caught up', 'Every notification is marked as read.')
    },
    onError: (error: Error) => toast.error('Could not update notifications', error.message),
  })
  const clearRead = useMutation({
    mutationFn: clearReadNotifications,
    onSuccess: async () => {
      await invalidate()
      toast.success('Read notifications cleared')
    },
    onError: (error: Error) => toast.error('Could not clear notifications', error.message),
  })
  return { read, readAll, clearRead }
}

export function useTeamActions() {
  const invalidate = useInvalidate()
  const create = useMutation<Team, Error, { name: string; description?: string; color: string }>({
    mutationFn: createTeam,
    onSuccess: async (team) => {
      await invalidate()
      toast.success('Team created', `${team.name} is ready for members.`)
    },
    onError: (error) => toast.error('Team not created', error.message),
  })
  const invite = useMutation({
    mutationFn: inviteMember,
    onSuccess: async (_, input) => {
      await invalidate()
      toast.success('Invitation sent', `An invitation was sent to ${input.email}.`)
    },
    onError: (error: Error) => toast.error('Invitation not sent', error.message),
  })
  const role = useMutation({
    mutationFn: (input: { teamId: string; profileId: string; role: TeamRole }) => updateTeamMemberRole(input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Role updated')
    },
    onError: (error: Error) => toast.error('Role not updated', error.message),
  })
  const remove = useMutation({
    mutationFn: (input: { teamId: string; profileId: string }) => removeTeamMember(input),
    onSuccess: async () => {
      await invalidate()
      toast.success('Member removed')
    },
    onError: (error: Error) => toast.error('Member not removed', error.message),
  })
  const cancelInvite = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: async () => {
      await invalidate()
      toast.success('Invitation cancelled')
    },
    onError: (error: Error) => toast.error('Invitation not cancelled', error.message),
  })
  const acceptInvite = useMutation({
    mutationFn: acceptInvitation,
    onSuccess: async () => {
      await invalidate()
      toast.success('You joined the team')
    },
    onError: (error: Error) => toast.error('Could not join team', error.message),
  })
  return { create, invite, role, remove, cancelInvite, acceptInvite }
}

export function useProfileActions() {
  const invalidate = useInvalidate()
  const update = useMutation({
    mutationFn: (input: { profileId: string; patch: Record<string, unknown> }) =>
      updateProfile(input.profileId, input.patch),
    onSuccess: async () => {
      await invalidate()
      toast.success('Profile updated')
    },
    onError: (error: Error) => toast.error('Profile not updated', error.message),
  })
  return { update }
}

export function useIssueActions() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: reportIssue,
    onSuccess: async (result) => {
      await invalidate()
      toast.success(
        'Issue reported',
        result.offline ? 'Saved offline and queued for your team.' : 'Your team has been notified.',
      )
    },
    onError: (error: Error) => toast.error('Issue not reported', error.message),
  })
}

export function useWorkspaceMaintenance() {
  const invalidate = useInvalidate()
  const reset = useMutation({
    mutationFn: resetWorkspace,
    onSuccess: async () => {
      await invalidate()
      toast.success('Demo workspace reset', 'Seed data has been restored.')
    },
    onError: (error: Error) => toast.error('Reset failed', error.message),
  })
  const exportData = useMutation({
    mutationFn: exportWorkspaceData,
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'relay-workspace-export.json'
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Workspace exported', 'A JSON copy has been downloaded.')
    },
    onError: (error: Error) => toast.error('Export failed', error.message),
  })
  return { reset, exportData }
}

export type { HandoffMutationResult }
