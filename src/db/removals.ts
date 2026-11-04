import { createCommand } from '@/db/commands'
import { checkRemoval, relatedItems } from '@/utils/removals'
import type { CommandSpec, RollRejection } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'

// A removal of a character's item (module 0.33.0) rides the same way to the game as a move: held
// here as a RollRequest of the kind `remove`, for the seat's character, which the module fetches at
// most once. It has no switch of its own: the module offers it wherever the system is dnd5e, apart
// from the rolls and the moves.

/** An item's removal, as `createCommand` takes it: the Gamemaster's too. */
const REMOVE_COMMAND: CommandSpec<'remove'> = {
  kind: 'remove',
  waiting: {
    kind: { in: ['transfer', 'remove'] },
    select: { kind: true, payload: true },
  },
  check: checkRemoval,
  // Neither the item, anything in it, nor a container it's in is moved or removed twice at once:
  // the game would make the second of what the first left.
  clashes: (moving, remove, sheet, actorId) => {
    const related = relatedItems(sheet, remove.item)
    return moving.some(({ kind, payload }) => {
      const earlier = payload as RollRequestInput | null
      if (kind === 'remove') return related.has(earlier?.remove?.item ?? '')
      return (
        earlier?.transfer?.from === actorId &&
        (earlier.transfer.items ?? []).some(({ id }) => related.has(id))
      )
    })
  },
}

/**
 * Take an item's removal from a character, from module 0.33.0, for the Gamemaster's game to make:
 * from its player, or the campaign's Gamemaster at its page; while its module removes items and is
 * fetching, with no switch of its own; where the seat isn't sending too many, of rolls and moves
 * together; where the character is in the campaign's roster; where the item is on its sheet, as
 * last sent, with at least as many of it as asked and as many as the page showed; and where neither
 * it, anything in it, nor a container it's in is on its way already from this seat. What it's
 * called is the app's alone, as for a roll: the Gamemaster's is kept for the character's player to
 * be shown it by. Nothing is typed in for a removal, so nothing says so: a `typed` would badge its
 * line "Entered by hand".
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The removal's id, or why it wasn't taken.
 */
export async function createRemoveRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  return createCommand(seat, input, REMOVE_COMMAND)
}
