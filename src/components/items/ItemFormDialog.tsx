import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import type { z } from 'zod'
import type { Item } from '@/types'
import { itemSchema } from '@/lib/validation'
import { useCreateItem, useUpdateItem, useWorkspace } from '@/hooks/useWorkspace'
import { getCurrentProfile } from '@/lib/selectors'
import { CATEGORIES, CONDITION_META, CONDITION_ORDER } from '@/lib/utils'
import { Modal } from '@/components/ui/overlays'
import { SelectField, SingleImageUpload, TagInput, TextAreaField, TextField } from '@/components/ui/forms'

type ItemValues = z.input<typeof itemSchema>
type ItemOutput = z.output<typeof itemSchema>

export function ItemFormDialog({
  open,
  onClose,
  item,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  item?: Item
  onCreated?: (itemId: string) => void
}) {
  const { data } = useWorkspace()
  const createItem = useCreateItem()
  const updateItem = useUpdateItem()
  const me = data ? getCurrentProfile(data) : undefined
  const editing = Boolean(item)
  const pending = createItem.isPending || updateItem.isPending

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ItemValues, unknown, ItemOutput>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      name: '',
      description: '',
      category: 'Computing',
      serial: '',
      ownerId: me?.id ?? '',
      condition: 'good',
      location: '',
      value: undefined,
      image: '',
      tags: [],
    },
  })

  useEffect(() => {
    if (!open) return
    if (item) {
      reset({
        name: item.name,
        description: item.description,
        category: item.category,
        serial: item.serial,
        ownerId: item.ownerId,
        condition: item.condition,
        location: item.location,
        value: item.value,
        image: item.image,
        tags: item.tags,
      })
    } else {
      reset({
        name: '',
        description: '',
        category: 'Computing',
        serial: '',
        ownerId: me?.id ?? data?.profiles[0]?.id ?? '',
        condition: 'good',
        location: '',
        value: undefined,
        image: '',
        tags: [],
      })
    }
  }, [open, item, reset, me?.id, data?.profiles])

  const cover = watch('image')
  const tags = watch('tags') ?? []

  const submit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      description: values.description,
      category: values.category,
      serial: values.serial,
      ownerId: values.ownerId,
      condition: values.condition,
      location: values.location,
      value: values.value,
      image: values.image || '/img/studio.jpg',
      tags: values.tags,
    }
    try {
      if (item) {
        await updateItem.mutateAsync({ itemId: item.id, patch: { ...payload } })
      } else {
        const result = await createItem.mutateAsync(payload)
        onCreated?.(result.item.id)
      }
      onClose()
    } catch {
      // Errors are surfaced as toasts by the mutation hooks; keep the form open.
    }
  })

  const owners = data?.profiles ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit item' : 'Add an item'}
      description={
        editing
          ? 'Update the record, cover image or condition. Changes are written to the item history.'
          : 'Add something your team can hand off. You can attach photos and a return location.'
      }
      icon={PackagePlus}
      size="lg"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add item'}
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="space-y-4 pb-1">
        <div className="grid gap-4 sm:grid-cols-[1fr_168px]">
          <div className="space-y-4">
            <TextField
              label="Item name"
              required
              placeholder="e.g. Leica Q3"
              error={errors.name?.message}
              {...register('name')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Category"
                options={CATEGORIES.map((category) => ({ value: category, label: category }))}
                error={errors.category?.message}
                {...register('category')}
              />
              <SelectField
                label="Condition"
                options={CONDITION_ORDER.map((condition) => ({
                  value: condition,
                  label: `${CONDITION_META[condition].label} — ${CONDITION_META[condition].blurb}`,
                }))}
                error={errors.condition?.message}
                {...register('condition')}
              />
            </div>
          </div>
          <SingleImageUpload
            label="Cover image"
            value={cover || undefined}
            onChange={(next) => setValue('image', next ?? '', { shouldDirty: true })}
            aspect="aspect-[4/3]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Owner"
            options={owners.map((profile) => ({ value: profile.id, label: profile.name }))}
            error={errors.ownerId?.message}
            {...register('ownerId')}
          />
          <TextField
            label="Location"
            placeholder="e.g. Studio · Shelf B"
            error={errors.location?.message}
            {...register('location')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Serial or asset tag"
            optional
            placeholder="Generated if left blank"
            error={errors.serial?.message}
            {...register('serial')}
          />
          <TextField
            label="Value (USD)"
            optional
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 3200"
            error={errors.value?.message}
            {...register('value')}
          />
        </div>

        <TextAreaField
          label="Description"
          optional
          placeholder="What is it, what is included, and anything the next holder should know."
          error={errors.description?.message}
          maxLength={500}
          showCount
          {...register('description')}
        />

        <div>
          <span className="label">Tags</span>
          <TagInput
            value={tags}
            onChange={(next) => setValue('tags', next, { shouldDirty: true })}
            placeholder="Add a tag and press Enter"
          />
          <p className="field-hint">Tags help people find shared gear. Up to eight.</p>
        </div>

        <p className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-faint">
          {editing
            ? 'Editing an item does not alter historical handoff records. The condition history stays intact.'
            : 'In demo mode the item is stored on this device. The same form maps to the Supabase items table when configured.'}
        </p>
      </form>
    </Modal>
  )
}
