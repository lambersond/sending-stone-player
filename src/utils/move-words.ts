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
 * Who shares a distribution, as the module's line lists them in English: "Bram, Lia, Thorin, and
 * Vex".
 */
export function namesWords(names: string[]): string {
  return new Intl.ListFormat('en', { type: 'conjunction' }).format(names)
}

/**
 * What a move is called on the Gamemaster's page, for the character's player to be shown it by
 * among the Gamemaster's rolls: such as "Give 5 gp to Vex" or "Take 1 Rope from The Iron Company",
 * and from module 0.32.0 "Send 1 Rope from The Iron Company to Vex" or "Distribute 4 pp from The
 * Iron Company among Bram, Lia, Thorin, and Vex".
 */
export function moveLabel(move: LocalMove): string {
  switch (move.verb) {
    case 'give': {
      return `Give ${move.things} to ${move.other}`
    }
    case 'take': {
      return `Take ${move.things} from ${move.other}`
    }
    case 'send': {
      return `Send ${move.things} from ${move.source ?? ''} to ${move.other}`
    }
    case 'distribute': {
      return `Distribute ${move.things} from ${move.other} among ${move.among ?? ''}`
    }
  }
}

/**
 * Why a move wasn't made, in words, as the seat at the sheet reads it: its player or the
 * Gamemaster. Of too few to move, whose they are: the party's, for a take, a send or a
 * distribution; the player's own, or the character's, for the Gamemaster, for a give.
 */
export function moveReasons(
  role: SeatRole,
  verb: LocalMove['verb'],
): Readonly<Record<string, string>> {
  return WORDS_BY_ROLE[role][verb]
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
    members: 'the party’s members have changed. Try again',
    split: 'there isn’t a whole coin for each of them',
    error: 'something went wrong',
    timeout: `${game} took too long. The sheet shows whether it moved`,
    lost: `no answer from ${game}. The sheet shows whether it moved`,
    network: 'Sending Stone couldn’t be reached',
    expired: `${game} didn’t pick it up`,
  }
}

/** Each seat's words, for each kind of move. */
function wordsFor(role: SeatRole) {
  return {
    give: reasonsFor(role, 'give'),
    take: reasonsFor(role, 'take'),
    send: reasonsFor(role, 'send'),
    distribute: reasonsFor(role, 'distribute'),
  }
}

const WORDS_BY_ROLE: Record<
  SeatRole,
  Record<LocalMove['verb'], Readonly<Record<string, string>>>
> = { player: wordsFor('player'), gm: wordsFor('gm') }

/** Whether the game says it moved any of it before it failed. */
function partly(state: Pick<TableRollState, 'transfer'>): boolean {
  const moved = state.transfer
  return (
    !!moved &&
    (moved.items.length > 0 || Object.keys(moved.currency ?? {}).length > 0)
  )
}

/** How each kind of move is told: being made, made, and not made, or made in part. */
const VERBS: Record<
  LocalMove['verb'],
  { making: string; not: string; partly: string }
> = {
  give: { making: 'Giving', not: 'Not given', partly: 'Partly given' },
  take: { making: 'Taking', not: 'Not taken', partly: 'Partly taken' },
  send: { making: 'Sending', not: 'Not sent', partly: 'Partly sent' },
  distribute: {
    making: 'Distributing',
    not: 'Not distributed',
    partly: 'Partly distributed',
  },
}

/** What was done, as the line after who did it says it: "gave 5 gp to Vex". */
function doneWords(move: LocalMove): string {
  switch (move.verb) {
    case 'give': {
      return `gave ${move.things} to ${move.other}`
    }
    case 'take': {
      return `took ${move.things} from ${move.other}`
    }
    case 'send': {
      return `sent ${move.things} from ${move.source ?? ''} to ${move.other}`
    }
    case 'distribute': {
      return `distributed ${move.things} among ${move.among ?? ''} (${move.each ?? ''} each)`
    }
  }
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
  const { game } = seatWords(role)
  const verb = VERBS[move.verb]
  switch (state.status) {
    case 'sending': {
      return `Sending to ${game}…`
    }
    case 'rolling': {
      return `${verb.making} it in ${game}…`
    }
    case 'done': {
      const done = doneWords(move)
      return move.mover
        ? `${move.mover} ${done}`
        : `${done[0].toUpperCase()}${done.slice(1)}`
    }
    default: {
      const key = state.reason ?? state.status
      const reason = moveReasons(role, move.verb)[key] ?? fallback[key]
      const made =
        state.status === 'failed' && partly(state) ? verb.partly : verb.not
      return reason ? `${made}: ${reason}` : made
    }
  }
}
