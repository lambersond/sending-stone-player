'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import { END_TURN_LABEL, endTurnWords } from '@/utils/end-turn'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { EndableTurn } from '@/types/table'

/**
 * The turn panel's End Turn (module 0.36.0), as the user's End Turn prototype draws it: the seat's
 * turn, the character's or a companion's, ended at once, with Undo in the toast that follows. Under
 * the heading at its full width on a phone, beside it from 768 pixels. Described by the heading,
 * so that a screen reader hears whose turn it ends. While the turn hasn't been shown for long
 * enough to be offered, while an End Turn is on its way for it, and once one is refused as over,
 * it does nothing, and says so, though it never stops taking focus: on its way, with a spinner and
 * whose turn it's ending. A held Enter ends one turn, never the next too.
 * @param way - The way of the End Turn sent for this turn, if one was.
 * @param onEnd - Ends the turn given, the one this render shows.
 * @param onGone - Where focus goes when the button goes from under it.
 * @param ref - The button, for the panel to tell whether focus is on it.
 */
export function EndTurnButton({
  turn,
  offered,
  way,
  onEnd,
  onGone,
  ref,
}: Readonly<{
  turn: EndableTurn
  offered: boolean
  way?: TableRollState
  onEnd: (turn: EndableTurn) => void
  onGone?: () => void
  ref?: RefObject<HTMLButtonElement | null>
}>) {
  const sending =
    way?.status === 'sending' ||
    way?.status === 'rolling' ||
    way?.status === 'done'
  const idle = sending || !offered
  // Focus on it as it goes, as when the seat's turn ends, is handed on once the page has settled:
  // what goes with it, such as its panel as the encounter ends, has gone by then, and focus left
  // to the page's body, never taken by something else meanwhile.
  const fallback = useRef<HTMLButtonElement>(null)
  const own = ref ?? fallback
  const gone = useRef(onGone)
  useLayoutEffect(() => {
    gone.current = onGone
  })
  useLayoutEffect(() => {
    const button = own.current
    return () => {
      if (!button || document.activeElement !== button) return
      queueMicrotask(() => {
        const active = document.activeElement
        if (!active || active === document.body || !active.isConnected) {
          gone.current?.()
        }
      })
    }
  }, [own])
  return (
    <button
      ref={own}
      type='button'
      aria-describedby='turn-heading'
      aria-disabled={idle ? 'true' : undefined}
      data-sending={sending || undefined}
      onClick={() => {
        if (!idle) onEnd(turn)
      }}
      onKeyDown={event => {
        if (event.repeat) event.preventDefault()
      }}
      className='inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-[18px] text-[15px] font-semibold text-on-primary hover:bg-primary-hover data-[sending]:cursor-default data-[sending]:opacity-75 data-[sending]:hover:bg-primary md:w-auto'
    >
      {sending ? (
        <>
          <span
            aria-hidden
            className='size-4 animate-[spin_0.8s_linear_infinite] rounded-full border-2 border-current border-r-transparent motion-reduce:animate-[spin_2s_linear_infinite]'
          />
          {endTurnWords(turn).ending}
        </>
      ) : (
        END_TURN_LABEL
      )}
    </button>
  )
}
