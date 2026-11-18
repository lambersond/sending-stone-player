import { createCommand } from '@/db/commands'
import { checkCoins } from '@/utils/coins'
import type { CommandSpec } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { RollRejection } from '@/utils/requests/types'

// Coins added to a character or taken away from the app (module 0.49.0) ride to the game as a
// removal does: held here as a RollRequest of the kind `coins`, for the seat's character, which the
// module fetches at most once. They have a switch of their own, the campaign's, apart from the
// rolls and from moves, on by default. The Gamemaster's at the character's page is taken too, and
// marked as theirs in the game's chat, where each change posts a line. Never a companion's.

/** Coins added or taken away, as `createCommand` takes them. */
const COINS_COMMAND: CommandSpec<'coins'> = {
  kind: 'coins',
  // Whether another coin pays where the character is short of one, as its module said last.
  select: { coinFeatures: true },
  waiting: {
    kind: { in: ['coins', 'transfer'] },
    select: { kind: true, actorId: true, payload: true },
  },
  check: (coins, sheet, { coinFeatures = [] }) =>
    checkCoins(coins, sheet, coinFeatures.includes('change')),
  // One change at a time to a character's coins from a seat, as from a second tap: the game would
  // make the second of what the first left. A move of coins from the character on its way, a
  // hand-out among them, likewise: the two would be checked against the same coins.
  clashes: (waiting, _coins, _sheet, actorId) =>
    waiting.some(({ kind, actorId: of, payload }) => {
      if (kind === 'coins') return of === actorId
      const moved = (payload as RollRequestInput | null)?.transfer
      return moved?.from === actorId && !!moved.currency
    }),
}

/**
 * Take coins added to a character or taken away, from module 0.49.0, for the Gamemaster's game to
 * make: from the character's player, or the campaign's Gamemaster at its page; while the campaign
 * lets its players and its module is fetching; where the seat isn't sending too many, of rolls and
 * every other kind together; where the character is in the campaign's roster; where each coin is
 * on its sheet, as last sent, and those taken away are covered by what it holds, by its other
 * coins too only where its module pays with them (`checkCoins`); and where no change to its coins,
 * nor a move of coins from it, is on its way already from this seat.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The change's id, or why it wasn't taken.
 */
export async function createCoinsRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  return createCommand(seat, input, COINS_COMMAND)
}
