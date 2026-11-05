import { useState } from 'react'
import { Mail, UserPlus } from 'lucide-react'
import { useTeamActions, useWorkspace } from '@/hooks/useWorkspace'
import { Modal } from '@/components/ui/overlays'
import { SelectField, TextField } from '@/components/ui/forms'

export function InviteMemberDialog({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const { data } = useWorkspace()
  const actions = useTeamActions()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const team = data?.teams.find((entry) => entry.id === teamId)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await actions.invite.mutateAsync({ teamId, email, role })
      onClose()
    } catch {
      // The mutation surfaces the error as a toast.
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Invite to ${team?.name ?? 'team'}`}
      description="They will see an invitation in People & teams. Demo accounts already exist, so this is a real workspace invitation."
      icon={UserPlus}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={actions.invite.isPending}>
            Cancel
          </button>
          <button type="submit" form="invite-form" className="btn btn-primary" disabled={actions.invite.isPending}>
            {actions.invite.isPending ? 'Sending…' : 'Send invitation'}
          </button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="space-y-4 pb-1">
        <TextField
          label="Email address"
          required
          type="email"
          placeholder="name@fieldwork.studio"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leadingIcon={<Mail size={14} />}
        />
        <SelectField
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
          options={[
            { value: 'admin', label: 'Admin — manage people and invitations' },
            { value: 'member', label: 'Member — create and receive handoffs' },
            { value: 'viewer', label: 'Viewer — read-only access' },
          ]}
        />
        <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-faint">
          Invitations use the workspace's email list in demo mode. No email is actually sent, but the invitation is stored
          and can be accepted by the matching demo account.
        </p>
      </form>
    </Modal>
  )
}
