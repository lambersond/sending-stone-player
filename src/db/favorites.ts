import { createCommand } from '@/db/commands'
import { checkFavorite, targetKey } from '@/utils/favorite-commands'
import type { CommandSpec } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { RollRejection } from '@/utils/requests/types'

// A favorite added to or removed from a character's (module 0.37.0) rides to the game as a removal
// does: held here as a RollRequest of the kind `favorite`, for the seat's character, which the
// module fetches at most once. It has no switch of its own: the module offers it wherever the
// system is dnd5e, apart from the rolls. It's its player's alone, of their own character: nothing
// in the game would mark it as the Gamemaster's, as dnd5e posts nothing for it.

/** A favorite added or removed, as `createCommand` takes it. */
const FAVORITE_COMMAND: CommandSpec<'favorite'> = {
  kind: 'favorite',
  waiting: { kind: 'favorite', select: { payload: true } },
  check: checkFavorite,
  // The same favorite isn't sent twice at once, as from a second tap: the game would make the
  // second of what the first left.
  clashes: (waiting, favorite) => {
    const key = targetKey(favorite)
    return waiting.some(({ payload }) => {
      const earlier = (payload as RollRequestInput | null)?.favorite
      return !!earlier && targetKey(earlier) === key
    })
  },
}

/**
 * Take a favorite added to or removed from a character's, from module 0.37.0, for the Gamemaster's
 * game to make: from its player only, never the Gamemaster at its page; while its module takes
 * favorites and is fetching, with no switch of its own; where the seat isn't sending too many, of
 * rolls, moves and removals together; where the character is in the campaign's roster; for an
 * Add, where what's added is on its sheet, as last sent; and where the same isn't on its way
 * already from this seat.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The favorite's id, or why it wasn't taken.
 */
export async function createFavoriteRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  return createCommand(seat, input, FAVORITE_COMMAND)
}
