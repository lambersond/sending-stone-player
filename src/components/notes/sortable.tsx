'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { useMediaQuery } from '@/hooks/use-media-query'
import { movedTo } from '@/utils/order-words'

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

type Props = {
  ids: string[]
  onChange(ids: string[]): void
  /** A note's title, for what's announced as it moves. */
  titleOf(id: string): string
  row(id: string, index: number, handles: SortableHandles): ReactNode
  /**
   * Nothing moves while it's on, as while the order made is being saved: what's sent is what's
   * shown. A drag in progress as it goes on is put back.
   */
  disabled?: boolean
}

/** A row dragged: from where, to where it would drop now, how far, and how far it moves others. */
type Drag = {
  from: number
  to: number
  /** How far it's been dragged, in pixels, against the list. */
  dy: number
  /** Its height and the gap after it: how far each row it passes shifts to make room. */
  size: number
}

/** Within this many pixels of the top or bottom of the pane the list is in, a drag scrolls it. */
const EDGE = 48
/** The most a drag scrolls that pane in a frame, at its very edge. */
const MOST_SCROLL = 12

/** The list with one of its items moved. */
const moveItem = (ids: string[], from: number, to: number) => {
  const next = [...ids]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/** The nearest box around the list that scrolls it: the reader pane's content. */
function scrollerOf(element: HTMLElement): HTMLElement | undefined {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return undefined
}

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
}: Readonly<Props>) {
  const list = useRef<HTMLUListElement>(null)
  const [drag, setDrag] = useState<Drag>()
  const [said, setSaid] = useState<{ words: string; n: number }>()
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)')
  // The row just moved, by its id, whose grip takes focus once the list is drawn in its new order:
  // moving the focused element in the page loses its focus.
  const focusOn = useRef<string>(undefined)
  // Ends the drag in progress, putting the row back: as the list changes under it, or goes.
  const cancel = useRef<() => void>(undefined)
  const latest = useRef({ ids, onChange, titleOf, disabled })
  useLayoutEffect(() => {
    latest.current = { ids, onChange, titleOf, disabled }
  })

  useLayoutEffect(() => {
    const id = focusOn.current
    if (id === undefined) return
    focusOn.current = undefined
    const grips = list.current?.querySelectorAll<HTMLElement>('[data-grip]')
    ;[...(grips ?? [])].find(grip => grip.dataset.grip === id)?.focus()
  }, [ids])

  // A note gone from the list, or one added, mid-drag: the places measured are wrong now.
  const key = ids.join(',')
  useEffect(() => {
    cancel.current?.()
  }, [key])
  useEffect(() => {
    if (disabled) cancel.current?.()
  }, [disabled])
  useEffect(() => () => cancel.current?.(), [])

  /** Moves a row, saying where it is now. Nothing past either end, to where it is, or while off. */
  const move = (from: number, to: number) => {
    const {
      ids: now,
      onChange: change,
      titleOf: title,
      disabled: off,
    } = latest.current
    if (off || to === from || to < 0 || to >= now.length) return
    const id = now[from]
    focusOn.current = id
    change(moveItem(now, from, to))
    setSaid(was => ({
      words: movedTo(title(id), to + 1, now.length),
      n: (was?.n ?? 0) + 1,
    }))
  }

  const onKey =
    (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
      if (
        disabled ||
        cancel.current ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return
      const places: Partial<Record<string, number>> = {
        ArrowUp: index - 1,
        ArrowDown: index + 1,
        Home: 0,
        End: ids.length - 1,
      }
      const to = places[event.key]
      if (to === undefined) return
      event.preventDefault()
      move(index, to)
    }

  const begin = (index: number) => (event: PointerEvent<HTMLButtonElement>) => {
    // A mouse's other buttons open menus; a second finger mid-drag does nothing.
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const ul = list.current
    if (!ul || cancel.current || disabled) return
    event.preventDefault()
    const handle = event.currentTarget
    const { pointerId } = event
    // Where each row is, against the list, as the drag starts: the list moves on the screen as
    // the pane scrolls, but nothing in it does.
    const top = ul.getBoundingClientRect().top
    const rows = [...ul.children].map(item => {
      const rect = item.getBoundingClientRect()
      const at = rect.top - top
      return { top: at, height: rect.height, middle: at + rect.height / 2 }
    })
    const gap =
      rows.length > 1 ? rows[1].top - (rows[0].top + rows[0].height) : 0
    // How far the row may be drawn up and down: to the list's own ends, no further. A row drawn
    // past them would make the pane taller to scroll into (a moved box counts in what a pane
    // scrolls), and held at its bottom the pane would scroll on into nothing. The pointer past
    // them still drops it first or last.
    const lastRow = rows.at(-1) ?? rows[index]
    const highest = -rows[index].top
    const lowest =
      lastRow.top + lastRow.height - (rows[index].top + rows[index].height)
    // The pointer, read against the list as it is now, so that a scroll moves the drop place.
    const at = (clientY: number) => clientY - ul.getBoundingClientRect().top
    const start = at(event.clientY)
    let clientY = event.clientY
    let now: Drag = {
      from: index,
      to: index,
      dy: 0,
      size: rows[index].height + gap,
    }
    setDrag(now)
    handle.setPointerCapture?.(pointerId)
    const scroller = scrollerOf(ul)
    // How far the pane scrolls, measured once, before any row is moved: its end, where a held
    // drag stops scrolling it.
    const most = scroller ? scroller.scrollHeight - scroller.clientHeight : 0
    let frame: number | undefined

    const place = () => {
      // Where it drops follows the pointer, past either end of the list too; it's drawn within it.
      const reach = at(clientY) - start
      const dy = Math.min(Math.max(reach, highest), lowest)
      const middle = rows[index].middle + reach
      let to = index
      for (const [other, { middle: theirs }] of rows.entries()) {
        if (other < index && middle < theirs && other < to) to = other
        if (other > index && middle > theirs && other > to) to = other
      }
      if (dy === now.dy && to === now.to) return
      now = { ...now, dy, to }
      setDrag(now)
    }
    /** How far to scroll the pane a frame: toward the edge the pointer is near, faster nearer. */
    const speed = () => {
      if (!scroller) return 0
      const box = scroller.getBoundingClientRect()
      const near = (by: number) =>
        Math.ceil(MOST_SCROLL * Math.min(1, (EDGE - by) / EDGE))
      if (clientY < box.top + EDGE) return -near(clientY - box.top)
      if (clientY > box.bottom - EDGE) return near(box.bottom - clientY)
      return 0
    }
    const scroll = () => {
      frame = undefined
      const by = speed()
      if (!scroller || by === 0) return
      const was = scroller.scrollTop
      scroller.scrollTop = Math.min(most, Math.max(0, was + by))
      // At its end, it stops there, till the pointer moves again.
      if (scroller.scrollTop === was) return
      place()
      frame = requestAnimationFrame(scroll)
    }

    const onMove = (moved: globalThis.PointerEvent) => {
      if (moved.pointerId !== pointerId) return
      clientY = moved.clientY
      place()
      if (frame === undefined && speed() !== 0)
        frame = requestAnimationFrame(scroll)
    }
    const end = (drop: boolean) => {
      globalThis.removeEventListener('pointermove', onMove)
      globalThis.removeEventListener('pointerup', onUp)
      globalThis.removeEventListener('pointercancel', onUp)
      document.removeEventListener('keydown', onEscape, true)
      scroller?.removeEventListener('scroll', place)
      if (frame !== undefined) cancelAnimationFrame(frame)
      if (handle.hasPointerCapture?.(pointerId))
        handle.releasePointerCapture(pointerId)
      cancel.current = undefined
      setDrag(undefined)
      if (drop) move(now.from, now.to)
    }
    // Let go, or taken by the browser (a cancel), it's dropped where it is.
    const onUp = (up: globalThis.PointerEvent) => {
      if (up.pointerId === pointerId) end(true)
    }
    // First, before the dialog it's in takes the key as a request to close: the key is kept from
    // it, as a menu's is (useTopmostEscape), and the row goes back where it was.
    const onEscape = (key: globalThis.KeyboardEvent) => {
      if (key.key !== 'Escape' || key.isComposing) return
      key.preventDefault()
      end(false)
    }
    globalThis.addEventListener('pointermove', onMove)
    globalThis.addEventListener('pointerup', onUp)
    globalThis.addEventListener('pointercancel', onUp)
    document.addEventListener('keydown', onEscape, true)
    scroller?.addEventListener('scroll', place)
    cancel.current = () => end(false)
  }

  /** How far a row is moved while another is dragged: the dragged one with the pointer. */
  const shift = (index: number) => {
    if (!drag) return 0
    if (index === drag.from) return drag.dy
    if (drag.from < drag.to && index > drag.from && index <= drag.to)
      return -drag.size
    if (drag.to < drag.from && index >= drag.to && index < drag.from)
      return drag.size
    return 0
  }

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
