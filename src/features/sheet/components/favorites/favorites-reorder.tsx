'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ReorderRow } from '@/components/sortable/reorder-row'
import { Sortable } from '@/components/sortable/sortable'
import { entryName } from '@/features/sheet/utils/favorite-order'
import type { FavoritesReorderProps } from './types'

/**
 * The favorites put in order, from module 0.47.0, in the list's place, as the journal's notes
 * are: dragged by their grips, moved by the keys on a grip or by their arrows, shown in the new
 * order at once, then saved whole, as one order. The old-style resources dnd5e lists first aren't
 * among them: they stay first. Opened, its heading takes focus, as Reorder's notes' does.
 */
export function FavoritesReorder({
  entries,
  onSave,
  onCancel,
}: Readonly<FavoritesReorderProps>) {
  const [order, setOrder] = useState(() => entries.map(entry => entry.key))
  const headingId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
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
    <section
      aria-labelledby={headingId}
      className='flex flex-col gap-3 rounded-2xl border border-border bg-card p-3'
    >
      <h3
        ref={heading}
        id={headingId}
        tabIndex={-1}
        className='font-semibold outline-none'
      >
        Reorder favorites
      </h3>
      <p className='-mt-2 text-sm text-text-secondary'>
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
            <ReorderRow name={name} index={index} handles={handles}>
              <span
                title={name}
                className='min-w-0 flex-1 truncate px-1.5 font-medium'
              >
                {name}
              </span>
            </ReorderRow>
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
    </section>
  )
}
