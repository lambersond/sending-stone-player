'use client'

import { useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import type { MenuPoint } from './roll-menu'
import type { RollSource } from '@/types/roll'
import type { RollMode } from '@/types/sending-stone'

/** Something on the sheet that rolls: a check or save, its modifier, and the character's mode. */
export type RollTarget = {
  /** Such as "Perception check". */
  label: string
  modifier: number
  /** Advantage or disadvantage from the character's conditions and features. */
  mode: RollMode
  /** What it is, for the Gamemaster's game to make it too; unset for a roll it can't make. */
  source?: RollSource
}

/** How long a touch must be held to open the roll's menu, in milliseconds. */
export const LONG_PRESS = 500

/** How far a touch may move and still count as held, in pixels. */
const DRIFT = 10

type Props<T> = {
  /** What it rolls: a check or save, or an action's damage. */
  target: T
  /** Rolls it as it stands. */
  onRoll: (target: T) => void
  /** Offers other ways to roll it, where on this button the player clicked or pressed. */
  onMenu: (anchor: HTMLElement, target: T, point?: MenuPoint) => void
  label: string
  className: string
  children: ReactNode
  /** What it offers other ways to roll it in: a menu, unless said, or a dialog of its own. */
  popup?: 'menu' | 'dialog'
  /** Where it can't be rolled now, which offers no other way either. */
  disabled?: boolean
  /** Shown to a mouse, as why it's disabled. */
  title?: string
}

/**
 * A part of the sheet that rolls when tapped or clicked, and offers other ways to roll on a
 * right-click, a long-press on a touch screen, or the keyboard's context menu key, or Shift+F10,
 * which browsers take for it.
 */
export function RollButton<T = RollTarget>({
  target,
  onRoll,
  onMenu,
  label,
  className,
  children,
  popup = 'menu',
  disabled,
  title,
}: Readonly<Props<T>>) {
  const press = useRef({
    x: 0,
    y: 0,
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
    // The menu opened from this press, so the tap that ends it must not roll too.
    opened: false,
  })
  const cancel = () => clearTimeout(press.current.timer)

  return (
    <button
      type='button'
      aria-label={label}
      aria-haspopup={popup}
      disabled={disabled}
      title={title}
      className={clsx(
        // A held touch opens the menu, not the browser's text selection or callout.
        'touch-manipulation select-none [-webkit-touch-callout:none]',
        className,
      )}
      onClick={() => {
        if (press.current.opened) {
          press.current.opened = false
          return
        }
        onRoll(target)
      }}
      onContextMenu={event => {
        // A disabled button offers nothing, as React still tells it of a right-click.
        if (disabled) return
        event.preventDefault()
        cancel()
        press.current.opened = true
        const button = event.currentTarget
        const { pointerType } = event.nativeEvent as Partial<PointerEvent>
        // A context menu key has no pointer: Chrome gives its menu no button, and the Pointer
        // Events spec no pointer type.
        const fromKey = event.button === -1 || pointerType === ''
        const touch = pointerType === 'touch' || pointerType === 'pen'
        const point = fromKey ? undefined : pointWithin(button, event, touch)
        onMenu(button, target, point)
      }}
      onPointerDown={event => {
        cancel()
        press.current.opened = false
        if (disabled || event.pointerType === 'mouse') return
        const button = event.currentTarget
        press.current.x = event.clientX
        press.current.y = event.clientY
        const point = pointWithin(button, event, true)
        press.current.timer = setTimeout(() => {
          press.current.opened = true
          onMenu(button, target, point)
        }, LONG_PRESS)
      }}
      onPointerMove={event => {
        const moved = Math.hypot(
          event.clientX - press.current.x,
          event.clientY - press.current.y,
        )
        if (moved > DRIFT) cancel()
      }}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
    >
      {children}
    </button>
  )
}

/** Where a pointer is on the button, or nothing when it's off it. */
function pointWithin(
  button: HTMLElement,
  { clientX, clientY }: { clientX: number; clientY: number },
  touch: boolean,
): MenuPoint | undefined {
  const { left, top, width, height } = button.getBoundingClientRect()
  const x = clientX - left
  const y = clientY - top
  // A pixel's leeway, for browsers that round where the pointer is.
  if (x < -1 || y < -1 || x > width + 1 || y > height + 1) return undefined
  return { x, y, touch }
}
