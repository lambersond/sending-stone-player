import prisma from '@/clients/prisma'
import {
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { ago, madeBy, type RollRejection } from '@/db/roll-requests'
import { onItsWay } from '@/db/transfers'
import {
  checkFavorite,
  favoritesAvailable,
  targetKey,
} from '@/utils/favorite-commands'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// A favorite added to or removed from a character's (module 0.37.0) rides to the game as a removal
// does: held here as a RollRequest of the kind `favorite`, for the seat's character, which the
// module fetches at most once. It has no switch of its own: the module offers it wherever the
// system is dnd5e, apart from the rolls. It's its player's alone, of their own character: nothing
// in the game would mark it as the Gamemaster's, as dnd5e posts nothing for it.

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
  const { campaignId, actorId } = seat
  const favorite = input.favorite
  if (!campaignId || !actorId || !favorite) {
    return { status: 409, reason: 'unavailable' }
  }
  // The Gamemaster's page offers none: it would leave no mark of theirs.
  if (seat.role === 'gm') return { status: 409, reason: 'unavailable' }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { favoritesEnabled: true, bridgePolledAt: true, characters: true },
  })
  if (!campaign || !favoritesAvailable(campaign)) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  // The seat's limits are its rolls', shared with them, its moves and its removals, counted as
  // they are.
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

  const [sheet, waiting] = await Promise.all([
    prisma.actorSheet.findUnique({
      where: { campaignActor: { campaignId, actorId } },
      select: { data: true },
    }),
    prisma.rollRequest.findMany({
      where: { ...madeBy(seat), kind: 'favorite', ...onItsWay(now) },
      select: { payload: true },
      take: ROLLS_IN_FLIGHT,
    }),
  ])
  const data = sheet?.data as unknown as CharacterSheet | undefined
  const refusal = checkFavorite(favorite, data)
  if (refusal) return { status: 422, reason: refusal }
  // The same favorite isn't sent twice at once, as from a second tap: the game would make the
  // second of what the first left.
  const key = targetKey(favorite)
  if (
    waiting.some(({ payload }) => {
      const earlier = (payload as RollRequestInput | null)?.favorite
      return !!earlier && targetKey(earlier) === key
    })
  ) {
    return { status: 409, reason: 'moving' }
  }

  // What it's called is the app's alone, as for a roll; and nothing is typed in for a favorite, so
  // nothing says so.
  const command = { ...input }
  delete command.label
  delete command.typed
  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: seat.characterId,
      role: seat.role,
      requestedById: seat.userId,
      actorId,
      kind: 'favorite',
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
