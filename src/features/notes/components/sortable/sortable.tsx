'use client'

import clsx from 'clsx'
import { useSortableDrag } from '@/features/notes/hooks/use-sortable-drag'
import type { SortableProps } from './types'

/**
 * A list put in order (round 0.35.0 §9.4): by dragging a row's grip with a mouse, a finger or a
 * pen; by the up and down keys on a grip, or Home and End; or by a row's arrows. The rows shift as
 * one is dragged past them; it's dropped where it's let go, and put back by Escape. Dragged near
 * the top or bottom of the pane it's in, the pane scrolls, and the drop place follows. Each move
 * is announced: "{title}, now {i} of {n}."
 */
export function Sortable({
  ids,
  onChange,
  titleOf,
  row,
  disabled = false,
}: Readonly<SortableProps>) {
  const { list, drag, said, reduced, move, onKey, begin, shift } =
    useSortableDrag({ ids, onChange, titleOf, disabled })

  return (
    <>
      <ul
        ref={list}
        className={clsx('flex flex-col gap-2', drag && 'select-none')}
      >
        {ids.map((id, index) => {
          const by = shift(index)
          const dragging = drag?.from === index
          return (
            <li
              key={id}
              className='relative'
              style={{
                transform: by === 0 ? undefined : `translateY(${by}px)`,
                // The others ease aside; the dragged one keeps to the pointer.
                transition:
                  drag && !dragging && !reduced
                    ? 'transform 160ms ease'
                    : undefined,
                zIndex: dragging ? 10 : undefined,
              }}
            >
              {row(id, index, {
                dragging,
                grip: {
                  'data-grip': id,
                  onPointerDown: begin(index),
                  onKeyDown: onKey(index),
                },
                up: () => move(index, index - 1),
                down: () => move(index, index + 1),
                first: index === 0,
                last: index === ids.length - 1,
              })}
            </li>
          )
        })}
      </ul>
      {/* Where a row moved to, said once: always here, so it's heard as it changes. */}
      <p aria-live='polite' aria-atomic='true' className='sr-only'>
        {said && <span key={said.n}>{said.words}</span>}
      </p>
    </>
  )
}
