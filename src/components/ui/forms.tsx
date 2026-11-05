import {
  forwardRef,
  useId,
  useRef,
  useState,
  type ComponentProps,
  type DragEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ImagePlus, Plus, Search, UploadCloud, X } from 'lucide-react'
import { cn, isImageFile, readFileAsDataUrl } from '@/lib/utils'
import { toast } from '@/store/appStore'

/* --------------------------------- Fields -------------------------------- */

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  optional,
  children,
  className,
}: {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  optional?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <label className="label mb-0" htmlFor={htmlFor}>
            {label}
            {required && <span className="ml-1 text-accent">*</span>}
          </label>
          {optional && <span className="text-[10px] text-faint">Optional</span>}
        </div>
      )}
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends ComponentProps<'input'> {
  label?: string
  error?: string
  hint?: string
  optional?: boolean
  leadingIcon?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, optional, leadingIcon, className, id, required, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} required={required} optional={optional}>
      <div className="relative">
        {leadingIcon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">{leadingIcon}</span>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={cn('input', leadingIcon ? 'pl-9' : undefined, className)}
          aria-invalid={Boolean(error)}
          required={required}
          {...props}
        />
      </div>
    </Field>
  )
})

interface TextAreaFieldProps extends ComponentProps<'textarea'> {
  label?: string
  error?: string
  hint?: string
  optional?: boolean
  maxLength?: number
  showCount?: boolean
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, optional, className, id, showCount, maxLength, value, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <Field
      label={label}
      htmlFor={fieldId}
      error={error}
      hint={hint}
      optional={optional}
      className={className}
    >
      <div className="relative">
        <textarea
          ref={ref}
          id={fieldId}
          className={cn('textarea', showCount && 'pb-7')}
          aria-invalid={Boolean(error)}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {showCount && maxLength && (
          <span className="pointer-events-none absolute bottom-2.5 right-3 font-mono text-[10px] text-faint">
            {String(value ?? '').length}/{maxLength}
          </span>
        )}
      </div>
    </Field>
  )
})

interface SelectFieldProps extends ComponentProps<'select'> {
  label?: string
  error?: string
  hint?: string
  optional?: boolean
  options: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, optional, options, placeholder, className, id, ...props },
  ref,
) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  return (
    <Field label={label} htmlFor={fieldId} error={error} hint={hint} optional={optional}>
      <select
        ref={ref}
        id={fieldId}
        className={cn('select', className)}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
})

/* -------------------------------- Switch --------------------------------- */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-[11.5px] leading-relaxed text-faint">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-accent/50 bg-accent' : 'border-line-strong bg-surface-3',
          disabled && 'opacity-40',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 550, damping: 34 }}
          className={cn(
            'absolute top-[2px] h-[16px] w-[16px] rounded-full',
            checked ? 'left-[19px] bg-accent-ink' : 'left-[2px] bg-muted',
          )}
        />
      </button>
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border transition-all',
          checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface-2 text-transparent',
        )}
      >
        <Check size={11} strokeWidth={3} />
      </button>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[11.5px] leading-relaxed text-faint">{description}</span>}
      </span>
    </label>
  )
}

/* ------------------------------- Search ---------------------------------- */

export function SearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
  onClear,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  onClear?: () => void
  autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input h-9 pl-9 pr-8 text-[12.5px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('')
            onClear?.()
          }}
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-faint hover:text-ink"
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

/* ------------------------------- File drop ------------------------------- */

export function ImageDropzone({
  value,
  onChange,
  max = 4,
  label = 'Add photographs',
  hint = 'PNG or JPG, up to 8MB each. Stored locally in demo mode.',
  compact,
}: {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  label?: string
  hint?: string
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [reading, setReading] = useState(false)

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const available = max - value.length
    if (available <= 0) {
      toast.warning(`Up to ${max} photographs`, 'Remove one before adding another.')
      return
    }
    const accepted: string[] = []
    setReading(true)
    for (const file of Array.from(files).slice(0, available)) {
      if (!isImageFile(file)) {
        toast.error('That file cannot be added', 'Use a PNG or JPG under 8MB.')
        continue
      }
      try {
        accepted.push(await readFileAsDataUrl(file))
      } catch {
        toast.error('Could not read that image', 'Try a different file.')
      }
    }
    setReading(false)
    if (accepted.length) onChange([...value, ...accepted])
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void handleFiles(event.dataTransfer.files)
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        <span className="font-mono text-[10px] text-faint">
          {value.length}/{max}
        </span>
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'group flex cursor-pointer flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed px-5 text-center transition-all',
          compact ? 'py-6' : 'py-8',
          dragging
            ? 'border-accent bg-accent-soft'
            : 'border-line-strong bg-surface-2/50 hover:border-line-strong hover:bg-surface-2',
        )}
        aria-label="Upload photographs"
      >
        <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors group-hover:text-ink">
          {reading ? <span className="h-4 w-4 animate-spin rounded-full border border-line border-t-accent" /> : <UploadCloud size={17} strokeWidth={1.6} />}
        </div>
        <p className="text-[12px] font-medium text-ink">Drop images here or browse</p>
        <p className="mt-1 max-w-[300px] text-[10.5px] leading-relaxed text-faint">{hint}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      <AnimatePresence initial={false}>
        {value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 grid grid-cols-4 gap-2 overflow-hidden sm:grid-cols-6"
          >
            {value.map((src, index) => (
              <motion.div
                key={`${src.slice(-20)}-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                className="group relative aspect-square overflow-hidden rounded-lg border border-line"
              >
                <img src={src} alt={`Upload ${index + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photograph ${index + 1}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onChange(value.filter((_, i) => i !== index))
                  }}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/65 text-white backdrop-blur-sm transition-opacity hover:bg-black/85 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SingleImageUpload({
  value,
  onChange,
  label = 'Cover image',
  aspect = 'aspect-[4/3]',
}: {
  value?: string
  onChange: (next?: string) => void
  label?: string
  aspect?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const read = async (file?: File) => {
    if (!file) return
    if (!isImageFile(file)) {
      toast.error('Use a PNG or JPG under 8MB.')
      return
    }
    try {
      onChange(await readFileAsDataUrl(file))
    } catch {
      toast.error('Could not read that image.')
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{label}</span>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="text-[10.5px] text-faint hover:text-danger">
            Remove
          </button>
        )}
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          void read(event.dataTransfer.files[0])
        }}
        className={cn(
          'relative w-full cursor-pointer overflow-hidden rounded-[var(--radius-md)] border border-dashed transition-all',
          aspect,
          dragging ? 'border-accent bg-accent-soft' : value ? 'border-line' : 'border-line-strong bg-surface-2/60 hover:bg-surface-2',
        )}
      >
        {value ? (
          <>
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all hover:bg-black/35 hover:opacity-100">
              <span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[11px] text-white backdrop-blur">
                <ImagePlus size={13} /> Replace
              </span>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <ImagePlus size={20} className="text-faint" strokeWidth={1.5} />
            <span className="text-[11.5px] text-muted">Drop an image or browse</span>
            <span className="text-[10px] text-faint">PNG / JPG up to 8MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            void read(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

/* -------------------------------- Tag input ------------------------------ */

export function TagInput({
  value,
  onChange,
  max = 8,
  placeholder = 'Add a tag and press Enter',
}: {
  value: string[]
  onChange: (next: string[]) => void
  max?: number
  placeholder?: string
}) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const tag = draft.trim()
    if (!tag) return
    if (value.includes(tag)) {
      setDraft('')
      return
    }
    if (value.length >= max) {
      toast.warning(`Up to ${max} tags`)
      return
    }
    onChange([...value, tag])
    setDraft('')
  }
  return (
    <div>
      <div className="input flex h-auto min-h-[42px] flex-wrap items-center gap-1.5 py-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-3 px-2 py-1 text-[10.5px] text-muted"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((entry) => entry !== tag))}
              className="text-faint hover:text-ink"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              add()
            }
            if (event.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={add}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[100px] flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-faint"
        />
      </div>
    </div>
  )
}

/* -------------------------------- Tag pill ------------------------------- */

export function AddTagButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="chip border-dashed">
      <Plus size={12} /> {children}
    </button>
  )
}
