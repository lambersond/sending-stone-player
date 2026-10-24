'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
  type PointerEventHandler,
  type RefObject,
} from 'react'
import {
  END_TURN_BUZZ,
  END_TURN_DRIFT,
  END_TURN_HOLD,
  END_TURN_QUIET,
  END_TURN_TAP_WITHIN,
  END_TURN_TOAST_AT,
} from '@/utils/end-turn'

/** A press being held: its pointer, the turn it began on, when and where, and what it waits on. */
type Press = {
  id: number
  key: string
  at: number
  x: number
  y: number
  frame?: number
  toast?: ReturnType<typeof setTimeout>
  end?: ReturnType<typeof setTimeout>
}

/**
 * The Combat tab held to end the turn (module 0.36.0), as the user's End Turn prototype draws it:
 * a press, by a finger, a pen or a mouse's main button, held for `END_TURN_HOLD` ends the turn,
 * filling the tab from the left as it's held, nothing for its first sixth so that a tap never
 * flickers, with a buzz at the end. A press let go within `END_TURN_TAP_WITHIN` is a tap, whose
 * click is the tab's own, so it shows Combat; one let go later, drifted, taken by the browser, the
 * page hidden, or the turn changing under it ends nothing and shows nothing: the click after it is
 * swallowed, as is the one after a hold that ended the turn, however long the finger stays. A
 * click with no press before it, the keyboard's, is the tab's own. With no turn to end, a press
 * does nothing of its own.
 */
export function useHold(options: {
  /**
   * The turn a hold may end, by `turnKey`: set while an End Turn is offered, else none, and the
   * tab is as before. A change while held stops the hold.
   */
  key?: string
  /** At END_TURN_TOAST_AT, once. */
  onToast: () => void
  /** At END_TURN_HOLD: end the turn, still the one the hold began on. */
  onEnd: () => void
  /**
   * Stopped before the end, by a late let-go, a drift, the browser, the page hidden or the turn
   * changing.
   */
  onCancel: () => void
}): {
  handlers: {
    onPointerDown: PointerEventHandler
    onPointerMove: PointerEventHandler
    onPointerUp: PointerEventHandler
    onPointerCancel: PointerEventHandler
    onContextMenu: MouseEventHandler
    onClickCapture: MouseEventHandler
  }
  /** Whether a press is held now, for the label's colour. */
  holding: boolean
  /**
   * Whether a press begun while `key` was set is still down, whatever came of it: for the tab's
   * classes.
   */
  pressed: boolean
  /** The fill's element, whose transform the hook sets each frame. */
  fill: RefObject<HTMLSpanElement | null>
} {
  const fill = useRef<HTMLSpanElement | null>(null)
  const [holding, setHolding] = useState(false)
  const [pressed, setPressed] = useState(false)
  // The latest render's turn and callbacks, never those of the render the press began in.
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  // The press being held, until it ends the turn or stops.
  const press = useRef<Press | undefined>(undefined)
  // The pointer of a press begun while there was a turn to end, until it's let go.
  const down = useRef<number | undefined>(undefined)
  // Whether the click that follows the last press is swallowed: it ended the turn, or stopped.
  const swallow = useRef(false)
  // Stops listening for that press's let-go off the tab, where the browser didn't capture it.
  const unlisten = useRef<(() => void) | undefined>(undefined)

  const draw = (scale: number) => {
    if (fill.current) fill.current.style.transform = `scaleX(${scale})`
  }
  // The press no longer held: its frames and timers stopped, the fill emptied.
  const stop = () => {
    const held = press.current
    if (!held) return
    press.current = undefined
    if (held.frame !== undefined) cancelAnimationFrame(held.frame)
    clearTimeout(held.toast)
    clearTimeout(held.end)
    draw(0)
    setHolding(false)
  }
  // Stopped before the end: nothing is sent, and the click after it isn't the tab's.
  const cancel = () => {
    if (!press.current) return
    stop()
    swallow.current = true
    latest.current.onCancel()
  }
  // The press begun while there was a turn to end is up, or lost.
  const lifted = () => {
    unlisten.current?.()
    unlisten.current = undefined
    if (down.current === undefined) return
    down.current = undefined
    setPressed(false)
  }
  const letGo = (pointer: number, early: boolean) => {
    if (down.current === pointer) lifted()
    const held = press.current
    if (held?.id !== pointer) return
    // A tap: the click the browser sends after it is the tab's, which shows Combat.
    if (early && performance.now() - held.at <= END_TURN_TAP_WITHIN) stop()
    else cancel()
  }
  // A let-go off the tab, where the browser didn't capture the pointer, as on the tab.
  const up = (lift: PointerEvent) => letGo(lift.pointerId, true)
  const lost = (lift: PointerEvent) => letGo(lift.pointerId, false)
  const frame = () => {
    const held = press.current
    if (!held) return
    const share = Math.min(1, (performance.now() - held.at) / END_TURN_HOLD)
    draw(
      share < END_TURN_QUIET
        ? 0
        : (share - END_TURN_QUIET) / (1 - END_TURN_QUIET),
    )
    held.frame = requestAnimationFrame(frame)
  }

  // The turn shown changed under the press, as at a poll: so the end only ever ends the turn the
  // hold began on. Once the hold has ended the turn, the change that follows stops nothing.
  const { key } = options
  useEffect(() => {
    if (press.current && press.current.key !== key) cancel()
  })
  // A page hidden mid-press, as a phone's screen locked, loses it.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState !== 'hidden') return
      cancel()
      lifted()
    }
    document.addEventListener('visibilitychange', hidden)
    return () => {
      document.removeEventListener('visibilitychange', hidden)
      unlisten.current?.()
      const held = press.current
      press.current = undefined
      if (held?.frame !== undefined) cancelAnimationFrame(held.frame)
      clearTimeout(held?.toast)
      clearTimeout(held?.end)
    }
    // Once: what it reads, it reads through refs.
  }, [])

  return {
    holding,
    pressed,
    fill,
    handlers: {
      onPointerDown: event => {
        // Another pointer while one holds, or a mouse's other buttons, are no hold.
        if (press.current || !event.isPrimary || event.button !== 0) return
        // A new press: the last one's click never came, as after a long touch it may not.
        swallow.current = false
        lifted()
        const { key } = latest.current
        if (key === undefined) return
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Held without it: the drift still stops a finger that slides away.
        }
        const held: Press = {
          id: event.pointerId,
          key,
          at: performance.now(),
          x: event.clientX,
          y: event.clientY,
        }
        press.current = held
        down.current = held.id
        // Its let-go, wherever it lands, as where the browser didn't capture the pointer.
        globalThis.addEventListener('pointerup', up)
        globalThis.addEventListener('pointercancel', lost)
        unlisten.current = () => {
          globalThis.removeEventListener('pointerup', up)
          globalThis.removeEventListener('pointercancel', lost)
        }
        setPressed(true)
        setHolding(true)
        draw(0)
        held.frame = requestAnimationFrame(frame)
        held.toast = setTimeout(() => {
          if (press.current === held) latest.current.onToast()
        }, END_TURN_TOAST_AT)
        held.end = setTimeout(() => {
          if (press.current !== held) return
          if (latest.current.key !== held.key) {
            cancel()
            return
          }
          try {
            navigator.vibrate?.(END_TURN_BUZZ)
          } catch {
            // No buzz where the device won't.
          }
          stop()
          swallow.current = true
          latest.current.onEnd()
        }, END_TURN_HOLD)
      },
      onPointerMove: event => {
        const held = press.current
        if (held?.id !== event.pointerId) return
        const drift = Math.hypot(event.clientX - held.x, event.clientY - held.y)
        if (drift > END_TURN_DRIFT) cancel()
      },
      onPointerUp: event => letGo(event.pointerId, true),
      onPointerCancel: event => letGo(event.pointerId, false),
      onContextMenu: event => {
        // Android's own long press, or a right-click: the hold goes on.
        if (latest.current.key !== undefined || down.current !== undefined) {
          event.preventDefault()
        }
      },
      onClickCapture: event => {
        // The keyboard's click has no press before it: it's the tab's own.
        if (event.detail === 0 || !swallow.current) return
        swallow.current = false
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}
