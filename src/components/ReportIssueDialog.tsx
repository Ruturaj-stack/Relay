import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { TriangleAlert } from 'lucide-react'
import type { z } from 'zod'
import { issueSchema } from '@/lib/validation'
import { useIssueActions, useWorkspace } from '@/hooks/useWorkspace'
import { queryHandoffs } from '@/lib/selectors'
import { Modal } from '@/components/ui/overlays'
import { SelectField, TextAreaField, TextField } from '@/components/ui/forms'

type IssueValues = z.infer<typeof issueSchema>

export function ReportIssueDialog({
  open,
  onClose,
  handoffId,
}: {
  open: boolean
  onClose: () => void
  handoffId?: string
}) {
  const { data } = useWorkspace()
  const issue = useIssueActions()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IssueValues>({
    resolver: zodResolver(issueSchema),
    defaultValues: { handoffId: handoffId ?? '', title: '', detail: '' },
  })

  useEffect(() => {
    if (open) reset({ handoffId: handoffId ?? '', title: '', detail: '' })
  }, [open, handoffId, reset])

  const handoffs = data ? queryHandoffs(data, { status: 'active' }) : []
  const options = handoffs.length
    ? handoffs.map((handoff) => ({
        value: handoff.id,
        label: `${handoff.code} · ${handoff.item.name}`,
      }))
    : []

  const submit = handleSubmit(async (values) => {
    await issue.mutateAsync({
      handoffId: values.handoffId || undefined,
      title: values.title,
      detail: values.detail,
    })
    onClose()
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report an issue"
      description="Log a damage report, missing accessory or a handoff that needs attention."
      icon={TriangleAlert}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={issue.isPending}>
            Cancel
          </button>
          <button type="submit" form="issue-form" className="btn btn-primary" disabled={issue.isPending}>
            {issue.isPending ? 'Reporting…' : 'Report issue'}
          </button>
        </>
      }
    >
      <form id="issue-form" onSubmit={submit} className="space-y-4 pb-1">
        {options.length > 0 && (
          <SelectField
            label="Related handoff"
            optional
            options={[{ value: '', label: 'No specific handoff' }, ...options]}
            error={errors.handoffId?.message}
            {...register('handoffId')}
          />
        )}
        <TextField
          label="What happened?"
          required
          placeholder="e.g. Charger missing from the laptop sleeve"
          error={errors.title?.message}
          {...register('title')}
        />
        <TextAreaField
          label="Details"
          required
          placeholder="Add what you saw, when you noticed it, and anything the team should do next."
          error={errors.detail?.message}
          maxLength={600}
          showCount
          {...register('detail')}
        />
        <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-faint">
          Issues are added to the handoff trust record and shared with the people involved. If you are offline, the report
          is saved on this device and synced when you reconnect.
        </p>
      </form>
    </Modal>
  )
}
