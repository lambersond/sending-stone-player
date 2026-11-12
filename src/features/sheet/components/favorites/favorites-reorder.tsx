'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { Sortable } from '@/components/sortable/sortable'
import { entryName } from '@/features/sheet/utils/favorite-order'
import type { FavoritesReorderProps } from './types'

/** A row's arrows, as Reorder's notes have theirs. */
const ARROW =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent'

/**
 * The favorites put in order, from module 0.47.0, in the list's place, as the journal's notes
 * are: dragged by their grips, moved by the keys on a grip or by their arrows, shown in the new
 * order at once, then saved whole, as one order. The old-style resources dnd5e lists first aren't
 * among them: they stay first.
 */
export function FavoritesReorder({
  entries,
  onSave,
  onCancel,
}: Readonly<FavoritesReorderProps>) {
  const [order, setOrder] = useState(() => entries.map(entry => entry.key))
  const byKey = new Map(entries.map(entry => [entry.key, entry]))
  // A favorite gone from the sheet meanwhile leaves the list, its name never looked up again.
  const keys = order.filter(key => byKey.has(key))
  const unchanged =
    keys.join('\n') === entries.map(entry => entry.key).join('\n')
  const nameOf = (key: string) => {
    const entry = byKey.get(key)
    return entry ? entryName(entry) : ''
  }

  return (
    <div className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-3'>
      <p className='text-sm text-text-secondary'>
        Drag a favorite by its handle, or use the arrows. Foundry’s sheet shows
        the same order.
      </p>
      <Sortable
        ids={keys}
        onChange={setOrder}
        titleOf={nameOf}
        row={(key, index, handles) => {
          const name = nameOf(key)
          return (
            <div
              className={clsx(
                'flex items-center gap-1 rounded-xl border bg-card p-1',
                handles.dragging ? 'border-primary shadow-lg' : 'border-border',
              )}
            >
              {/* A finger on it drags the row, not the pane; anywhere else scrolls it. */}
              <button
                type='button'
                {...handles.grip}
                aria-label={`Reorder ${name}: drag it, or press the up and down arrows`}
                title='Drag to reorder'
                className='flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-primary/5 active:cursor-grabbing'
              >
                <GripVertical aria-hidden className='size-5' />
              </button>
              <span className='min-w-5 shrink-0 text-right text-xs text-text-secondary tabular-nums'>
                {index + 1}
              </span>
              <span
                title={name}
                className='min-w-0 flex-1 truncate px-1.5 font-medium'
              >
                {name}
              </span>
              <button
                type='button'
                aria-label={`Move ${name} up`}
                disabled={handles.first}
                onClick={handles.up}
                className={ARROW}
              >
                <ArrowUp aria-hidden className='size-5' />
              </button>
              <button
                type='button'
                aria-label={`Move ${name} down`}
                disabled={handles.last}
                onClick={handles.down}
                className={ARROW}
              >
                <ArrowDown aria-hidden className='size-5' />
              </button>
            </div>
          )
        }}
      />
      <div className='flex items-center justify-end gap-2'>
        <button
          type='button'
          onClick={onCancel}
          className='min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
        >
          Cancel
        </button>
        <button
          type='button'
          disabled={unchanged}
          onClick={() => onSave(keys)}
          className='min-h-11 shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
        >
          Save order
        </button>
      </div>
    </div>
  )
}
