import clsx from 'clsx'
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react'
import { SQUARE_ICON_BUTTON } from '@/constants/buttons'
import type { ReorderRowProps } from './types'

/** A row's arrows, dimmed where it can't move so. */
const ARROW = `${SQUARE_ICON_BUTTON} disabled:opacity-40 disabled:hover:bg-transparent`

/**
 * A row in Reorder, a group's note's and from module 0.47.0 a character's favorite's: its grip,
 * its place from 1, what it shows of itself, and its up and down arrows, each named for it.
 */
export function ReorderRow({
  name,
  index,
  handles,
  locked = false,
  children,
}: Readonly<ReorderRowProps>) {
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
        aria-label={`Reorder ${name}: drag it, or press the up and down arrows`}
        title='Drag to reorder'
        className='flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-primary/5 active:cursor-grabbing disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent'
      >
        <GripVertical aria-hidden className='size-5' />
      </button>
      <span className='min-w-5 shrink-0 text-right text-xs text-text-secondary tabular-nums'>
        {index + 1}
      </span>
      {children}
      <button
        type='button'
        aria-label={`Move ${name} up`}
        disabled={handles.first || locked}
        onClick={handles.up}
        className={ARROW}
      >
        <ArrowUp aria-hidden className='size-5' />
      </button>
      <button
        type='button'
        aria-label={`Move ${name} down`}
        disabled={handles.last || locked}
        onClick={handles.down}
        className={ARROW}
      >
        <ArrowDown aria-hidden className='size-5' />
      </button>
    </div>
  )
}
