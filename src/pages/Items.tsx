import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Grid2X2,
  LayoutList,
  Package,
  PackageOpen,
  PackagePlus,
  Plus,
  SearchX,
  ShieldAlert,
  Sparkles,
  Wrench,
} from 'lucide-react'
import type { ItemCategory, ItemStatus, ItemView } from '@/types'
import { useWorkspace } from '@/hooks/useWorkspace'
import { enrichItem, getCurrentProfile } from '@/lib/selectors'
import {
  CATEGORIES,
  CONDITION_META,
  CONDITION_ORDER,
  ITEM_STATUS,
  cn,
  formatCurrency,
  pct,
  relativeTime,
  toneColor,
} from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  ConditionPill,
  DemoBadge,
  EmptyState,
  ImageWithFallback,
  Skeleton,
} from '@/components/ui/primitives'
import { SearchField } from '@/components/ui/forms'
import { SegmentedControl } from '@/components/ui/tabs'
import { Menu } from '@/components/ui/overlays'
import { ItemFormDialog } from '@/components/items/ItemFormDialog'
import { useLocalStorage } from '@/hooks/useViewport'

type StatusFilter = ItemStatus | 'all' | 'attention'
type ViewMode = 'grid' | 'list'

export function ItemsPage() {
  const { data, isLoading, isError, refetch } = useWorkspace()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ItemCategory | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [scope, setScope] = useState<'all' | 'mine'>('all')
  const [view, setView] = useLocalStorage<ViewMode>('relay.items.view', 'grid')
  const [addOpen, setAddOpen] = useState(params.get('add') === '1')

  const me = data ? getCurrentProfile(data) : undefined

  useEffect(() => {
    if (params.get('add') === '1') {
      setAddOpen(true)
      const next = new URLSearchParams(params)
      next.delete('add')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const allItems = useMemo(() => {
    if (!data) return [] as ItemView[]
    return data.items
      .map((item) => enrichItem(data, item.id))
      .filter((item): item is ItemView => Boolean(item))
  }, [data])

  const scoped = useMemo(() => {
    if (scope === 'all' || !me) return allItems
    return allItems.filter((item) => item.ownerId === me.id || item.holderId === me.id)
  }, [allItems, scope, me])

  const filtered = useMemo(() => {
    let list = scoped
    if (category !== 'all') list = list.filter((item) => item.category === category)
    if (status === 'attention') list = list.filter((item) => item.condition === 'damaged' || item.condition === 'worn')
    else if (status !== 'all') list = list.filter((item) => item.status === status)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((item) =>
        [item.name, item.serial, item.category, item.location, item.description, item.holder.name, ...item.tags]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    }
    return list
  }, [scoped, category, status, search])

  const stats = useMemo(() => {
    const available = scoped.filter((item) => item.status === 'available').length
    const inHandoff = scoped.filter((item) => item.status === 'in_handoff').length
    const attention = scoped.filter((item) => item.condition === 'damaged' || item.condition === 'worn').length
    const value = scoped.reduce((sum, item) => sum + (item.value ?? 0), 0)
    return { total: scoped.length, available, inHandoff, attention, value }
  }, [scoped])

  const activeFilters = (category !== 'all' ? 1 : 0) + (status !== 'all' ? 1 : 0) + (scope === 'mine' ? 1 : 0)

  const resetFilters = () => {
    setCategory('all')
    setStatus('all')
    setScope('all')
    setSearch('')
  }

  return (
    <div>
      <PageHeader
        eyebrow={
          <>
            <span className="eyebrow">Inventory</span>
            <span className="h-3 w-px bg-line-strong" />
            <DemoBadge />
          </>
        }
        title={
          <>
            My items<span className="text-accent">.</span>
          </>
        }
        description="Everything your team can hand off, with its current holder, condition and chain of custody."
        actions={
          <Button variant="primary" icon={PackagePlus} onClick={() => setAddOpen(true)}>
            Add item
          </Button>
        }
      />

      <div className="card mb-4 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-4 sm:divide-y-0">
          <Stat label="Items" value={String(stats.total)} note="In the selected scope" tone="accent" />
          <Stat
            label="Available"
            value={String(stats.available)}
            note={`${pct(stats.available, stats.total)}% of inventory`}
            tone="success"
          />
          <Stat label="In handoff" value={String(stats.inHandoff)} note="Currently with someone else" tone="info" />
          <Stat
            label="Needs care"
            value={String(stats.attention)}
            note="Worn or damaged condition"
            tone={stats.attention > 0 ? 'warn' : 'neutral'}
          />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto px-1">
          <button
            type="button"
            className={cn('chip shrink-0', category === 'all' && 'chip-accent')}
            data-active={category === 'all'}
            onClick={() => setCategory('all')}
          >
            All categories
            <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-[8.5px]', category === 'all' ? 'bg-black/15' : 'bg-surface-3 text-faint')}>
              {scoped.length}
            </span>
          </button>
          {CATEGORIES.filter((entry) => scoped.some((item) => item.category === entry)).map((entry) => {
            const active = category === entry
            const count = scoped.filter((item) => item.category === entry).length
            return (
              <button
                key={entry}
                type="button"
                className={cn('chip shrink-0', active && 'chip-accent')}
                data-active={active}
                onClick={() => setCategory(entry)}
              >
                {entry}
                <span className={cn('rounded-full px-1.5 py-0.5 font-mono text-[8.5px]', active ? 'bg-black/15' : 'bg-surface-3 text-faint')}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={scope}
            onChange={setScope}
            size="sm"
            options={[
              { value: 'all', label: 'Workspace' },
              { value: 'mine', label: 'Mine' },
            ]}
          />
          <SegmentedControl
            value={view}
            onChange={setView}
            size="sm"
            options={[
              { value: 'grid', label: 'Grid', icon: Grid2X2 },
              { value: 'list', label: 'List', icon: LayoutList },
            ]}
          />
          <div className="relative min-w-[170px] flex-1 sm:w-[220px] sm:flex-none">
            <SearchField value={search} onChange={setSearch} placeholder="Search items, tags, holders…" />
          </div>
          <Menu
            label="Status filters"
            trigger={
              <span className="flex items-center gap-1.5 text-[12px]">
                <Wrench size={13} /> Status
                {activeFilters > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[8px] text-accent-ink">
                    {activeFilters}
                  </span>
                )}
              </span>
            }
            triggerClassName="btn btn-secondary btn-sm !w-auto px-2.5"
            items={[
              { label: 'All statuses', icon: Boxes, onClick: () => setStatus('all') },
              { label: 'Available', icon: Package, onClick: () => setStatus('available') },
              { label: 'In handoff', icon: Sparkles, onClick: () => setStatus('in_handoff') },
              { label: 'Unavailable', icon: PackageOpen, onClick: () => setStatus('unavailable') },
              { label: 'Needs care (worn or damaged)', icon: Wrench, separator: true, onClick: () => setStatus('attention') },
              {
                label: 'Clear filters',
                icon: SearchX,
                danger: true,
                separator: true,
                disabled: activeFilters === 0 && !search,
                onClick: resetFilters,
              },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-[268px] rounded-[var(--radius-lg)]" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={ShieldAlert}
          title="The inventory could not load"
          description="Check your connection and try again. Items already on this device are not affected."
          action={
            <Button variant="primary" onClick={() => void refetch()}>
              Try again
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={search ? SearchX : status === 'attention' ? Wrench : Boxes}
          title={
            search
              ? `No items match “${search}”`
              : status === 'attention'
                ? 'Nothing needs care'
                : 'No items in this view'
          }
          description={
            search
              ? 'Try a different name, serial, tag or holder. Search covers the selected scope.'
              : status === 'attention'
                ? 'Every item in this scope is in good or excellent condition.'
                : 'Add an item to make it available for handoffs, or clear the current filters.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                Add item
              </Button>
              {activeFilters > 0 || search ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          }
        />
      ) : view === 'grid' ? (
        <AnimatePresence initial={false}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((item) => (
              <ItemCard key={item.id} item={item} meId={me?.id} onEdit={() => navigate(`/items/${item.id}?edit=1`)} />
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-line bg-surface">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] items-center gap-4 border-b border-line bg-surface-2/40 px-4 py-2.5 md:grid">
            {['Item', 'Holder', 'Status', 'Condition', ''].map((label) => (
              <span key={label} className="eyebrow text-[9px]">
                {label}
              </span>
            ))}
          </div>
          {filtered.map((item) => (
            <ItemRow key={item.id} item={item} meId={me?.id} />
          ))}
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          <span>
            {filtered.length} of {scoped.length} items · {formatCurrency(stats.value)} tracked value
          </span>
          <span className="flex items-center gap-1">
            <CircleDollarSign size={10} /> Values are demo estimates
          </span>
        </div>
      )}

      <ItemFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(itemId) => navigate(`/items/${itemId}`)}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: string
  note: string
  tone: 'accent' | 'success' | 'info' | 'warn' | 'neutral'
}) {
  return (
    <div className="p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-faint">{label}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: toneColor[tone] }} />
      </div>
      <p className="mt-2 text-[25px] font-medium leading-none tracking-[-0.04em] text-ink tabular">{value}</p>
      <p className="mt-1.5 text-[9.5px] text-faint">{note}</p>
    </div>
  )
}

function ItemCard({ item, meId, onEdit }: { item: ItemView; meId?: string; onEdit: () => void }) {
  const holderIsYou = item.holderId === meId
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="group card card-hover overflow-hidden"
    >
      <Link to={`/items/${item.id}`} className="relative block aspect-[16/10] overflow-hidden border-b border-line">
        <ImageWithFallback
          src={item.image}
          alt={item.name}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
          iconSize={26}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/55 to-transparent p-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.1em] backdrop-blur"
            style={{
              color: `var(--${ITEM_STATUS[item.status].tone === 'neutral' ? 'muted' : ITEM_STATUS[item.status].tone})`,
              borderColor: 'rgba(255,255,255,0.16)',
              backgroundColor: 'rgba(0,0,0,0.42)',
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {ITEM_STATUS[item.status].label}
          </span>
          {item.condition === 'damaged' && <Badge tone="danger">Needs care</Badge>}
        </div>
        <div className="absolute inset-x-3 bottom-2 flex items-end justify-between gap-2">
          <span className="rounded-md bg-black/55 px-1.5 py-1 font-mono text-[9px] text-white/80 backdrop-blur">
            {item.serial}
          </span>
          <span className="rounded-md bg-black/55 px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-white/80 backdrop-blur">
            {item.category}
          </span>
        </div>
      </Link>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to={`/items/${item.id}`} className="tap-link block truncate text-[13.5px] font-medium text-ink hover:text-accent">
              {item.name}
            </Link>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-faint">
              <span>{holderIsYou ? 'With you' : `With ${item.holder.name.split(' ')[0]}`}</span>
              <span>·</span>
              <span>{item.location}</span>
            </p>
          </div>
          <Menu
            label={`${item.name} actions`}
            trigger={<ChevronRight size={15} />}
            items={[
              { label: 'Open item', icon: ArrowUpRight, onClick: () => window.location.assign(`/items/${item.id}`) },
              { label: 'Edit record', icon: Wrench, onClick: onEdit },
              {
                label: 'Create handoff',
                icon: PackagePlus,
                onClick: () => window.location.assign(`/handoffs/new?itemId=${item.id}`),
              },
            ]}
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <ConditionPill condition={item.condition} />
          {item.activeHandoff && (
            <Link to={`/handoffs/${item.activeHandoff.id}`} className="tap-link badge border-line bg-surface-2 text-muted">
              {item.activeHandoff.code}
            </Link>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
          <div className="min-w-0">
            <p className="truncate text-[10px] text-muted">
              {item.activeHandoff ? `Due ${relativeTime(item.activeHandoff.dueAt)}` : `Updated ${relativeTime(item.updatedAt)}`}
            </p>
            <p className="truncate text-[9px] text-faint">Owner · {item.owner.id === meId ? 'You' : item.owner.name}</p>
          </div>
          <Link to={`/handoffs/new?itemId=${item.id}`} className="btn btn-secondary btn-sm shrink-0">
            Hand off <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </motion.article>
  )
}

function ItemRow({ item, meId }: { item: ItemView; meId?: string }) {
  return (
    <div className="group flex items-center gap-3 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/50">
      <Link to={`/items/${item.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <ImageWithFallback
          src={item.image}
          alt={item.name}
          className="h-11 w-11 shrink-0 rounded-lg border border-line"
          iconSize={16}
        />
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-medium text-ink">{item.name}</p>
          <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-faint">
            {item.category} · {item.serial} · {item.location}
          </p>
        </div>
      </Link>
      <div className="hidden min-w-0 flex-1 md:block">
        <p className="truncate text-[11px] text-muted">
          {item.holderId === meId ? 'You' : item.holder.name}
        </p>
        <p className="truncate text-[9.5px] text-faint">
          {item.ownerId === meId ? 'You own this' : `Owned by ${item.owner.name}`}
        </p>
      </div>
      <div className="hidden w-[80px] md:block">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: toneColor[ITEM_STATUS[item.status].tone] }}
          />
          {ITEM_STATUS[item.status].label}
        </span>
      </div>
      <div className="w-[92px]">
        <ConditionPill condition={item.condition} showDot={false} />
      </div>
      <Link to={`/items/${item.id}`} className="btn btn-ghost btn-icon btn-sm shrink-0" aria-label={`Open ${item.name}`}>
        <ArrowRight size={14} />
      </Link>
    </div>
  )
}

export function ItemQuickFacts({ item }: { item: ItemView }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-faint">
      <span>{CONDITION_ORDER.indexOf(item.condition) >= 0 ? CONDITION_META[item.condition].label : ''}</span>
      <span>·</span>
      <span>{item.serial}</span>
    </div>
  )
}
