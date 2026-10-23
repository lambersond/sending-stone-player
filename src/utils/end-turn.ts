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

/** How long the Combat tab is held to end the turn, in milliseconds: the user's 1.5 seconds. */
export const END_TURN_HOLD = 1500

/** When a hold says it's ending the turn, in milliseconds: the user's half a second. */
export const END_TURN_TOAST_AT = 500

/** How far a held press may drift before it's no hold, in pixels, as a roll button's may. */
export const END_TURN_DRIFT = 10

/** How long "Still your turn" shows once a hold is let go early, in milliseconds. */
export const END_TURN_KEPT_FOR = 2000

/**
 * How long a turn has been shown before the page offers to end it, in milliseconds: so that a tap
 * aimed at the last heading, as a poll changes it, or a double tap across a turn's end, ends
 * nothing.
 */
export const END_TURN_ARMS_AFTER = 600

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
 * Why a turn wasn't ended, in words, for End Turn's own refusals: the fragment after "Not ended at
 * the table:". The rest are a roll's, as the tray words them.
 */
export const TURN_REFUSALS: Readonly<Record<string, string>> = {
  'not-started': 'the combat hasn’t started',
  moved: 'the turn had already moved on',
  'not-turn': 'it isn’t your turn, nor one of your companions’',
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

/**
 * What a turn's toast says as its title: while a hold ends it, or once it's sent ("Ending your
 * turn"); once a hold is let go early ("Still your turn"); and once it's ended ("Your turn is
 * over"). A companion's say its name.
 */
export function endTurnWords(turn: EndableTurn): {
  holding: string
  kept: string
  ended: string
} {
  const name = turn.companion?.name
  if (name === undefined) {
    return {
      holding: 'Ending your turn',
      kept: 'Still your turn',
      ended: 'Your turn is over',
    }
  }
  return {
    holding: `Ending ${name}’s turn`,
    kept: `Still ${name}’s turn`,
    ended: `${name}’s turn is over`,
  }
}

/** What a hold's toast says under its title, while it's held. */
export const HOLD_HINT = 'Keep holding to end it, or let go to keep it.'

/** And once it's let go early. */
export const KEPT_LINE = 'Nothing was sent.'

/** And once the game has ended the turn. */
export const ENDED_LINE = 'Ended at the table'

/** Why a turn wasn't ended, as a line: a reason's fragment after the colon, where there's one. */
export function turnRefusedLine(fragment: string | undefined): string {
  return fragment
    ? `Not ended at the table: ${fragment}`
    : 'Not ended at the table'
}

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
