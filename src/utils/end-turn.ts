import { seatWords, type SeatRole } from '@/utils/seat-words'
import type { TableRollState } from '@/hooks/use-table-rolls'
import type { EndedTurn, RollKind } from '@/types/roll'
import type { EndableTurn, TableCombat } from '@/types/table'

/*
 * Ending a turn from the table (module 0.36.0): the player's character's, or one of its
 * companions', from the turn panel's End Turn or the Combat tab held. What decides which turn the
 * page may end, how long a hold lasts, and its words. Nothing here is a component, so the
 * components that draw End Turn import it, and it imports none of them back.
 */

/**
 * How long the Combat tab is held to end the turn, in milliseconds: the user's 1 second, from their
 * prototype.
 */
export const END_TURN_HOLD = 1000

/** When a hold says it's ending the turn, in milliseconds: the user's half a second. */
export const END_TURN_TOAST_AT = 500

/** How far a held press may drift before it's no hold, in pixels, as a roll button's may. */
export const END_TURN_DRIFT = 10

/**
 * How long a turn has been shown before the page offers to end it, in milliseconds: so that a tap
 * aimed at the last heading, as a poll changes it, or a double tap across a turn's end, ends
 * nothing.
 */
export const END_TURN_ARMS_AFTER = 600

/** The share of a hold the tab's fill shows nothing for, its first sixth: a tap never flickers. */
export const END_TURN_QUIET = 1 / 6

/**
 * A press of the Combat tab let go within this is a tap, which shows Combat, in milliseconds; one
 * let go later, before the hold's end, ends nothing and shows nothing.
 */
export const END_TURN_TAP_WITHIN = 300

/**
 * How long the page's tabs ignore clicks once a hold has ended the turn, in milliseconds: the click
 * that ends the press opens nothing.
 */
export const END_TURN_QUIET_CLICKS = 700

/** How long the device buzzes as a hold ends the turn, where it can, in milliseconds. */
export const END_TURN_BUZZ = 12

/** How long a turn's toast shows, in milliseconds, but one offering Undo. */
export const TURN_TOAST_FOR = 5000

/** How long a turn's toast offering Undo shows, in milliseconds, its time paused while in use. */
export const TURN_UNDO_FOR = 8000

/**
 * The turn the seat may end, as the page shows the combat: where the game takes it, the combat
 * has started and its current combatant is the seat's character, or one of the character's
 * companions, whose key and name it carries. None for anyone else's turn, nor while a hidden
 * combatant acts, which the page is shown no current combatant for.
 * @param kinds - The rolls the game takes from this page now.
 */
export function endableTurn(
  combat: TableCombat | undefined,
  kinds: readonly RollKind[],
): EndableTurn | undefined {
  if (!combat?.started || !kinds.includes('endTurn')) return undefined
  const current = combat.combatants.find(({ id }) => id === combat.currentId)
  if (!current) return undefined
  const turn = {
    combatId: combat.id,
    round: combat.round,
    combatantId: current.id,
  }
  if (current.side === 'me') return turn
  if (current.yours === true && current.companion) {
    return {
      ...turn,
      companion: { key: current.companion, name: current.name },
    }
  }
  return undefined
}

/**
 * Which turn this is, as one string: its combat, round and current combatant. The same turn shown
 * again, as by the Gamemaster's Previous Turn in the same round, has the same key.
 */
export function turnKey(turn: EndedTurn): string {
  return `${turn.combatId}:${turn.round}:${turn.combatantId}`
}

/**
 * Why a turn wasn't ended, in words, for End Turn's own refusals: the fragment after "Your turn
 * wasn’t ended:". The rest are a roll's, as the tray words them, but too many at once, whose
 * tray words already say to wait. And from module 0.36.0, why a turn ended wasn't taken back:
 * that End Turn can't be now.
 */
export const TURN_REFUSALS: Readonly<Record<string, string>> = {
  'not-started': 'the combat hasn’t started',
  moved: 'the turn had already moved on',
  'not-turn': 'it isn’t your turn, nor one of your companions’',
  'not-undoable': 'it can’t be taken back now',
  busy: 'too many rolls at once',
}

/**
 * The refusals that say the turn is over, or never was the seat's: that turn isn't offered again.
 * Any other, such as too many rolls at once, offers it again.
 */
export const TURN_OVER: ReadonlySet<string> = new Set([
  'moved',
  'not-turn',
  'not-started',
])

/** The turn panel's button. */
export const END_TURN_LABEL = 'End turn'

/** Under the turn panel's button: the Combat tab, held, ends the turn too, from any tab. */
export const END_TURN_HINT = 'Or press and hold the Combat tab, from any tab.'

/**
 * What End Turn says of a turn, the player's character's as theirs, a companion's by its name: as
 * it's on its way ("Ending your turn…"); once the game has ended it; that it wasn't, without a
 * stop, which each use adds; as Undo takes it back; and that Undo didn't.
 */
export function endTurnWords(turn: EndableTurn): {
  ending: string
  ended: string
  notEnded: string
  takingBack: string
  notTakenBack: string
} {
  const name = turn.companion?.name
  if (name === undefined) {
    return {
      ending: 'Ending your turn…',
      ended: 'Your turn has ended.',
      notEnded: 'Your turn wasn’t ended',
      takingBack: 'Taking your turn back…',
      notTakenBack: 'Your turn wasn’t taken back.',
    }
  }
  return {
    ending: `Ending ${name}’s turn…`,
    ended: `${name}’s turn has ended.`,
    notEnded: `${name}’s turn wasn’t ended`,
    takingBack: `Taking ${name}’s turn back…`,
    notTakenBack: `${name}’s turn wasn’t taken back.`,
  }
}

/** Who acts once a turn has ended: by name, or the player, where it's their own character. */
export function actingLine(left: { name: string; mine: boolean }): string {
  return left.mine ? 'It’s your turn.' : `${left.name} is acting.`
}

/**
 * Why a turn wasn't ended, as the turn panel says it under its button: a reason's fragment after
 * the colon, where there's one; and that it may be tried again, where the turn isn't over.
 * @param again - Whether the reason leaves the turn the seat's to end, as too many rolls at once.
 */
export function turnRefusedLine(
  turn: EndableTurn,
  fragment: string | undefined,
  again: boolean,
): string {
  const { notEnded } = endTurnWords(turn)
  const line = fragment ? `${notEnded}: ${fragment}.` : `${notEnded}.`
  return again ? `${line} Try again in a moment.` : line
}

/** A reason's fragment as a sentence of its own, as a toast's line says it. */
export function reasonSentence(fragment: string): string {
  return `${fragment.charAt(0).toUpperCase()}${fragment.slice(1)}.`
}

/** What a hold's toast says under its words, while it's held. */
export const HOLD_HINT = 'Keep holding to end it, or let go to keep it.'

/** Where an End Turn is on its way, as a roll's is: sent, then being made in the game. */
export function turnSendingLine(state: TableRollState, role: SeatRole): string {
  const { game } = seatWords(role)
  return state.status === 'sending'
    ? `Sending to ${game}…`
    : `Ending it in ${game}…`
}

/** What the Combat tab is described as while a hold may end the turn. */
export function holdDescription(turn: EndableTurn): string {
  const name = turn.companion?.name
  return name === undefined
    ? 'Press and hold to end your turn'
    : `Press and hold to end ${name}’s turn`
}
