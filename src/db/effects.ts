import prisma from '@/clients/prisma'
import {
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { ago, madeBy, type RollRejection } from '@/db/roll-requests'
import { onItsWay } from '@/db/transfers'
import { checkEffect, effectsAvailable } from '@/utils/effect-commands'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// One of a character's own effects turned off, turned on or deleted (module 0.39.0) rides to the
// game as a favorite does: held here as a RollRequest of the kind `effect`, for the seat's
// character, which the module fetches at most once. It has a switch of its own, the campaign's,
// apart from the rolls. It's its player's alone, of their own character: nothing in the game would
// mark it as the Gamemaster's, as dnd5e posts nothing for it.

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
  const { campaignId, actorId } = seat
  const effect = input.effect
  if (!campaignId || !actorId || !effect) {
    return { status: 409, reason: 'unavailable' }
  }
  // The Gamemaster's page offers none: it would leave no mark of theirs.
  if (seat.role === 'gm') return { status: 409, reason: 'unavailable' }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { effectsEnabled: true, bridgePolledAt: true, characters: true },
  })
  if (!campaign || !effectsAvailable(campaign)) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  // The seat's limits are its rolls', shared with them, its moves, its removals and its favorites,
  // counted as they are.
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
      where: { ...madeBy(seat), kind: 'effect', ...onItsWay(now) },
      select: { payload: true },
      take: ROLLS_IN_FLIGHT,
    }),
  ])
  const data = sheet?.data as unknown as CharacterSheet | undefined
  const refusal = checkEffect(effect, data)
  if (refusal) return { status: 422, reason: refusal }
  // A change to the same effect isn't sent twice at once, as from a second tap: the game would make
  // the second of what the first left.
  if (
    waiting.some(
      ({ payload }) =>
        (payload as RollRequestInput | null)?.effect?.id === effect.id,
    )
  ) {
    return { status: 409, reason: 'moving' }
  }

  // What it's called is the app's alone, as for a roll; and nothing is typed in for an effect, so
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
      kind: 'effect',
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
