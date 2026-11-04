import type { Card, CardBody, Sent } from '@/features/table/types'
import type { TableRollState } from '@/types/roll'
import type { EndableTurn, TableCombat, TurnUndo } from '@/types/table'

/**
 * What was last seen of the hold, and of the End Turn sent last, as the toast steps its card from
 * one render to the next.
 */
export type ToastSeen = { held: boolean; sent?: Sent }

/** What the toast's card answers, as the latest render has it. */
export type ToastInputs = ToastSeen & {
  via?: 'button' | 'hold'
  combatShown: boolean
  combat?: TableCombat
  /** The turn End Turn may end now, which a hold is for. */
  turn?: EndableTurn
  offer?: TurnUndo
  undone?: TableRollState & { for: string }
}

/**
 * The card the toast shows next: one to number and show anew, with what's left of its time where
 * it comes back; the one shown; or none.
 */
export type CardNext =
  { make: CardBody; ms?: number } | { card: Card } | undefined

/**
 * A step of the toast's card: the card next; whether a hold's card took the place of the one
 * shown, which comes back if the hold is let go early, or that one came back; and the End Turn
 * whose ending is told now, by its id, which is told once.
 */
export type CardStep = {
  next: CardNext
  cover: boolean
  uncover: boolean
  tell?: string
}
