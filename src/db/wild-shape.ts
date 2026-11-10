import prisma from '@/clients/prisma'
import { createCommand } from '@/db/commands'
import { checkWildShape, isShaped } from '@/utils/wild-shape'
import type { CommandSpec } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type { RollRejection } from '@/utils/requests/types'

// Wild Shape from the app (module 0.40.0) rides to the game as an effect does: held here as a
// RollRequest of the kind `wildShape`, for the seat's character, which the module fetches at most
// once. It has a switch of its own, the campaign's, apart from the rolls. It's its player's alone,
// of their own character: a change made from the Gamemaster's page would be the player's in the
// game, past dnd5e's own Allow Polymorphing; the Gamemaster changes a druid in Foundry. And while a
// character is transformed, the kinds that would change what its own actor holds wait until it's
// back in its own form, as the form's copies are lost on the return.

/** Wild Shape, as `createCommand` takes it. */
const WILD_SHAPE_COMMAND: CommandSpec<'wildShape'> = {
  kind: 'wildShape',
  waiting: {
    kind: 'wildShape',
    select: { payload: true },
    // The Beasts to learn are a read: nothing on its way holds them back, so no row is looked for.
    skip: ({ op }) => op === 'forms',
  },
  check: checkWildShape,
  // One change, return or form learned at a time from a seat, as from a second tap: the game would
  // make the second on what the first left, a second use spent or a second place filled. A list
  // of Beasts on its way is no change.
  clashes: waiting =>
    waiting.some(({ payload }) => {
      const op = (payload as RollRequestInput | null)?.wildShape?.op
      return op !== undefined && op !== 'forms'
    }),
}

/**
 * Take Wild Shape from the app, from module 0.40.0, for the Gamemaster's game to make: a change
 * into a known form, a return, a Beast learned, or the Beasts to learn listed; from the character's
 * player only, never the Gamemaster at its page; while the campaign lets its players and its
 * module is fetching; where the seat isn't sending too many, of rolls, moves, removals, favorites
 * and effects together; where the character is in the campaign's roster; where the sheet, as last
 * sent, lets its player do it (`checkWildShape`); and where no change, return or form learned is
 * on its way already from this seat, as from a second tap. The Beasts to learn, which write
 * nothing, are never held back by one on its way, nor hold one back.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The command's id, or why it wasn't taken.
 */
export async function createWildShapeRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  return createCommand(seat, input, WILD_SHAPE_COMMAND)
}

/**
 * Whether a favorite, an effect, a move or a removal waits until its character is back in its own
 * form, from module 0.40.0: the seat's character is transformed, as its sheet last said, or, for a
 * move, a character at either end is, its giver or its recipient, or one a party's coin is shared
 * among. What the form holds is a copy that dnd5e's return loses, and its own gear isn't on it.
 * Checked before each kind's own ladder, so the player is told so first.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns 422 `shaped`, or nothing where none is transformed or the seat names no character.
 */
export async function shapedRefusal(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<RollRejection | undefined> {
  const { campaignId, actorId } = seat
  if (!campaignId || !actorId) return undefined
  const transfer = input.kind === 'transfer' ? input.transfer : undefined
  const ends = transfer
    ? [transfer.from, transfer.to, ...(transfer.among ?? [])]
    : []
  // A party at an end has no sheet among the characters', so is never found here.
  const ids = [
    ...new Set([actorId, ...ends].filter(id => typeof id === 'string')),
  ]
  const sheets = await prisma.actorSheet.findMany({
    where: { campaignId, actorId: { in: ids } },
    select: { data: true },
  })
  const shaped = sheets.some(({ data }) =>
    isShaped(data as unknown as CharacterSheet | null),
  )
  return shaped ? { status: 422, reason: 'shaped' } : undefined
}
