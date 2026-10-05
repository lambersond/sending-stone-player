'use client'

import { useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import type { RollMode } from '@/types/sending-stone'

/** Something on the sheet that rolls: a check or save, its modifier, and the character's mode. */
export type RollTarget = {
  /** Such as "Perception check". */
  label: string
  modifier: number
  /** Advantage or disadvantage from the character's conditions and features. */
  mode: RollMode
}

/** How long a touch must be held to open the roll's menu, in milliseconds. */
export const LONG_PRESS = 500

/** How far a touch may move and still count as held, in pixels. */
const DRIFT = 10

type Props = {
  target: RollTarget
  /** Rolls it as it stands. */
  onRoll: (target: RollTarget) => void
  /** Offers other ways to roll it, beside this button. */
  onMenu: (anchor: HTMLElement, target: RollTarget) => void
  label: string
  className: string
  children: ReactNode
}

/**
 * A part of the sheet that rolls when tapped or clicked, and offers other ways to roll on a
 * right-click, a long-press on a touch screen, or the keyboard's context menu key.
 */
export function RollButton({
  target,
  onRoll,
  onMenu,
  label,
  className,
  children,
}: Readonly<Props>) {
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
      aria-haspopup='menu'
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
        event.preventDefault()
        cancel()
        press.current.opened = true
        onMenu(event.currentTarget, target)
      }}
      onPointerDown={event => {
        cancel()
        press.current.opened = false
        if (event.pointerType === 'mouse') return
        const button = event.currentTarget
        press.current.x = event.clientX
        press.current.y = event.clientY
        press.current.timer = setTimeout(() => {
          press.current.opened = true
          onMenu(button, target)
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
