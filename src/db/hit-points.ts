import { createCommand } from '@/db/commands'
import { checkHitPoints } from '@/utils/hit-points'
import type { CommandSpec, RollRejection } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'

// Hit points and temporary hit points set from the app (module 0.44.0) ride to the game as an
// effect does: held here as a RollRequest of the kind `hitPoints`, for the seat's character, or at
// a companion's seat for the companion, which the module fetches at most once. It has a switch of
// its own, the campaign's, apart from the rolls, on by default. It's its player's alone: nothing in
// the game would mark it as the Gamemaster's, as it posts nothing in chat, as dnd5e's own sheet
// posts nothing; the Gamemaster sets hit points in Foundry. While the character is in Wild Shape
// it sets the form's, which the module makes it on, so it never waits.

/** Hit points set, as `createCommand` takes it. */
const HIT_POINTS_COMMAND: CommandSpec<'hitPoints'> = {
  kind: 'hitPoints',
  waiting: { kind: 'hitPoints', select: { actorId: true, payload: true } },
  check: checkHitPoints,
  // One change at a time to an actor's hit points from a seat, as from a second tap: the second
  // would be refused as changed, or set what the first left. Another actor's, as a companion's,
  // doesn't clash.
  clashes: (waiting, _hitPoints, _sheet, actorId) =>
    waiting.some(row => row.actorId === actorId),
}

/**
 * Take hit points or temporary hit points set, or both, from module 0.44.0, for the Gamemaster's
 * game to set: the character's, its form's while shaped, or at a companion's seat the companion's;
 * from the character's player only, never the Gamemaster at its page; while the campaign lets its
 * players and its module is fetching; where the seat isn't sending too many, of rolls and every
 * other kind together; where the character is in the campaign's roster, or the companion is listed
 * as its character's now; where the sheet, as last sent, its own at a companion's, has hit points
 * that still hold what the page showed (`checkHitPoints`); and where no change to that actor's hit
 * points is on its way already from this seat.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The change's id, or why it wasn't taken.
 */
export async function createHitPointsRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  return createCommand(seat, input, HIT_POINTS_COMMAND)
}
