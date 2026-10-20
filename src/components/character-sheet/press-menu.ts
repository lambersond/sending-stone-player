'use client'

import { useRef, type HTMLAttributes, type SyntheticEvent } from 'react'
import { LONG_PRESS, pointWithin } from './roll-button'
import type { MenuPoint } from './roll-menu'

/** How far a touch may move and still count as held, in pixels, as a roll's. */
const DRIFT = 10

/** What a press on any of these inside the part is: that control's, never the part's. */
const CONTROLS = 'button, a, input, select, textarea'

/** What spreads on the part: its handlers, none without a menu. */
type PressProps = Pick<
  HTMLAttributes<HTMLElement>,
  | 'onContextMenu'
  | 'onPointerDown'
  | 'onPointerMove'
  | 'onPointerUp'
  | 'onPointerCancel'
  | 'onPointerLeave'
  | 'onClickCapture'
>

/** Whether the press is on a control of its own inside the part, such as a row's Take. */
function onControl(event: SyntheticEvent<HTMLElement>): boolean {
  const part = event.currentTarget
  const target = event.target
  const control =
    target instanceof Element ? target.closest(CONTROLS) : undefined
  return !!control && control !== part && part.contains(control)
}

/**
 * What opens the menu of a part of the sheet that isn't a roll, such as an item's row: a
 * right-click, a long-press on a touch screen, or the keyboard's context menu key or Shift+F10, as
 * RollButton opens a roll's. A press that opened it doesn't also click what it pressed, so a row
 * doesn't open. A press on a control inside it, such as a row's Take, is that control's alone.
 */
export function usePressMenu(
  onMenu?: (anchor: HTMLElement, point?: MenuPoint) => void,
): {
  /** Spread on the element; none without onMenu. */
  props: PressProps
  /** A held touch's: no text selection or callout. Empty without onMenu. */
  className: string
} {
  const press = useRef({
    x: 0,
    y: 0,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    // A touch or pen opened the menu, so the click that ends its press mustn't click the part too.
    // A mouse's right-click, the context menu key and Shift+F10 are followed by no click, so they
    // never set it: were it set, the next Enter on the part would do nothing.
    opened: false,
  })
  if (!onMenu) return { props: {}, className: '' }
  const cancel = () => clearTimeout(press.current.timer)
  return {
    className: 'touch-manipulation select-none [-webkit-touch-callout:none]',
    props: {
      onContextMenu: event => {
        if (onControl(event)) return
        event.preventDefault()
        cancel()
        const part = event.currentTarget
        const { pointerType } = event.nativeEvent as Partial<PointerEvent>
        // A context menu key has no pointer: Chrome gives its menu no button, and the Pointer
        // Events spec no pointer type.
        const fromKey = event.button === -1 || pointerType === ''
        const touch = pointerType === 'touch' || pointerType === 'pen'
        if (touch) press.current.opened = true
        onMenu(part, fromKey ? undefined : pointWithin(part, event, touch))
      },
      onPointerDown: event => {
        cancel()
        press.current.opened = false
        if (onControl(event) || event.pointerType === 'mouse') return
        const part = event.currentTarget
        press.current.x = event.clientX
        press.current.y = event.clientY
        const point = pointWithin(part, event, true)
        press.current.timer = setTimeout(() => {
          press.current.opened = true
          onMenu(part, point)
        }, LONG_PRESS)
      },
      onPointerMove: event => {
        const moved = Math.hypot(
          event.clientX - press.current.x,
          event.clientY - press.current.y,
        )
        if (moved > DRIFT) cancel()
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onClickCapture: event => {
        if (!press.current.opened || onControl(event)) return
        press.current.opened = false
        // Neither a row's summary nor an action's name opens after its menu did.
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}
