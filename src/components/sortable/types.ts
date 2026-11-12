import { type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/** What a row is given to be moved by: its grip, its arrows, and where it is. */
export type SortableHandles = {
  dragging: boolean
  /** Spread on the row's grip button: `data-grip`, and its pointer and key handlers. */
  grip: {
    'data-grip': string
    onPointerDown(event: PointerEvent<HTMLButtonElement>): void
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>): void
  }
  up(): void
  down(): void
  first: boolean
  last: boolean
}

export type SortableProps = {
  ids: string[]
  onChange(ids: string[]): void
  /** A row's title, such as a note's, for what's announced as it moves. */
  titleOf(id: string): string
  row(id: string, index: number, handles: SortableHandles): ReactNode
  /**
   * Nothing moves while it's on, as while the order made is being saved: what's sent is what's
   * shown. A drag in progress as it goes on is put back.
   */
  disabled?: boolean
}

/** A row dragged: from where, to where it would drop now, how far, and how far it moves others. */
export type Drag = {
  from: number
  to: number
  /** How far it's been dragged, in pixels, against the list. */
  dy: number
  /** Its height and the gap after it: how far each row it passes shifts to make room. */
  size: number
}
