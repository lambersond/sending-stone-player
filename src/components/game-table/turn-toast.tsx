'use client'

import {
  createContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import clsx from 'clsx'
import { createPortal } from 'react-dom'
import { reasons } from '@/components/character-sheet/roll-tray'
import { useHydrated } from '@/hooks/use-hydrated'
import { useToastTop } from '@/hooks/use-roll-toasts'
import { useTableRole } from '@/hooks/use-table-api'
import { POLL_INTERVAL } from '@/hooks/use-table-view'
import {
  actingLine,
  endTurnWords,
  HOLD_HINT,
  reasonSentence,
  TURN_REFUSALS,
  TURN_TOAST_FOR,
  TURN_UNDO_FOR,
  turnSendingLine,
} from '@/utils/end-turn'
import type { useEndTurn } from '@/hooks/use-end-turn'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { useTurnUndo } from '@/hooks/use-turn-undo'
import type { EndedTurn } from '@/types/roll'
import type { EndableTurn, TableCombat } from '@/types/table'
import type { SeatRole } from '@/utils/seat-words'

/**
 * Where the turn's toast ends, in pixels from the top of the screen, while one shows (module
 * 0.36.0): the roll toasts start below it.
 */
export const TurnToastContext = createContext<number | undefined>(undefined)

type Ending = ReturnType<typeof useEndTurn>
type Undoing = ReturnType<typeof useTurnUndo>
/** The last End Turn sent, and its way. */
type Sent = NonNullable<Ending['sent']>

/** How an End Turn's or an Undo's way ends where the turn stays as it was. */
export const NOT_MADE: ReadonlySet<TableRollState['status']> = new Set([
  'refused',
  'failed',
  'expired',
  'lost',
])

/**
 * How long a turn the game has ended, or taken back, may still be shown as it was before the page
 * is taken to be showing the turn now, in milliseconds: two of the table's polls.
 */
const SETTLE_FOR = 2 * POLL_INTERVAL

/**
 * Why an End Turn, or an Undo, wasn't made, as a fragment, by its way's reason, else its status:
 * End Turn's own words, else a roll's as the tray words it for the seat.
 */
export function turnFragment(key: string, role: SeatRole): string | undefined {
  return TURN_REFUSALS[key] ?? reasons(role)[key]
}

/** What a way's refusal is told by: its reason, or where it has none, how it ended. */
export function refusalKey(way: TableRollState): string {
  return way.reason ?? way.status
}

/**
 * Whether the End Turn sent last has just ended without ending its turn: its way refused, failed,
 * expired or lost, as it wasn't when last seen, or it's another End Turn. Each is told once,
 * however many times its way is heard again.
 * @param was - The End Turn sent last as it was seen before.
 */
export function newlyNotMade(
  was: Sent | undefined,
  now: Sent | undefined,
): now is Sent {
  if (!now || !NOT_MADE.has(now.way.status)) return false
  return was?.turn !== now.turn || !NOT_MADE.has(was.way.status)
}

/** Whether the page shows this turn now: its combat, started, at its round and combatant. */
function showsTurn(combat: TableCombat | undefined, turn: EndedTurn): boolean {
  return (
    combat?.started === true &&
    combat.id === turn.combatId &&
    combat.round === turn.round &&
    combat.currentId === turn.combatantId
  )
}

/** Who acts as the page shows the combat: by name, and whether it's the viewer's own character. */
function actingOf(
  combat: TableCombat | undefined,
): { name: string; mine: boolean } | undefined {
  if (!combat?.started) return undefined
  const current = combat.combatants.find(({ id }) => id === combat.currentId)
  return current && { name: current.name, mine: current.side === 'me' }
}

/**
 * What the toast shows: a hold past half a second; its End Turn on its way; an End Turn the game
 * made, with Undo while that's offered; one that wasn't made; Undo on its way; or Undo not made.
 * Each card shown is numbered, so that the next is announced, and animates in, as a new one.
 */
type CardBody =
  | { kind: 'holding'; turn: EndableTurn }
  | { kind: 'sending'; turn: EndableTurn }
  | {
      kind: 'ended'
      id: string
      turn: EndableTurn
      line?: string
      undo: boolean
    }
  | { kind: 'refused'; turn: EndableTurn; key: string }
  | { kind: 'taking'; id: string; turn: EndableTurn }
  | { kind: 'kept'; turn: EndableTurn; key: string }

type Card = CardBody & { serial: number }

/** How long a card shows, from when it's shown; none for one that follows a press or a way. */
function lastsOf(card: Card): number | undefined {
  if (card.kind === 'ended') return card.undo ? TURN_UNDO_FOR : TURN_TOAST_FOR
  if (card.kind === 'refused' || card.kind === 'kept') return TURN_TOAST_FOR
  return undefined
}

/** A card's words, and the line under them, as the seat reads them. */
function wordsOf(
  card: Card,
  sent: Sent | undefined,
  role: SeatRole,
): { words: string; line?: string } {
  const words = endTurnWords(card.turn)
  switch (card.kind) {
    case 'holding': {
      return { words: words.ending, line: HOLD_HINT }
    }
    case 'sending': {
      const way = sent?.turn === card.turn ? sent.way : undefined
      return {
        words: words.ending,
        line: turnSendingLine(way ?? { status: 'sending' }, role),
      }
    }
    case 'ended': {
      return { words: words.ended, line: card.line }
    }
    case 'refused': {
      const fragment = turnFragment(card.key, role)
      return {
        words: `${words.notEnded}.`,
        line: fragment && reasonSentence(fragment),
      }
    }
    case 'taking': {
      return { words: words.takingBack }
    }
    case 'kept': {
      const fragment = turnFragment(card.key, role)
      return {
        words: words.notTakenBack,
        line: fragment && reasonSentence(fragment),
      }
    }
  }
}

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
  ending: Ending
  undoing: Undoing
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
  const [card, setCard] = useState<Card>()
  const serials = useRef(0)
  const make = (body: CardBody): Card => ({
    ...body,
    serial: (serials.current += 1),
  })
  // The End Turns whose ending has been told, by their ids: each is told once.
  const told = useRef(new Set<string>())
  // What was last seen of the hold, the End Turn sent last and its Undo's way.
  const seen = useRef<{ held: boolean; sent?: Sent }>({ held: false })
  // The card a hold's took the place of, which comes back if the hold is let go early.
  const covered = useRef<Card>(undefined)
  // What's left of the time of the card that lasts, by its number.
  const remaining = useRef<{ serial: number; ms: number }>(undefined)
  // The card a hold's took the place of, shown again as a new one for what was left of its time,
  // as the hold sent nothing; none where its time was up.
  const uncover = (): Card | undefined => {
    const back = covered.current
    covered.current = undefined
    if (!back) return undefined
    const lasts = lastsOf(back)
    if (lasts === undefined) return make(back)
    const left =
      remaining.current?.serial === back.serial ? remaining.current.ms : lasts
    if (left <= 0) return undefined
    const again = make(back)
    remaining.current = { serial: again.serial, ms: left }
    return again
  }

  const { sent } = ending
  const { offer, way: undone } = undoing
  // What happened since the last render, in the order it did; the last card made shows.
  useEffect(() => {
    const was = seen.current
    seen.current = { held, sent }
    let next = card
    if (held && !was.held && ending.turn) {
      covered.current = card
      next = make({ kind: 'holding', turn: ending.turn })
    } else if (!held && was.held && next?.kind === 'holding') {
      // Let go early, drifted or stopped: it goes at once, silently, and the card it took the
      // place of, such as the last End Turn's with Undo, comes back where it's still to be shown.
      next = uncover()
    }
    if (sent && sent.turn !== was.sent?.turn && via === 'hold') {
      next = make({ kind: 'sending', turn: sent.turn })
    }
    const id = sent?.way.status === 'done' ? sent.way.requestId : undefined
    if (sent && id && !told.current.has(id) && !showsTurn(combat, sent.turn)) {
      told.current.add(id)
      const undo = offer?.requestId === id
      const left = undo ? offer.left : actingOf(combat)
      next = make({
        kind: 'ended',
        id,
        turn: sent.turn,
        line: left && actingLine(left),
        undo,
      })
    }
    if (newlyNotMade(was.sent, sent) && (via === 'hold' || !combatShown)) {
      next = make({
        kind: 'refused',
        turn: sent.turn,
        key: refusalKey(sent.way),
      })
    }
    if (next?.kind === 'taking' && undone?.for === next.id) {
      if (NOT_MADE.has(undone.status)) {
        next = make({ kind: 'kept', turn: next.turn, key: refusalKey(undone) })
      } else if (undone.status === 'done' && showsTurn(combat, next.turn)) {
        // Taken back: the panel shows the turn again.
        next = undefined
      }
    }
    // Undo is no longer offered, as the page shows another turn: the card goes, silently.
    if (next?.kind === 'ended' && next.undo && offer?.requestId !== next.id) {
      next = undefined
    }
    if (next !== card) setCard(next)
  })

  // An End Turn the game made, still shown as it was two polls on, as when the turn came back
  // before the page saw it move: told with no line and no Undo.
  const doneId = sent?.way.status === 'done' ? sent.way.requestId : undefined
  const settling =
    sent && doneId && showsTurn(combat, sent.turn) ? doneId : undefined
  useEffect(() => {
    if (settling === undefined || !sent) return
    const turn = sent.turn
    const timer = setTimeout(() => {
      if (told.current.has(settling)) return
      told.current.add(settling)
      setCard(make({ kind: 'ended', id: settling, turn, undo: false }))
    }, SETTLE_FOR)
    return () => clearTimeout(timer)
    // From when it was first seen so, however many polls show it.
  }, [settling])

  // An Undo the game made, the turn still not shown back two polls on: it goes all the same.
  const back =
    card?.kind === 'taking' &&
    undone?.for === card.id &&
    undone.status === 'done'
      ? card.serial
      : undefined
  useEffect(() => {
    if (back === undefined) return
    const timer = setTimeout(
      () => setCard(shown => (shown?.serial === back ? undefined : shown)),
      SETTLE_FOR,
    )
    return () => clearTimeout(timer)
  }, [back])

  // Its time, paused while the pointer is over it or focus is in it.
  const [pause, setPause] = useState<{
    serial: number
    pointer: boolean
    focus: boolean
  }>()
  const resting =
    pause !== undefined &&
    pause.serial === card?.serial &&
    (pause.pointer || pause.focus)
  const rest = (change: { pointer?: boolean; focus?: boolean }) => {
    if (!card) return
    setPause(was => ({
      serial: card.serial,
      pointer: false,
      focus: false,
      ...(was?.serial === card.serial && was),
      ...change,
    }))
  }
  useEffect(() => {
    const lasts = card && lastsOf(card)
    if (!card || lasts === undefined) return
    if (remaining.current?.serial !== card.serial) {
      remaining.current = { serial: card.serial, ms: lasts }
    }
    if (resting) return
    const begun = Date.now()
    const timer = setTimeout(
      () =>
        setCard(shown => (shown?.serial === card.serial ? undefined : shown)),
      remaining.current.ms,
    )
    return () => {
      clearTimeout(timer)
      if (remaining.current?.serial === card.serial) {
        remaining.current.ms -= Date.now() - begun
      }
    }
  }, [card, resting])

  // Where it ends, for the roll toasts to start below it, as it shows, moves, changes or goes.
  // eslint-disable-next-line unicorn/no-null -- React sets a ref to null as it goes
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const foot = useRef<number | undefined>(undefined)
  const footing = useRef(onFoot)
  useLayoutEffect(() => {
    footing.current = onFoot
  })
  useLayoutEffect(() => {
    // Where the card comes to rest, not where its entry has it now: its box as laid out in its
    // region, which a transform doesn't move, as the card's first frame already has it 8 pixels
    // higher and no resize follows to say otherwise.
    const measure = () => {
      const at = element
        ? Math.ceil(
            (element.parentElement?.getBoundingClientRect().top ?? 0) +
              element.offsetTop +
              element.offsetHeight,
          )
        : undefined
      if (at === foot.current) return
      foot.current = at
      footing.current?.(at)
    }
    measure()
    if (!element) return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    globalThis.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      globalThis.removeEventListener('resize', measure)
    }
  }, [element, top])

  if (!hydrated) return
  const shown = card && wordsOf(card, sent, role)
  const undoable =
    card?.kind === 'ended' && card.undo && offer?.requestId === card.id
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
      {card && shown && (
        <div
          key={card.serial}
          ref={setElement}
          data-turn-toast={card.kind}
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
          {undoable && (
            <UndoButton
              onUndo={() => {
                if (!offer) return
                setCard(
                  make({
                    kind: 'taking',
                    id: offer.requestId,
                    turn: offer.turn,
                  }),
                )
                undoing.undo()
              }}
              onGone={focusTurn}
            />
          )}
        </div>
      )}
    </div>,
    document.body,
  )
}

/**
 * The toast's Undo: it takes the turn back. As it goes, taken or withdrawn, focus on it is handed
 * on, never left to the page's body.
 */
function UndoButton({
  onUndo,
  onGone,
}: Readonly<{ onUndo: () => void; onGone: () => void }>) {
  const button = useRef<HTMLButtonElement>(null)
  const gone = useRef(onGone)
  useLayoutEffect(() => {
    gone.current = onGone
  })
  useLayoutEffect(() => {
    const own = button.current
    return () => {
      if (own && document.activeElement === own) gone.current()
    }
  }, [])
  return (
    <button
      ref={button}
      type='button'
      onClick={onUndo}
      className='min-h-11 min-w-11 rounded-[10px] border border-border bg-transparent px-3 font-semibold'
    >
      Undo
    </button>
  )
}
