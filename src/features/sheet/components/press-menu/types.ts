import type { HTMLAttributes } from 'react'

/** What spreads on the part: its handlers, none without a menu. */
export type PressProps = Pick<
  HTMLAttributes<HTMLElement>,
  | 'onContextMenu'
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onPointerLeave'
  | 'onClickCapture'
>
