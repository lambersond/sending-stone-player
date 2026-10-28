import prisma from '@/clients/prisma'
import {
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { ago, madeBy, type RollRejection } from '@/db/roll-requests'
import { onItsWay } from '@/db/transfers'
import { checkRemoval, relatedItems, removalsAvailable } from '@/utils/removals'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { SheetInventory } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// A removal of a character's item (module 0.33.0) rides the same way to the game as a move: held
// here as a RollRequest of the kind `remove`, for the seat's character, which the module fetches at
// most once. It has no switch of its own: the module offers it wherever the system is dnd5e, apart
// from the rolls and the moves.

/**
 * Take an item's removal from a character, from module 0.33.0, for the Gamemaster's game to make:
 * from its player, or the campaign's Gamemaster at its page; while its module removes items and is
 * fetching, with no switch of its own; where the seat isn't sending too many, of rolls and moves
 * together; where the character is in the campaign's roster; where the item is on its sheet, as
 * last sent, with at least as many of it as asked and as many as the page showed; and where neither
 * it, anything in it, nor a container it's in is on its way already from this seat.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The removal's id, or why it wasn't taken.
 */
export async function createRemoveRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  const { campaignId, actorId } = seat
  const remove = input.remove
  if (!campaignId || !actorId || !remove) {
    return { status: 409, reason: 'unavailable' }
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { removalsEnabled: true, bridgePolledAt: true, characters: true },
  })
  if (!campaign || !removalsAvailable(campaign)) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  // The seat's limits are its rolls', shared with them and its moves, counted as they are.
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

  const [sheet, moving] = await Promise.all([
    prisma.actorSheet.findUnique({
      where: { campaignActor: { campaignId, actorId } },
      select: { data: true },
    }),
    prisma.rollRequest.findMany({
      where: {
        ...madeBy(seat),
        kind: { in: ['transfer', 'remove'] },
        ...onItsWay(now),
      },
      select: { kind: true, payload: true },
      take: ROLLS_IN_FLIGHT,
    }),
  ])
  const data = sheet?.data as unknown as
    { inventory?: SheetInventory } | undefined
  const refusal = checkRemoval(remove, data)
  if (refusal) return { status: 422, reason: refusal }
  // Neither the item, anything in it, nor a container it's in is moved or removed twice at once:
  // the game would make the second of what the first left.
  const related = relatedItems(data, remove.item)
  if (
    moving.some(({ kind, payload }) => {
      const earlier = payload as RollRequestInput | null
      if (kind === 'remove') return related.has(earlier?.remove?.item ?? '')
      return (
        earlier?.transfer?.from === actorId &&
        (earlier.transfer.items ?? []).some(({ id }) => related.has(id))
      )
    })
  ) {
    return { status: 409, reason: 'moving' }
  }

  // What it's called is the app's alone, as for a roll: the Gamemaster's is kept for the
  // character's player to be shown it by. Nothing is typed in for a removal, so nothing says so: a
  // `typed` would badge its line "Entered by hand"; nor that its rerolls were kept (module 0.42.0).
  const { label, ...command } = input
  delete command.typed
  delete command.rerolls
  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: seat.characterId,
      role: seat.role,
      requestedById: seat.userId,
      actorId,
      kind: 'remove',
      ...(seat.role === 'gm' && label !== undefined && { label }),
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
