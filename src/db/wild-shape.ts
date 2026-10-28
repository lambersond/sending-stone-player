import prisma from '@/clients/prisma'
import {
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { ago, madeBy, type RollRejection } from '@/db/roll-requests'
import { onItsWay } from '@/db/transfers'
import {
  checkWildShape,
  isShaped,
  wildShapeAvailable,
} from '@/utils/wild-shape'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// Wild Shape from the app (module 0.40.0) rides to the game as an effect does: held here as a
// RollRequest of the kind `wildShape`, for the seat's character, which the module fetches at most
// once. It has a switch of its own, the campaign's, apart from the rolls. It's its player's alone,
// of their own character: a change made from the Gamemaster's page would be the player's in the
// game, past dnd5e's own Allow Polymorphing; the Gamemaster changes a druid in Foundry. And while a
// character is transformed, the kinds that would change what its own actor holds wait until it's
// back in its own form, as the form's copies are lost on the return.

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
  const { campaignId, actorId } = seat
  const wildShape = input.wildShape
  if (!campaignId || !actorId || !wildShape) {
    return { status: 409, reason: 'unavailable' }
  }
  // The Gamemaster's page offers none: a change from it would be the player's in the game.
  if (seat.role === 'gm') return { status: 409, reason: 'unavailable' }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { wildShapeEnabled: true, bridgePolledAt: true, characters: true },
  })
  if (!campaign || !wildShapeAvailable(campaign)) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  // The seat's limits are its rolls', shared with them and every other kind, counted as they are.
  const [inFlight, lastMinute] = await Promise.all([
    prisma.rollRequest.count({ where: { ...madeBy(seat), ...onItsWay(now) } }),
    prisma.rollRequest.count({
      where: { ...madeBy(seat), createdAt: { gt: ago(now, 60_000) } },
    }),
  ])
  if (inFlight >= ROLLS_IN_FLIGHT || lastMinute >= ROLLS_PER_MINUTE) {
    return { status: 429, reason: 'busy' }
  }

  const roster = Array.isArray(campaign.characters)
    ? (campaign.characters as unknown as { id: string }[])
    : []
  if (!roster.some(({ id }) => id === actorId)) {
    return { status: 422, reason: 'unknown' }
  }

  // The Beasts to learn are a read: nothing on its way holds them back, so no row is looked for.
  const read = wildShape.op === 'forms'
  const [sheet, waiting] = await Promise.all([
    prisma.actorSheet.findUnique({
      where: { campaignActor: { campaignId, actorId } },
      select: { data: true },
    }),
    read
      ? Promise.resolve([])
      : prisma.rollRequest.findMany({
          where: { ...madeBy(seat), kind: 'wildShape', ...onItsWay(now) },
          select: { payload: true },
          take: ROLLS_IN_FLIGHT,
        }),
  ])
  const data = sheet?.data as unknown as CharacterSheet | undefined
  const refusal = checkWildShape(wildShape, data)
  if (refusal) return { status: 422, reason: refusal }
  // One change, return or form learned at a time from a seat, as from a second tap: the game would
  // make the second on what the first left, a second use spent or a second place filled. A list
  // of Beasts on its way is no change.
  if (
    waiting.some(({ payload }) => {
      const op = (payload as RollRequestInput | null)?.wildShape?.op
      return op !== undefined && op !== 'forms'
    })
  ) {
    return { status: 409, reason: 'moving' }
  }

  // What it's called is the app's alone, as for a roll; and nothing is typed in for Wild Shape, so
  // nothing says so, nor that its rerolls were kept (module 0.42.0).
  const command = { ...input }
  delete command.label
  delete command.typed
  delete command.rerolls
  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: seat.characterId,
      role: seat.role,
      requestedById: seat.userId,
      actorId,
      kind: 'wildShape',
      payload: command as unknown as Prisma.InputJsonValue,
      createdAt: new Date(now),
    },
    select: { id: true },
  })
  await prisma.rollRequest.deleteMany({
    where: { ...madeBy(seat), createdAt: { lt: ago(now, ROLLS_KEPT_FOR) } },
  })
  return { id }
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
