import { seatWords } from '@/utils/seat-words'
import type { LocalMove, MovedPart, TableRollState } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

// How a move of items and coins (module 0.31.0) is told, in English: what moved, as the game's
// chat line says it, where it stands on its way to the game, and why it wasn't made. From module
// 0.33.0, a removal of the character's item is told the same way; and from module 0.49.0 coins
// added to the character, taken away, or handed out to the characters picked.

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
 * An amount of coins as the module's chat line says it in English, from module 0.49.0: each coin
 * there's any of, in the sheet's order, which is dnd5e's, by its abbreviation, as "2 pp, 5 gp, and
 * 3 sp"; a coin the sheet doesn't list after them, by its key. Nothing where there are none.
 * @param coins - The sheet's coins, in its order.
 * @param amounts - How many of each coin, by key.
 */
export function coinsWords(
  coins: readonly { id: string; abbreviation: string }[],
  amounts: Readonly<Record<string, number>>,
): string {
  const listed = new Set(coins.map(({ id }) => id))
  const others = Object.keys(amounts)
    .filter(id => !listed.has(id))
    .map(id => ({ id, abbreviation: id }))
  return thingsWords(
    [...coins, ...others]
      .filter(({ id }) => (amounts[id] ?? 0) >= 1)
      .map(({ id, abbreviation }) => ({ coins: amounts[id], abbreviation })),
  )
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
 * Iron Company among Bram, Lia, Thorin, and Vex", and from module 0.33.0 "Remove 1 Rope"; and from
 * module 0.49.0 "Add 5 gp", "Take away 5 gp" or "Hand out 200 pp and 50 gp each to Vex, Bram, and
 * Lia".
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
    case 'remove': {
      return `Remove ${move.things}`
    }
    case 'receive': {
      return `Add ${move.things}`
    }
    case 'pay': {
      return `Take away ${move.things}`
    }
    case 'handOut': {
      return `Hand out ${move.things} each to ${move.among ?? ''}`
    }
  }
}

/**
 * Why a move wasn't made, in words, as the seat at the sheet reads it: its player or the
 * Gamemaster. Of too few to move, whose they are: the party's, for a take, a send or a
 * distribution; the player's own, or the character's, for the Gamemaster, for a give or, from
 * module 0.33.0, a removal, whose words say it's removed rather than moved.
 */
export function moveReasons(
  role: SeatRole,
  verb: LocalMove['verb'],
): Readonly<Record<string, string>> {
  return WORDS_BY_ROLE[role][verb]
}

/** The verbs of coins added to a character or taken away (module 0.49.0). */
const COIN_VERBS: ReadonlySet<LocalMove['verb']> = new Set(['receive', 'pay'])

/**
 * Whose coins are too few for what's taken away or handed out, as the seat is told it: the
 * player's own, or for the Gamemaster the character's.
 */
function shortOfCoins(role: SeatRole): string {
  return role === 'gm'
    ? 'they haven’t the coins for that'
    : 'you haven’t the coins for that'
}

/**
 * Why coins weren't added or taken away (module 0.49.0), in words: its own for what differs from a
 * removal's, whose words it otherwise has; none for a transformed character, which has the roll's.
 */
function coinReasons(role: SeatRole): Record<string, string> {
  const { game } = seatWords(role)
  const notTaking = `${game} isn’t changing coins now`
  return {
    unavailable: notTaking,
    off: notTaking,
    busy: 'too many at once. Wait a moment',
    moving: 'a change to these coins is still on its way',
    invalid: `${game} couldn’t change them`,
    unknown: 'that isn’t in the campaign any more',
    gone: 'that coin isn’t on the sheet any more',
    short: shortOfCoins(role),
    error: 'something went wrong',
    timeout: `${game} took too long. The sheet shows whether they changed`,
    lost: `no answer from ${game}. The sheet shows whether they changed`,
    network: 'Sending Stone couldn’t be reached',
    expired: `${game} didn’t pick it up`,
  }
}

function reasonsFor(role: SeatRole, verb: LocalMove['verb']) {
  if (COIN_VERBS.has(verb)) return coinReasons(role)
  const { game } = seatWords(role)
  const removing = verb === 'remove'
  const notTaking = removing
    ? `${game} can’t remove items now`
    : `${game} isn’t taking moves now`
  let short = 'the party hasn’t that many'
  if (verb === 'give' || removing) {
    short = role === 'gm' ? 'they haven’t that many' : 'you haven’t that many'
  }
  // A hand-out's coins (module 0.49.0) may be paid with other coins: too few is of them all.
  if (verb === 'handOut') short = shortOfCoins(role)
  // Whether it moved, or for a removal whether it was removed, is the sheet's to show.
  const happened = removing ? 'whether it was removed' : 'whether it moved'
  return {
    unavailable: notTaking,
    off: notTaking,
    'transfers-off': notTaking,
    busy: 'too many at once. Wait a moment',
    moving: 'it’s on its way already',
    invalid: removing
      ? `${game} couldn’t remove it`
      : `${game} couldn’t move it`,
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
    // From module 0.33.0: a removal's stack isn't as many as the page showed.
    changed: 'how many there are has changed. Try again',
    error: 'something went wrong',
    timeout: `${game} took too long. The sheet shows ${happened}`,
    lost: `no answer from ${game}. The sheet shows ${happened}`,
    network: 'Sending Stone couldn’t be reached',
    expired: `${game} didn’t pick it up`,
    // From module 0.40.0: the giver or the recipient is transformed, as by Wild Shape. A removal
    // has the roll's words for it, as a favorite's and an effect's are.
    ...(!removing && {
      shaped:
        'a transformed character can’t give or take until back in their own form',
    }),
  }
}

/** Each seat's words, for each kind of move. */
function wordsFor(role: SeatRole) {
  return {
    give: reasonsFor(role, 'give'),
    take: reasonsFor(role, 'take'),
    send: reasonsFor(role, 'send'),
    distribute: reasonsFor(role, 'distribute'),
    remove: reasonsFor(role, 'remove'),
    receive: reasonsFor(role, 'receive'),
    pay: reasonsFor(role, 'pay'),
    handOut: reasonsFor(role, 'handOut'),
  }
}

const WORDS_BY_ROLE: Record<
  SeatRole,
  Record<LocalMove['verb'], Readonly<Record<string, string>>>
> = { player: wordsFor('player'), gm: wordsFor('gm') }

/**
 * Whether the game says it moved any of it before it failed; or for a removal, from module 0.33.0,
 * that the item itself was lowered or deleted before it did. A hand-out that failed part way
 * (module 0.49.0) lists those it gave, with what each was given.
 */
function partly(
  move: LocalMove,
  state: Pick<TableRollState, 'transfer' | 'removed'>,
): boolean {
  if (move.verb === 'remove') return state.removed !== undefined
  const moved = state.transfer
  return (
    !!moved &&
    (moved.items.length > 0 || Object.keys(moved.currency ?? {}).length > 0)
  )
}

/**
 * How each kind of move is told: being made, up to where it's made, as "Giving it" or "Taking it
 * away"; made; and not made, or made in part.
 */
const VERBS: Record<
  LocalMove['verb'],
  { making: string; not: string; partly: string }
> = {
  give: { making: 'Giving it', not: 'Not given', partly: 'Partly given' },
  take: { making: 'Taking it', not: 'Not taken', partly: 'Partly taken' },
  send: { making: 'Sending it', not: 'Not sent', partly: 'Partly sent' },
  distribute: {
    making: 'Distributing it',
    not: 'Not distributed',
    partly: 'Partly distributed',
  },
  remove: {
    making: 'Removing it',
    not: 'Not removed',
    partly: 'Partly removed',
  },
  // From module 0.49.0. Coins are added or taken away in one write: never in part.
  receive: { making: 'Adding it', not: 'Not added', partly: 'Not added' },
  pay: {
    making: 'Taking it away',
    not: 'Not taken away',
    partly: 'Not taken away',
  },
  handOut: {
    making: 'Handing it out',
    not: 'Not handed out',
    partly: 'Partly handed out',
  },
}

/**
 * Which of the character's other coins the game says went beyond those taken away or handed out
 * (module 0.49.0), as ", using 1 pp and 80 sp", by the sheet's abbreviations and in its order; none
 * where none did, or the game hasn't said.
 */
function usingWords(
  move: LocalMove,
  used: Readonly<Record<string, number>> | null | undefined,
): string {
  const coins = Object.entries(move.abbreviations ?? {}).map(
    ([id, abbreviation]) => ({ id, abbreviation }),
  )
  const words = used ? coinsWords(coins, used) : ''
  return words ? `, using ${words}` : ''
}

/** What was done, as the line after who did it says it: "gave 5 gp to Vex". */
function doneWords(
  move: LocalMove,
  state: Pick<TableRollState, 'transfer' | 'coins'>,
): string {
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
    case 'remove': {
      return `removed ${move.things}`
    }
    case 'receive': {
      return `received ${move.things}`
    }
    case 'pay': {
      return `paid ${move.things}${usingWords(move, state.coins?.used)}`
    }
    case 'handOut': {
      const using = usingWords(move, state.transfer?.used)
      return `handed out ${move.things} each to ${move.among ?? ''}${using}`
    }
  }
}

/**
 * Where a move is on its way to the game, or what became of it, in words: sent, being made, made,
 * as the Gamemaster's page tells it of the character that moved it, or that it was sent, where it
 * couldn't be followed; or not made, or made in part, and why.
 * @param fallback - Why a roll wasn't made, in words, for a reason no move has words of its own
 *   for.
 */
export function moveWords(
  move: LocalMove,
  state: Pick<
    TableRollState,
    'status' | 'reason' | 'transfer' | 'removed' | 'coins' | 'unfollowed'
  >,
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
      return `${verb.making} in ${game}…`
    }
    case 'done': {
      if (state.unfollowed) return `Sent to ${game}`
      const done = doneWords(move, state)
      return move.mover
        ? `${move.mover} ${done}`
        : `${done[0].toUpperCase()}${done.slice(1)}`
    }
    default: {
      const key = state.reason ?? state.status
      const reason = moveReasons(role, move.verb)[key] ?? fallback[key]
      const made =
        state.status === 'failed' && partly(move, state)
          ? verb.partly
          : verb.not
      return reason ? `${made}: ${reason}` : made
    }
  }
}
