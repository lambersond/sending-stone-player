import prisma from '@/clients/prisma'
import { ROLLS_KEPT_FOR } from '@/constants/sending-stone'
import { due as pruneDue } from '@/db/commands'
import { PRUNE_EVERY } from '@/db/constants'
import {
  askTimes,
  heldTime,
  seesDiceAsks,
  toTableDiceAsks,
} from '@/utils/dice-asks'
import { rollStatus } from '@/utils/requests/status'
import type { Tx } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollKind } from '@/types/roll'
import type { GameDiceAsk } from '@/types/sending-stone'
import type { TableDiceAsk } from '@/types/table'
import type { HeldRollRequest, OtherRoll } from '@/utils/requests/types'
import type { Prisma } from '@prisma/client'

// The dice of later rolls in typed rolls' runs, which the game asks of their players (module
// 0.44.0): held from the module's roll.dice.asked until its roll.dice.closed, or a hello that no
// longer lists them, and read for the views that show them and the rolls they hold.

/**
 * A dice ask, as the module now describes it, held as waiting from when it came, what was left of
 * its wait when it was sent (`askTimes`); never moved by its later copies, as a hello's. One that
 * closed stays closed, but one closed as gone, as a hello that leaves it out closes it, is opened
 * again when the module lists or asks it again.
 * @param sentAt - When the module sent it, by the game's clock.
 */
export async function saveDiceAsk(
  tx: Tx,
  campaignId: string,
  ask: GameDiceAsk,
  sentAt: string,
  now = Date.now(),
) {
  const fields = {
    actorId: ask.actorId,
    ofActorId: ask.of ?? null,
    commandId: ask.command,
    data: {
      label: ask.label,
      purpose: ask.purpose,
      ...(ask.again && { again: ask.again }),
      critical: ask.critical,
      rolls: ask.rolls,
    } as Prisma.InputJsonObject,
  }
  await tx.diceAsk.updateMany({
    where: { campaignId, askId: ask.id, closedReason: 'gone' },
    data: { closedAt: null, closedReason: null },
  })
  await tx.diceAsk.upsert({
    where: { campaignAsk: { campaignId, askId: ask.id } },
    create: {
      campaignId,
      askId: ask.id,
      ...fields,
      ...askTimes(ask, sentAt, now),
    },
    update: fields,
  })
}

/** Close a dice ask, saying why, such as "answered": unless it closed already. */
export async function closeDiceAsk(
  tx: Tx,
  campaignId: string,
  askId: string,
  reason: string,
) {
  await tx.diceAsk.updateMany({
    where: { campaignId, askId, closedAt: null },
    data: { closedAt: new Date(), closedReason: reason },
  })
}

/**
 * Close as gone every dice ask a hello doesn't list, as one from a module before 0.44.0, or after
 * the Gamemaster reloaded, lists none.
 */
export async function closeUnlistedDiceAsks(
  tx: Tx,
  campaignId: string,
  listed: string[],
) {
  await tx.diceAsk.updateMany({
    where: { campaignId, closedAt: null, askId: { notIn: listed } },
    data: { closedAt: new Date(), closedReason: 'gone' },
  })
}

/** When this server last pruned each campaign's dice asks and prompts. */
const pruned = new Map<string, number>()

/**
 * Delete a campaign's dice asks, and the saves its game asked (ROADMAP item 20), closed or out of
 * time a day ago or more, as its rolls are kept a day: at most once every PRUNE_EVERY per server.
 * Nothing reads one after: a roll's view reads its asks only while it's on its way, and an answer
 * to either only while it waits.
 */
export async function pruneAsked(tx: Tx, campaignId: string, now: number) {
  if (!pruneDue(pruned, campaignId, PRUNE_EVERY, now)) return
  const before = new Date(now - ROLLS_KEPT_FOR)
  const old = {
    campaignId,
    OR: [{ closedAt: { lt: before } }, { expiresAt: { lt: before } }],
  }
  await tx.diceAsk.deleteMany({ where: old })
  await tx.rollPrompt.deleteMany({ where: old })
}

/**
 * The dice its game asks a seat's player for, as its view shows them, from module 0.44.0: those
 * still open, oldest first, of its character, or at a companion's seat of that companion in its
 * character's own runs; none, and nothing read, where the seat doesn't see them (`seesDiceAsks`).
 * @param rollsToTable - What the seat's rolls the game takes now, as its view says.
 * @returns The view's `diceAsks`, left out for none.
 */
export async function viewDiceAsks(
  seat: SheetSeat,
  rollsToTable: readonly RollKind[],
  now: number,
): Promise<{ diceAsks?: TableDiceAsk[] }> {
  const { campaignId, actorId } = seat
  if (!campaignId || !actorId || !seesDiceAsks(seat, rollsToTable)) return {}
  const held = await prisma.diceAsk.findMany({
    where: {
      campaignId,
      actorId,
      ofActorId: seat.companion?.of ?? null,
      closedAt: null,
      expiresAt: { gt: new Date(now) },
    },
    orderBy: { askedAt: 'asc' },
    select: {
      askId: true,
      commandId: true,
      data: true,
      expiresAt: true,
      closedAt: true,
    },
  })
  const diceAsks = toTableDiceAsks(held, now)
  return diceAsks.length > 0 ? { diceAsks } : {}
}

/**
 * The dice its game asks a character's player for in its companions' typed rolls' runs, from
 * module 0.44.0, still open, oldest first, by which the character's view marks each companion
 * asked: those of the character's own runs alone; none, and nothing read, where it has no
 * companions or the seat doesn't see dice asks (`seesDiceAsks`).
 * @param keys - The character's companions' keys.
 * @param rollsToTable - What the seat's rolls the game takes now, as its view says.
 */
export async function companionDiceAsks(
  seat: SheetSeat,
  keys: string[],
  rollsToTable: readonly RollKind[],
  now: number,
): Promise<{ actorId: string; data: unknown; expiresAt: Date }[]> {
  const { campaignId, actorId } = seat
  if (!campaignId || !actorId || keys.length === 0) return []
  if (!seesDiceAsks(seat, rollsToTable)) return []
  return prisma.diceAsk.findMany({
    where: {
      campaignId,
      actorId: { in: keys },
      ofActorId: actorId,
      closedAt: null,
      expiresAt: { gt: new Date(now) },
    },
    orderBy: { askedAt: 'asc' },
    select: { actorId: true, data: true, expiresAt: true },
  })
}

/** The dice asks of one typed roll, for how long they held it, and whether one waits now. */
export function rollDiceAsks(campaignId: string, commandId: string) {
  return prisma.diceAsk.findMany({
    where: { campaignId, commandId },
    select: { askedAt: true, expiresAt: true, closedAt: true },
  })
}

/**
 * Other rolls a check reads, as another damage for the same use or another answer to the same
 * save, each with the time its dice asks held it (`held`), as its own view counts it: a typed roll
 * the game holds asking for its run's later dice isn't lost meanwhile, nor taken again from
 * another device. Asks are read only for those the game fetched that their own time alone would
 * count as lost, as only for those can they change it; the rest are as they were.
 */
export async function withHeldTime(
  campaignId: string,
  rolls: Pick<HeldRollRequest, 'id' | 'status' | 'createdAt' | 'claimedAt'>[],
  now: number,
): Promise<OtherRoll[]> {
  const lost = rolls.filter(roll => rollStatus(roll, now) === 'lost')
  if (lost.length === 0) return rolls
  const asks = await prisma.diceAsk.findMany({
    where: { campaignId, commandId: { in: lost.map(({ id }) => id) } },
    select: { commandId: true, askedAt: true, expiresAt: true, closedAt: true },
  })
  return rolls.map(roll => {
    const own = asks.filter(({ commandId }) => commandId === roll.id)
    return own.length > 0 ? { ...roll, held: heldTime(own, now) } : roll
  })
}
