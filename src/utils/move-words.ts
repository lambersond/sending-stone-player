import { seatWords, type SeatRole } from '@/utils/seat-words'
import type { LocalMove } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

// How a move of items and coins (module 0.31.0) is told, in English: what moved, as the game's
// chat line says it, where it stands on its way to the game, and why it wasn't made.

/** A part of a move, as it's told: an item and how many of it, or a coin and how many. */
export type MovedPart =
  { quantity: number; name: string } | { coins: number; abbreviation: string }

/**
 * What a move moves, as the module's chat line says it in English: "2 Potion of Healing", or
 * "1 Rope and 50 gp", or "2 Potion of Healing, 1 Rope, and 5 sp".
 */
export function thingsWords(parts: MovedPart[]): string {
  const words = parts.map(part =>
    'name' in part
      ? `${part.quantity.toLocaleString('en')} ${part.name}`
      : `${part.coins.toLocaleString('en')} ${part.abbreviation}`,
  )
  return new Intl.ListFormat('en', { type: 'conjunction' }).format(words)
}

/**
 * What a move is called on the Gamemaster's page, for the character's player to be shown it by
 * among the Gamemaster's rolls: such as "Give 5 gp to Vex" or "Take 1 Rope from The Iron Company".
 */
export function moveLabel(move: LocalMove): string {
  return move.verb === 'give'
    ? `Give ${move.things} to ${move.other}`
    : `Take ${move.things} from ${move.other}`
}

/**
 * Why a move wasn't made, in words, as the seat at the sheet reads it: its player or the
 * Gamemaster. Of too few to move, whose they are: the party's, for a take; the player's own, or the
 * character's, for the Gamemaster, for a give or a send.
 */
export function moveReasons(
  role: SeatRole,
  verb: LocalMove['verb'],
): Readonly<Record<string, string>> {
  return verb === 'give' ? WORDS_BY_ROLE[role].give : WORDS_BY_ROLE[role].take
}

function reasonsFor(role: SeatRole, verb: LocalMove['verb']) {
  const { game } = seatWords(role)
  const notTaking = `${game} isn’t taking moves now`
  let short = 'the party hasn’t that many'
  if (verb === 'give') {
    short = role === 'gm' ? 'they haven’t that many' : 'you haven’t that many'
  }
  return {
    unavailable: notTaking,
    off: notTaking,
    'transfers-off': notTaking,
    busy: 'too many at once. Wait a moment',
    moving: 'it’s on its way already',
    invalid: `${game} couldn’t move it`,
    unknown: 'that isn’t in the campaign any more',
    'not-yours': 'that isn’t this character’s to move',
    'not-owner': 'you need Owner on the party in Foundry',
    gone: 'it isn’t there any more',
    short,
    container: 'a container moves whole, with everything in it',
    nested: 'it moves with its container already',
    deep: 'it holds containers too deep to move from here',
    error: 'something went wrong',
    timeout: `${game} took too long. The sheet shows whether it moved`,
    lost: `no answer from ${game}. The sheet shows whether it moved`,
    network: 'Sending Stone couldn’t be reached',
    expired: `${game} didn’t pick it up`,
  }
}

const WORDS_BY_ROLE: Record<
  SeatRole,
  Record<LocalMove['verb'], Readonly<Record<string, string>>>
> = {
  player: {
    give: reasonsFor('player', 'give'),
    take: reasonsFor('player', 'take'),
  },
  gm: { give: reasonsFor('gm', 'give'), take: reasonsFor('gm', 'take') },
}

/** Whether the game says it moved any of it before it failed. */
function partly(state: Pick<TableRollState, 'transfer'>): boolean {
  const moved = state.transfer
  return (
    !!moved &&
    (moved.items.length > 0 || Object.keys(moved.currency ?? {}).length > 0)
  )
}

/**
 * Where a move is on its way to the game, or what became of it, in words: sent, being made, made,
 * as the Gamemaster's page tells it of the character that moved it, or not made, or made in part,
 * and why.
 * @param fallback - Why a roll wasn't made, in words, for a reason no move has words of its own
 *   for.
 */
export function moveWords(
  move: LocalMove,
  state: Pick<TableRollState, 'status' | 'reason' | 'transfer'>,
  role: SeatRole,
  fallback: Readonly<Record<string, string>> = {},
): string {
  const give = move.verb === 'give'
  const { game } = seatWords(role)
  switch (state.status) {
    case 'sending': {
      return `Sending to ${game}…`
    }
    case 'rolling': {
      return `${give ? 'Giving' : 'Taking'} it in ${game}…`
    }
    case 'done': {
      const done = give
        ? `gave ${move.things} to ${move.other}`
        : `took ${move.things} from ${move.other}`
      return move.mover
        ? `${move.mover} ${done}`
        : `${done[0].toUpperCase()}${done.slice(1)}`
    }
    default: {
      const key = state.reason ?? state.status
      const reason = moveReasons(role, move.verb)[key] ?? fallback[key]
      let made = give ? 'Not given' : 'Not taken'
      if (state.status === 'failed' && partly(state)) {
        made = give ? 'Partly given' : 'Partly taken'
      }
      return reason ? `${made}: ${reason}` : made
    }
  }
}
