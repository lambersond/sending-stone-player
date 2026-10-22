'use client'

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, GripVertical, LoaderCircle } from 'lucide-react'
import { Pane } from './pane'
import { Sortable, type SortableHandles } from './sortable'
import { orderRefusalWords, reorderLine } from '@/utils/order-words'
import type {
  NoteBookKind,
  NoteEntryView,
  NoteWriteAnswer,
} from '@/types/notes'

type Props = {
  /** The group's title: its chapter's, or "Not in a chapter". */
  title: string
  /**
   * The group's notes in their order as Reorder opened: the pane keeps its own list from them,
   * which a later poll changes only by dropping a note gone from the view (as ART:1128-1129
   * filters); a note added meanwhile isn't in it.
   */
  entries: NoteEntryView[]
  kind: NoteBookKind
  /** The book's character or party. */
  name: string
  /** Sends the new order; answers as the write did. */
  onSave(ids: string[]): Promise<NoteWriteAnswer>
  onCancel(): void
}

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
}: Readonly<Props>) {
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
              <Row
                entry={entry}
                index={index}
                handles={handles}
                locked={saving}
              />
            ) : undefined
          }}
        />
      </div>
    </Pane>
  )
}

const ARROW =
  'flex size-11 shrink-0 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-primary/10 hover:text-text-primary disabled:opacity-40 disabled:hover:bg-transparent'

/** A note in the list: its grip, its place from 1, its title and author, and its arrows. */
function Row({
  entry,
  index,
  handles,
  locked,
}: Readonly<{
  entry: NoteEntryView
  index: number
  handles: SortableHandles
  /** The order is being saved: its grip and arrows are off. */
  locked: boolean
}>) {
  return (
    <div
      className={clsx(
        'flex items-center gap-1 rounded-xl border bg-card p-1',
        handles.dragging ? 'border-primary shadow-lg' : 'border-border',
      )}
    >
      {/* A finger on it drags the row, not the pane; anywhere else on the list scrolls it. */}
      <button
        type='button'
        {...handles.grip}
        disabled={locked}
        aria-label={`Reorder ${entry.title}: drag it, or press the up and down arrows`}
        title='Drag to reorder'
        className='flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-primary/5 active:cursor-grabbing disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent'
      >
        <GripVertical aria-hidden className='size-5' />
      </button>
      <span className='min-w-5 shrink-0 text-right text-xs text-text-secondary tabular-nums'>
        {index + 1}
      </span>
      <span className='min-w-0 flex-1 px-1.5'>
        <span title={entry.title} className='block truncate font-medium'>
          {entry.title}
        </span>
        <span className='block truncate text-xs text-text-secondary'>
          {entry.author
            ? `Written by ${entry.author.name}`
            : 'Written in Foundry'}
        </span>
      </span>
      <button
        type='button'
        aria-label={`Move ${entry.title} up`}
        disabled={handles.first || locked}
        onClick={handles.up}
        className={ARROW}
      >
        <ArrowUp aria-hidden className='size-5' />
      </button>
      <button
        type='button'
        aria-label={`Move ${entry.title} down`}
        disabled={handles.last || locked}
        onClick={handles.down}
        className={ARROW}
      >
        <ArrowDown aria-hidden className='size-5' />
      </button>
    </div>
  )
}
