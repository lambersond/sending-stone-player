import prisma from '@/clients/prisma'
import {
  ROLL_ANSWER_WITHIN,
  ROLL_PENDING_FOR,
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { groupRoster } from '@/db/party'
import { ago, madeBy, type RollRejection } from '@/db/roll-requests'
import { relatedItems } from '@/utils/removals'
import {
  checkAmong,
  checkEnds,
  checkHoldings,
  transfersAvailable,
} from '@/utils/transfers'
import type { SheetSeat } from '@/types/character'
import type { GroupSheet } from '@/types/party'
import type { RollRequestInput, TransferInput } from '@/types/roll'
import type { SheetInventory } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// A move of items and coins (module 0.31.0) rides the same way to the game as a roll: held here as
// a RollRequest of the kind `transfer`, for the seat's character, which the module fetches at most
// once. It has its own switch, apart from the rolls, which gates the Gamemaster's moves too. From
// module 0.32.0, a party's coin distributed among its characters is one too, as a move with
// `among` in place of `to`.

/**
 * Take a move of items and coins for the Gamemaster's game to make, from a character's player or
 * the campaign's Gamemaster as it: while the campaign lets them be moved and its module is
 * fetching moves, and a distribution only where its module shares a party's coin (module 0.32.0),
 * and the seat isn't sending too many, of rolls and moves together; where the seat may make it, by
 * the campaign's roster, its groups' access and what its module does with moves; a distribution
 * only among the party's characters, as its sheet was last sent; where what's moved is on the
 * sheet it's moved from, as last sent; and where none of it is on its way already, from the same
 * end, as from a retry, or a second tap, nor, from module 0.33.0, being removed from the seat's
 * character, nor in or around an item that is.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The move's id, or why it wasn't taken.
 */
export async function createTransferRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  const { campaignId, actorId } = seat
  const transfer = input.transfer
  if (!campaignId || !actorId || !transfer) {
    return { status: 409, reason: 'unavailable' }
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      transfersEnabled: true,
      transferFeatures: true,
      bridgePolledAt: true,
      characters: true,
      groups: true,
    },
  })
  if (!campaign || !transfersAvailable(campaign)) {
    return { status: 409, reason: 'unavailable' }
  }
  // A distribution needs a module that shares a party's coin.
  if (transfer.among && !campaign.transferFeatures.includes('distribute')) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  // The seat's limits are its rolls', shared with them, counted as they are.
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
  const groups = groupRoster(campaign.groups)
  const ends = checkEnds(
    seat,
    transfer,
    roster,
    groups,
    campaign.transferFeatures,
  )
  if (ends) return { status: 422, reason: ends }

  const fromGroup = groups.some(({ id }) => id === transfer.from)
  const where = { campaignId, actorId: transfer.from }
  const [sheet, moving] = await Promise.all([
    fromGroup
      ? prisma.groupSheet.findUnique({
          where: { campaignGroup: where },
          select: { data: true },
        })
      : prisma.actorSheet.findUnique({
          where: { campaignActor: where },
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
  // A distribution is shared among the party's characters as its sheet has them, no others.
  const members =
    transfer.among &&
    checkAmong(
      transfer,
      sheet?.data as unknown as Partial<GroupSheet> | undefined,
    )
  if (members) return { status: 422, reason: members }
  const data = sheet?.data as unknown as
    { inventory?: SheetInventory } | undefined
  const holdings = checkHoldings(transfer, data)
  if (holdings) return { status: 422, reason: holdings }
  if (
    moving.some(({ kind, payload }) => {
      const earlier = payload as RollRequestInput | null
      // A removal of the seat's character's item, from module 0.33.0, keeps it, what's in it and
      // any container it's in from being moved from it meanwhile.
      if (kind === 'remove') {
        const related = relatedItems(data, earlier?.remove?.item ?? '')
        return (
          transfer.from === seat.actorId &&
          (transfer.items ?? []).some(({ id }) => related.has(id))
        )
      }
      return overlaps(earlier?.transfer, transfer)
    })
  ) {
    return { status: 409, reason: 'moving' }
  }

  // What it's called is the app's alone, as for a roll: the Gamemaster's is kept for the
  // character's player to be shown it by. Nothing is typed in for a move, so nothing says so: a
  // `typed` would badge its line "Entered by hand".
  const { label, ...command } = input
  delete command.typed
  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: seat.characterId,
      role: seat.role,
      requestedById: seat.userId,
      actorId,
      kind: 'transfer',
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

/**
 * A seat's rolls and moves on their way: waiting to be fetched, or fetched and not answered. Its
 * removals too, from module 0.33.0.
 */
export function onItsWay(now: number): Prisma.RollRequestWhereInput {
  return {
    OR: [
      { status: 'pending', createdAt: { gt: ago(now, ROLL_PENDING_FOR) } },
      { status: 'claimed', claimedAt: { gt: ago(now, ROLL_ANSWER_WITHIN) } },
    ],
  }
}

/**
 * Whether a move on its way moves any of the same from the same end: one of the same items, or
 * coins, as both do.
 */
function overlaps(
  earlier: TransferInput | undefined,
  transfer: TransferInput,
): boolean {
  if (!earlier || earlier.from !== transfer.from) return false
  const ids = new Set((earlier.items ?? []).map(({ id }) => id))
  const items = (transfer.items ?? []).some(({ id }) => ids.has(id))
  return items || (!!earlier.currency && !!transfer.currency)
}
