'use client'

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Pane } from '../pane/pane'
import { ReorderRow } from '@/components/sortable/reorder-row'
import { Sortable } from '@/components/sortable/sortable'
import {
  orderRefusalWords,
  reorderLine,
} from '@/features/notes/utils/order-words'
import type { ReorderPaneProps } from './types'

/**
 * A group's notes put in order (round 0.35.0 §9.4), in the reader's place: dragged by their grips,
 * moved by the keys on a grip or by their arrows, then saved whole. The order is the one Reorder
 * opened with; a note added meanwhile isn't in it, so the server refuses the order as changed,
 * and Cancel shows it.
 */
export function ReorderPane({
  title,
  entries,
  kind,
  name,
  onSave,
  onCancel,
}: Readonly<ReorderPaneProps>) {
  const [opened] = useState(() => entries.map(entry => entry.id))
  const [order, setOrder] = useState(opened)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<string>()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])

  const byId = new Map(entries.map(entry => [entry.id, entry]))
  // A note gone from the view meanwhile leaves the list, its title never looked up again.
  const ids = order.filter(id => byId.has(id))
  const unchanged =
    ids.join(',') === opened.filter(id => byId.has(id)).join(',')

  const save = async () => {
    setSaving(true)
    setRefused(undefined)
    try {
      const answer = await onSave(ids)
      // Saved, the caller leaves Reorder; refused, the order made is kept here, to cancel or try
      // again.
      if (!answer.ok) setRefused(orderRefusalWords(answer.reason, name))
    } finally {
      setSaving(false)
    }
  }

  const heading3 = `Reorder ${title}`
  const bar = (
    <h3
      ref={heading}
      tabIndex={-1}
      title={heading3}
      className='min-w-0 flex-1 truncate px-2 font-semibold outline-none'
    >
      {heading3}
    </h3>
  )
  const footer = (
    <div className='flex flex-col gap-2'>
      {refused && (
        <p role='alert' className='text-sm text-danger'>
          {refused}
        </p>
      )}
      <div className='flex items-center justify-end gap-2'>
        <p className='hidden min-w-0 flex-1 text-xs text-text-secondary @min-[640px]:block'>
          Drag a note by its handle, or use the arrows.
        </p>
        {/* Off while it's saving: what's sent is kept or refused, and only then can it be left. */}
        <button
          type='button'
          disabled={saving}
          onClick={onCancel}
          className='min-h-11 shrink-0 rounded-xl border border-border px-4 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-60'
        >
          Cancel
        </button>
        <button
          type='button'
          disabled={saving || unchanged}
          onClick={save}
          className='inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60'
        >
          {saving && (
            <LoaderCircle
              aria-hidden
              className='size-4 motion-safe:animate-spin'
            />
          )}
          Save order
        </button>
      </div>
    </div>
  )

  return (
    <Pane bar={bar} footer={footer}>
      <div className='mx-auto flex w-full max-w-[44rem] flex-col gap-3 px-4 py-5 @min-[640px]:px-8'>
        <p className='text-sm text-text-secondary'>{reorderLine(kind, name)}</p>
        {/* Still while it's saving: what's sent is what's shown, and what's said saved. */}
        <Sortable
          ids={ids}
          onChange={setOrder}
          titleOf={id => byId.get(id)?.title ?? ''}
          disabled={saving}
          row={(id, index, handles) => {
            const entry = byId.get(id)
            return entry ? (
              <ReorderRow
                name={entry.title}
                index={index}
                handles={handles}
                locked={saving}
              >
                <span className='min-w-0 flex-1 px-1.5'>
                  <span
                    title={entry.title}
                    className='block truncate font-medium'
                  >
                    {entry.title}
                  </span>
                  <span className='block truncate text-xs text-text-secondary'>
                    {entry.author
                      ? `Written by ${entry.author.name}`
                      : 'Written in Foundry'}
                  </span>
                </span>
              </ReorderRow>
            ) : undefined
          }}
        />
      </div>
    </Pane>
  )
}
