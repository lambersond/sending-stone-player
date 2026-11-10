import { createCommand } from '@/db/commands'
import { checkEffect } from '@/utils/effect-commands'
import type { CommandSpec } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { RollRejection } from '@/utils/requests/types'

// One of a character's own effects turned off, turned on or deleted (module 0.39.0) rides to the
// game as a favorite does: held here as a RollRequest of the kind `effect`, for the seat's
// character, which the module fetches at most once. It has a switch of its own, the campaign's,
// apart from the rolls. It's its player's alone, of their own character: nothing in the game would
// mark it as the Gamemaster's, as dnd5e posts nothing for it.

/** A change to one of a character's own effects, as `createCommand` takes it. */
const EFFECT_COMMAND: CommandSpec<'effect'> = {
  kind: 'effect',
  waiting: { kind: 'effect', select: { payload: true } },
  check: checkEffect,
  // A change to the same effect isn't sent twice at once, as from a second tap: the game would make
  // the second of what the first left.
  clashes: (waiting, effect) =>
    waiting.some(
      ({ payload }) =>
        (payload as RollRequestInput | null)?.effect?.id === effect.id,
    ),
}

/**
 * Take one of a character's own effects turned off, turned on or deleted, from module 0.39.0, for
 * the Gamemaster's game to make: from its player only, never the Gamemaster at its page; while the
 * campaign lets its players and its module is fetching; where the seat isn't sending too many, of
 * rolls, moves, removals and favorites together; where the character is in the campaign's roster;
 * where the effect is on its sheet, as last sent, and its `ops` let its player do that to it, or
 * it's so already, off, on or gone, which the module answers done (`checkEffect`); and where a
 * change to the same effect isn't on its way already from this seat.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The change's id, or why it wasn't taken.
 */
export async function createEffectRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  return createCommand(seat, input, EFFECT_COMMAND)
}
