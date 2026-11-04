'use client'

import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { UndoButton } from './undo-button'
import { useToastFoot } from './use-toast-foot'
import { useTurnToastCard } from './use-turn-toast-card'
import { takenBack, wordsOf } from './utils'
import { useToastTop } from '@/features/rolling/hooks/use-toast-top'
import { useHydrated } from '@/hooks/use-hydrated'
import { useTableRole } from '@/hooks/use-table-api'
import type { EndTurnState, UndoState } from '@/features/table/types'
import type { TableCombat } from '@/types/table'

/**
 * The turn's toast (module 0.36.0), as the user's End Turn prototype draws it: one card at a time,
 * at the top of the screen below the page's header, each replacing the last. A hold of the Combat
 * tab says at half a second that it's ending the turn, then, past its end, how its End Turn is on
 * its way; let go early, the card it took the place of comes back, as nothing was sent. Once the
 * game has ended the turn, the button's or the hold's, and the page shows its
 * combat moved on, it says so, with who acts now, and offers Undo for as long as that's offered,
 * eight seconds; as Undo is taken, it says so until the page shows the turn back. A hold's End
 * Turn that wasn't made says why, as does the button's where the combat isn't shown to say it.
 * Each lasts five seconds but those that follow a press or a way, its time paused while the
 * pointer is over it or focus is in it. No close button, and nothing happens on a tap. Its region
 * is there, empty, with the character's page, so that each card is announced, politely, as one;
 * it has no role, as the page's one status is its live state. Shown whatever the roll results
 * setting says: it answers the player's End Turn, not a roll.
 * @param via - How the last End Turn was sent, by the button or by a hold.
 * @param held - Whether a hold of the Combat tab is past half a second, and not yet let go.
 * @param combatShown - Whether the combat pane is shown, whose panel says why its button's End
 *   Turn wasn't made.
 * @param focusTurn - Moves focus to the turn panel's heading, or to the Combat tab where the
 *   panel isn't shown: where focus goes as Undo goes from under it.
 * @param combat - The combat as the page shows it.
 * @param header - The page's header, which the toast starts below.
 * @param beside - Whether the sheet is beside the combat and chat column, from 1024 pixels wide:
 *   the toast is then over the sheet, clear of the column's tabs, so that a hold of its Combat tab
 *   shows its fill, and the card with Undo never comes up under the pointer still on the tab, whose
 *   time would wait for it to move.
 * @param onFoot - Told where the card ends as it shows, moves or goes, for the roll toasts.
 */
export function TurnToast({
  ending,
  undoing,
  via,
  held,
  combatShown,
  focusTurn,
  combat,
  header,
  beside = false,
  onFoot,
}: Readonly<{
  ending: EndTurnState
  undoing: UndoState
  via?: 'button' | 'hold'
  held: boolean
  combatShown: boolean
  focusTurn: () => void
  combat?: TableCombat
  header?: HTMLElement | null
  beside?: boolean
  onFoot?: (foot: number | undefined) => void
}>) {
  const role = useTableRole()
  const hydrated = useHydrated()
  const top = useToastTop(true, undefined, header)
  const { card, rest, takeBack } = useTurnToastCard({
    ending,
    undoing,
    via,
    held,
    combatShown,
    combat,
  })
  const { sent } = ending
  const { offer } = undoing
  // Where it ends, for the roll toasts to start below it, as it shows, moves, changes or goes.
  const setElement = useToastFoot(onFoot, top)

  if (!hydrated) return
  // Undo's card goes in the very render in which the panel shows the turn back, not one after it.
  const showing = card && !takenBack(card, combat) ? card : undefined
  const shown = showing && wordsOf(showing, sent, role)
  const undoable =
    showing?.kind === 'ended' && showing.undo && offer?.requestId === showing.id
  // Beside the sheet, it keeps to the sheet's side of the screen: the column is the page's width
  // clamped as GameTable sizes it, which a fixed region's padding reads the screen's width for.
  return createPortal(
    <div
      aria-live='polite'
      aria-atomic='true'
      className={clsx(
        'pointer-events-none fixed inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[100001] flex justify-center pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))]',
        beside &&
          'lg:pr-[calc(clamp(320px,40%,500px)_+_max(1rem,env(safe-area-inset-right)))]',
      )}
      style={top === undefined ? undefined : { top }}
    >
      {showing && shown && (
        <div
          key={showing.serial}
          ref={setElement}
          data-turn-toast={showing.kind}
          onPointerEnter={() => rest({ pointer: true })}
          onPointerLeave={() => rest({ pointer: false })}
          onFocus={() => rest({ focus: true })}
          onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              rest({ focus: false })
            }
          }}
          className='pointer-events-auto flex w-full max-w-[420px] items-center gap-3 rounded-2xl border border-border bg-card py-2.5 pr-2.5 pl-3.5 text-sm text-text-primary shadow-[0_12px_28px_-12px_rgb(0_0_0/0.35)] motion-safe:animate-toast-in'
        >
          <p className='min-w-0 flex-1'>
            {shown.words}
            {shown.line && (
              <small className='block text-xs text-text-secondary'>
                {shown.line}
              </small>
            )}
          </p>
          {undoable && <UndoButton onUndo={takeBack} onGone={focusTurn} />}
        </div>
      )}
    </div>,
    document.body,
  )
}
