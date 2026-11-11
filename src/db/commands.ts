import prisma from '@/clients/prisma'
import { ROLL_KIND_INFO } from '@/constants/roll-kinds'
import {
  ROLL_ANSWER_WITHIN,
  ROLL_PENDING_FOR,
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { switchOn } from '@/utils/features'
import { commandPayload, keptLabel } from '@/utils/requests/payloads'
import { seatListed } from '@/utils/roster'
import type {
  CommandCampaign,
  CommandKind,
  CommandRow,
  CommandSpec,
  CommandValue,
  RollSeat,
  WaitingRow,
} from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type { RollRequestInput } from '@/types/roll'
import type { CharacterSheet } from '@/types/sending-stone'
import type { RollRejection } from '@/utils/requests/types'
import type { Prisma } from '@prisma/client'

// What every command a seat sends rides on: a RollRequest held for the module to fetch, the seat's
// own rows found by who made them, and those still on their way.

/**
 * The rolls a seat sent (#156): its player's, by their character; or the Gamemaster's as this
 * character in this campaign, by them. Never only `characterId: null`, which every Gamemaster's
 * roll has, of every campaign. The two seats' rolls are apart, so each has its own limits, and
 * damage follows only its own seat's attack or use.
 */
export function madeBy(seat: RollSeat): Prisma.RollRequestWhereInput {
  if (seat.role === 'gm') {
    return {
      // A Gamemaster's seat always has both; '' matches no row should one be missing.
      campaignId: seat.campaignId ?? '',
      actorId: seat.actorId ?? '',
      role: 'gm',
      requestedById: seat.userId,
    }
  }
  return { characterId: seat.characterId ?? '' }
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
 * A seat's rows that count against its limits: all but its answers to the dice the game asks for
 * (module 0.44.0), which the roll they answer, itself on its way, waits on; one an ask is allowed
 * instead.
 */
export const COUNTED: Prisma.RollRequestWhereInput = { kind: { not: 'dice' } }

/** The moment this many milliseconds before another. */
export function ago(now: number, ms: number): Date {
  return new Date(now - ms)
}

/**
 * Whether a seat is sending too many to take another: its rolls and everything else it sends,
 * counted together, on their way or sent in the last minute; never its answers to dice asks.
 */
export async function seatBusy(seat: RollSeat, now: number): Promise<boolean> {
  const [inFlight, lastMinute] = await Promise.all([
    prisma.rollRequest.count({
      where: { ...madeBy(seat), ...onItsWay(now), ...COUNTED },
    }),
    prisma.rollRequest.count({
      where: {
        ...madeBy(seat),
        createdAt: { gt: ago(now, 60_000) },
        ...COUNTED,
      },
    }),
  ])
  return inFlight >= ROLLS_IN_FLIGHT || lastMinute >= ROLLS_PER_MINUTE
}

/**
 * The sheet a command is checked against, as last sent: the character's, or at a companion's seat
 * (module 0.44.0) the companion's own, kept apart from the characters'.
 */
function sheetOf(seat: SheetSeat, campaignId: string, actorId: string) {
  return seat.companion
    ? prisma.companionSheet.findUnique({
        where: { campaignCompanion: { campaignId, key: actorId } },
        select: { data: true },
      })
    : prisma.actorSheet.findUnique({
        where: { campaignActor: { campaignId, actorId } },
        select: { data: true },
      })
}

/**
 * Hold what a seat sent for the module to fetch, as a RollRequest of its seat's, made now; and let
 * the seat's older ones go, as only the latest are asked after.
 * @param row - Its campaign and actor, then the rest of the row, in the order it's written.
 * @returns The row's id.
 */
export async function holdCommand(
  seat: SheetSeat,
  row: CommandRow,
  now: number,
): Promise<{ id: string }> {
  const { campaignId, actorId, ...rest } = row
  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: seat.characterId,
      role: seat.role,
      requestedById: seat.userId,
      actorId,
      ...rest,
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
 * Take a command that rides to the game as a roll does but is none, for the Gamemaster's game to
 * make: an item removed (module 0.33.0), a favorite (0.37.0), an effect changed (0.39.0), Wild
 * Shape (0.40.0) or hit points set (0.44.0). From its player, or the campaign's Gamemaster at its
 * page where the kind is theirs to send too; while the campaign's own switch for it is on and its
 * module is fetching; where the seat isn't sending too many, of rolls and every other kind
 * together; where the character is in the campaign's roster, or at a companion's seat, where the
 * kind lets one through, the companion is listed as its character's now; where the sheet, as last
 * sent, its own at a companion's, lets it be done (`check`); and where nothing of the seat's on its
 * way clashes with it, as from a second tap (`clashes`). A companion's is kept as its key, with its
 * character's id, for the module to make it on the companion.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The command's id, or why it wasn't taken.
 */
export async function createCommand<K extends CommandKind>(
  seat: SheetSeat,
  input: RollRequestInput,
  spec: CommandSpec<K>,
): Promise<{ id: string } | RollRejection> {
  const { campaignId, actorId } = seat
  const value = input[spec.kind] as CommandValue<K> | undefined
  if (!campaignId || !actorId || !value) {
    return { status: 409, reason: 'unavailable' }
  }
  const info = ROLL_KIND_INFO[spec.kind]
  // The Gamemaster's page offers none of a player's own: it would leave no mark of theirs, or be
  // the player's in the game.
  if ('gm' in info && seat.role === 'gm') {
    return { status: 409, reason: 'unavailable' }
  }
  const { companion } = seat
  const campaign = (await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      [info.own]: true,
      bridgePolledAt: true,
      characters: true,
      ...(companion && { companions: true }),
    },
  })) as CommandCampaign | null
  if (!campaign || !switchOn(campaign, info.own)) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  if (await seatBusy(seat, now)) return { status: 429, reason: 'busy' }
  if (!seatListed(seat, campaign)) {
    return { status: 422, reason: 'unknown' }
  }

  const { waiting } = spec
  const [sheet, rows] = await Promise.all([
    sheetOf(seat, campaignId, actorId),
    waiting.skip?.(value)
      ? Promise.resolve([])
      : prisma.rollRequest.findMany({
          where: { ...madeBy(seat), kind: waiting.kind, ...onItsWay(now) },
          select: waiting.select,
          take: ROLLS_IN_FLIGHT,
        }),
  ])
  const data = sheet?.data as unknown as CharacterSheet | undefined
  const refusal = spec.check(value, data)
  if (refusal) return { status: 422, reason: refusal }
  // The game would make the second of what the first left.
  if (spec.clashes(rows as WaitingRow[], value, data, actorId)) {
    return { status: 409, reason: 'moving' }
  }

  return holdCommand(
    seat,
    {
      campaignId,
      actorId,
      // A companion's, made on it, names its character (module 0.44.0).
      ...(companion && { ofActorId: companion.of }),
      kind: spec.kind,
      ...keptLabel(seat, input.label),
      payload: commandPayload(input) as unknown as Prisma.InputJsonValue,
    },
    now,
  )
}

/**
 * Whether it's time to note something again that this server notes at most once every so often,
 * by a key, such as a campaign's; and if it is, that it's noted now. Each server keeps its own.
 * A key whose time has passed is forgotten as another is noted, as it would be due anyway, so a
 * map, always kept with the same `every`, holds only the keys noted within it.
 */
export function due(
  noted: Map<string, number>,
  key: string,
  every: number,
  now: number,
): boolean {
  if (now - (noted.get(key) ?? 0) < every) return false
  // Kept in the order noted, so that those whose time has passed come first.
  noted.delete(key)
  noted.set(key, now)
  for (const [held, at] of noted) {
    if (now - at < every) break
    noted.delete(held)
  }
  return true
}
