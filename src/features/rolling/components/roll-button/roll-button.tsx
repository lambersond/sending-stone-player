'use client'

import { useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { LONG_PRESS } from '@/features/rolling/constants'
import { pointWithin } from '@/features/rolling/utils/menu-points'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import type { RollTarget, MenuPoint } from '@/features/rolling/types'

/** How far a touch may move and still count as held, in pixels. */
const DRIFT = 10

type Props<T> = {
  /** What it rolls: a check or save, or an action's damage. */
  target: T
  /** Rolls it as it stands, from this button. */
  onRoll: (target: T, anchor: HTMLElement) => void
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
 * which browsers take for it. Disabled, and greyed, in a pane whose rolls are locked, as a
 * companion's that has gone (module 0.36.0).
 */
export function RollButton<T = RollTarget>({
  target,
  onRoll,
  onMenu,
  label,
  className,
  children,
  popup = 'menu',
  title,
  disabled: unavailable,
}: Readonly<Props<T>>) {
  const locked = useRollsLocked()
  const disabled = unavailable || locked
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
        locked && 'cursor-not-allowed opacity-50',
      )}
      onClick={event => {
        if (press.current.opened) {
          press.current.opened = false
          return
        }
        onRoll(target, event.currentTarget)
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
