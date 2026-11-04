import { useEffect, useRef, useState } from 'react'
import { lastsOf, nextCard, showsTurn } from './utils'
import { POLL_INTERVAL } from '@/constants/polling'
import type { CardNext, ToastSeen } from './types'
import type {
  Card,
  CardBody,
  EndTurnState,
  UndoState,
} from '@/features/table/types'
import type { TableCombat } from '@/types/table'

/**
 * How long a turn the game has ended, or taken back, may still be shown as it was before the page
 * is taken to be showing the turn now, in milliseconds: two of the table's polls.
 */
const SETTLE_FOR = 2 * POLL_INTERVAL

/**
 * The turn's toast's card (module 0.36.0): one card at a time, each replacing the last, each
 * numbered, so that the next is announced, and animates in, as a new one. What happened since the
 * last render makes the card, in the order it did; an End Turn the game made but the page still
 * shows as it was two polls on is told with no line and no Undo; an Undo made with the turn still
 * not shown back two polls on goes all the same; and each card that lasts goes in its time, paused
 * while the pointer is over it or focus is in it.
 * @returns The card; `rest`, which pauses or resumes its time; and `takeBack`, Undo's own: its
 *   card, and the Undo sent.
 */
export function useTurnToastCard({
  ending,
  undoing,
  via,
  held,
  combatShown,
  combat,
}: {
  ending: EndTurnState
  undoing: UndoState
  via?: 'button' | 'hold'
  held: boolean
  combatShown: boolean
  combat?: TableCombat
}) {
  const [card, setCard] = useState<Card>()
  const serials = useRef(0)
  const make = (body: CardBody): Card => ({
    ...body,
    serial: (serials.current += 1),
  })
  // The End Turns whose ending has been told, by their ids: each is told once.
  const told = useRef(new Set<string>())
  // What was last seen of the hold, the End Turn sent last and its Undo's way.
  const seen = useRef<ToastSeen>({ held: false })
  // The card a hold's took the place of, which comes back if the hold is let go early.
  const covered = useRef<Card>(undefined)
  // What's left of the time of the card that lasts, by its number.
  const remaining = useRef<{ serial: number; ms: number }>(undefined)
  // The card next, numbered where it's new, with what was left of its time where it comes back.
  const numbered = (next: CardNext): Card | undefined => {
    if (!next) return undefined
    if ('card' in next) return next.card
    const made = make(next.make)
    if (next.ms !== undefined) {
      remaining.current = { serial: made.serial, ms: next.ms }
    }
    return made
  }

  const { sent } = ending
  const { offer, way: undone } = undoing
  // What happened since the last render, in the order it did; the last card made shows. It runs
  // after every render, as it always has, and sets the card only where the card changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- after every render on purpose
  useEffect(() => {
    const was = seen.current
    seen.current = { held, sent }
    const step = nextCard(
      card,
      was,
      {
        held,
        sent,
        via,
        combatShown,
        combat,
        turn: ending.turn,
        offer,
        undone,
      },
      {
        told: told.current,
        covered: covered.current,
        remaining: remaining.current,
      },
    )
    if (step.cover) covered.current = card
    if (step.uncover) covered.current = undefined
    if (step.tell) told.current.add(step.tell)
    const next = numbered(step.next)
    if (next !== card) setCard(next)
  })

  // An End Turn the game made, still shown as it was two polls on, as when the turn came back
  // before the page saw it move: told with no line and no Undo.
  const doneId = sent?.way.status === 'done' ? sent.way.requestId : undefined
  const settling =
    sent && doneId && showsTurn(combat, sent.turn) ? doneId : undefined
  // Its turn, the same object for as long as it's the same End Turn.
  const settlingTurn = settling === undefined ? undefined : sent?.turn
  useEffect(() => {
    if (settling === undefined || !settlingTurn) return
    const timer = setTimeout(() => {
      if (told.current.has(settling)) return
      told.current.add(settling)
      setCard(
        make({ kind: 'ended', id: settling, turn: settlingTurn, undo: false }),
      )
    }, SETTLE_FOR)
    return () => clearTimeout(timer)
    // From when it was first seen so, however many polls show it.
  }, [settling, settlingTurn])

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

  // Undo, from its card: it says so until the page shows the turn back.
  const takeBack = () => {
    if (!offer) return
    setCard(make({ kind: 'taking', id: offer.requestId, turn: offer.turn }))
    undoing.undo()
  }
  return { card, rest, takeBack }
}
