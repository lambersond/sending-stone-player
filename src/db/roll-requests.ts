import { randomUUID } from 'node:crypto'
import prisma from '@/clients/prisma'
import {
  PLAYERS_PRESENT_FOR,
  PLAYERS_SEEN_EVERY,
  ROLL_ANSWER_WITHIN,
  ROLL_PENDING_FOR,
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
} from '@/constants/sending-stone'
import { closePrompt } from '@/db/campaign-events'
import { changes } from '@/utils/damage-modifiers'
import { checkPrompt } from '@/utils/prompts'
import {
  availableRollKinds,
  checkDamage,
  checkRoll,
  toCommand,
  toRollRequestView,
  type HeldRollRequest,
  type RollCommand,
  type RollRefusal,
} from '@/utils/roll-requests'
import type { Character } from '@/types/character'
import type { RollRequestInput, RollRequestView } from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  CommandResult,
} from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// A player's roll goes to the Gamemaster's game through the module, which fetches it. It is
// fetched at most once: a fetch whose answer is lost loses the roll rather than making it twice,
// which matters most for rolls that spend something, such as a spell slot.

/** The most rolls one fetch takes. */
const CLAIM_LIMIT = 10

const heldSelect = {
  id: true,
  actorId: true,
  kind: true,
  payload: true,
  status: true,
  result: true,
  createdAt: true,
  claimedAt: true,
} as const

/** Why a roll wasn't taken, with the HTTP status that says so. */
export type RollRejection = {
  status: 409 | 422 | 429
  reason: RollRefusal | 'busy'
}

/**
 * Take a player's roll for their character to make in the Gamemaster's game: if the game takes
 * this kind of roll now, the sheet allows it, and the player isn't sending too many.
 * @param character - The player's character, already checked to be theirs.
 * @returns The roll's id, or why it wasn't taken.
 */
export async function createRollRequest(
  character: Character,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  const { campaignId, actorId } = character
  if (!campaignId || !actorId) return { status: 409, reason: 'unavailable' }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      rollsEnabled: true,
      rollKinds: true,
      rollFeatures: true,
      bridgePolledAt: true,
    },
  })
  if (!campaign || !availableRollKinds(campaign).includes(input.kind)) {
    return { status: 409, reason: 'unavailable' }
  }
  // Damage a player changed goes only to a game that can roll it so, an answer to what the game
  // asked only to one that asks, and an area attack only to one that makes it at those picked.
  if (
    (changes(input.modifiers) &&
      !campaign.rollFeatures.includes('modifiers')) ||
    (input.prompt && !campaign.rollFeatures.includes('prompts')) ||
    (input.kind === 'attack' &&
      input.targets !== undefined &&
      !campaign.rollFeatures.includes('areaAttacks'))
  ) {
    return { status: 409, reason: 'unavailable' }
  }

  const now = Date.now()
  const damage = input.kind === 'damage' && input.use ? input.use : undefined
  // The combat a roll is made in: initiative's, or the one an attack's or a use's targets are in.
  const combatId =
    input.kind === 'initiative'
      ? input.combatId
      : (input.target?.combatId ?? input.targets?.[0]?.combatId)
  const prompt = input.prompt
  const [sheet, combats, use, others, inFlight, lastMinute, asked, answers] =
    await Promise.all([
      prisma.actorSheet.findUnique({
        where: { campaignActor: { campaignId, actorId } },
        select: { data: true },
      }),
      combatId
        ? prisma.combat.findMany({
            where: { campaignId, combatId },
            select: { data: true },
          })
        : [],
      damage
        ? prisma.rollRequest.findFirst({
            where: { id: damage, characterId: character.id },
            select: heldSelect,
          })
        : undefined,
      damage
        ? prisma.rollRequest.findMany({
            where: { useId: damage, characterId: character.id },
            select: { status: true, createdAt: true, claimedAt: true },
          })
        : [],
      prisma.rollRequest.count({
        where: {
          characterId: character.id,
          OR: [
            {
              status: 'pending',
              createdAt: { gt: ago(now, ROLL_PENDING_FOR) },
            },
            {
              status: 'claimed',
              claimedAt: { gt: ago(now, ROLL_ANSWER_WITHIN) },
            },
          ],
        },
      }),
      prisma.rollRequest.count({
        where: {
          characterId: character.id,
          createdAt: { gt: ago(now, 60_000) },
        },
      }),
      prompt
        ? prisma.rollPrompt.findUnique({
            where: { campaignPrompt: { campaignId, promptId: prompt } },
            select: {
              actorId: true,
              data: true,
              expiresAt: true,
              closedAt: true,
            },
          })
        : undefined,
      prompt
        ? prisma.rollRequest.findMany({
            where: {
              characterId: character.id,
              kind: 'save',
              payload: { path: ['prompt'], equals: prompt },
            },
            select: { status: true, createdAt: true, claimedAt: true },
          })
        : [],
    ])
  if (inFlight >= ROLLS_IN_FLIGHT || lastMinute >= ROLLS_PER_MINUTE) {
    return { status: 429, reason: 'busy' }
  }
  const refusal = damage
    ? checkDamage(input, use, others, now)
    : (checkRoll(
        input,
        sheet?.data as unknown as CharacterSheet | undefined,
        combats.map(({ data }) => data as unknown as CombatSnapshot),
        actorId,
      ) ??
      (prompt ? checkPrompt(input, asked, actorId, answers, now) : undefined))
  if (refusal) return { status: 422, reason: refusal }

  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: character.id,
      actorId,
      kind: input.kind,
      payload: input as unknown as Prisma.InputJsonValue,
      useId: damage,
      createdAt: new Date(now),
    },
    select: { id: true },
  })
  // Only the latest rolls are asked after; older ones go.
  await prisma.rollRequest.deleteMany({
    where: {
      characterId: character.id,
      createdAt: { lt: ago(now, ROLLS_KEPT_FOR) },
    },
  })
  return { id }
}

/**
 * A roll of a player's character, as its player is told of it.
 * @returns Undefined for a roll that isn't the character's.
 */
export async function getRollRequestView(
  characterId: string,
  requestId: string,
): Promise<RollRequestView | undefined> {
  const request = await prisma.rollRequest.findFirst({
    where: { id: requestId, characterId },
    select: heldSelect,
  })
  return request ? toRollRequestView(request as HeldRollRequest) : undefined
}

/**
 * Hand the module the rolls waiting for its game, oldest first, marking them fetched. Two fetches
 * at once, as from a Gamemaster's two tabs, never take the same roll: only rows still waiting are
 * marked, and each fetch returns only the rows it marked.
 * @param session - The module session that fetched them.
 */
export async function claimRollRequests(
  campaignId: string,
  session: string,
): Promise<RollCommand[]> {
  const now = Date.now()
  const waiting = await prisma.rollRequest.findMany({
    where: {
      campaignId,
      status: 'pending',
      createdAt: { gt: ago(now, ROLL_PENDING_FOR) },
    },
    orderBy: { createdAt: 'asc' },
    take: CLAIM_LIMIT,
    select: { id: true },
  })
  if (waiting.length === 0) return []
  const claimToken = randomUUID()
  const ids = waiting.map(({ id }) => id)
  await prisma.rollRequest.updateMany({
    where: { id: { in: ids }, status: 'pending' },
    data: {
      status: 'claimed',
      claimToken,
      claimSession: session,
      claimedAt: new Date(now),
    },
  })
  const claimed = await prisma.rollRequest.findMany({
    where: { id: { in: ids }, claimToken },
    orderBy: { createdAt: 'asc' },
    select: heldSelect,
  })
  return claimed.map(request => toCommand(request as HeldRollRequest))
}

/**
 * Record what became of a roll the module fetched. An answer for a roll already answered, or
 * another campaign's, changes nothing; one that comes after its player was told it was lost still
 * counts, as does one saying it was made after all, once the module had said it took too long. A
 * save that answered what the game asked, or found it no longer waits, closes it.
 */
export async function recordCommandResult(
  campaignId: string,
  result: CommandResult,
): Promise<void> {
  const made = result.status === 'done'
  const { count } = await prisma.rollRequest.updateMany({
    where: {
      id: result.id,
      campaignId,
      OR: [
        { status: 'claimed' },
        ...(made
          ? [
              {
                status: 'failed' as const,
                result: { path: ['reason'], equals: 'timeout' },
              },
            ]
          : []),
      ],
    },
    data: {
      status: result.status,
      result: result as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  })
  if (count === 0 || !(made || result.reason === 'prompt')) return
  const request = await prisma.rollRequest.findFirst({
    where: { id: result.id, campaignId },
    select: { payload: true },
  })
  const prompt = (request?.payload as RollRequestInput | null)?.prompt
  if (!prompt) return
  const reason = made ? 'answered' : (result.error ?? 'gone')
  // Its player's page is told only when that changes what it shows.
  if (await closePrompt(prisma, campaignId, prompt, reason)) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    })
  }
}

/**
 * Note that the module is fetching players' rolls, which also says its game is connected.
 * @returns Whether the campaign takes players' rolls, and whether any of its players have their
 * table open, so that a roll may be coming.
 */
export async function markBridgePolled(
  campaignId: string,
): Promise<{ rollsEnabled: boolean; playersPresent: boolean }> {
  const now = new Date()
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { bridgePolledAt: now, lastSeenAt: now },
    select: { rollsEnabled: true, playersSeenAt: true },
  })
  const seen = campaign.playersSeenAt?.getTime()
  return {
    rollsEnabled: campaign.rollsEnabled,
    playersPresent: !!seen && now.getTime() - seen < PLAYERS_PRESENT_FOR,
  }
}

/** When this server last noted each campaign's players present. */
const noted = new Map<string, number>()

/**
 * Note that one of a campaign's players has their table open, so the module's fetches are held
 * open for their rolls. Written at most once every half minute.
 */
export async function notePlayersSeen(campaignId: string): Promise<void> {
  const now = Date.now()
  if (now - (noted.get(campaignId) ?? 0) < PLAYERS_SEEN_EVERY) return
  noted.set(campaignId, now)
  await prisma.campaign.updateMany({
    where: {
      id: campaignId,
      OR: [
        // Prisma's filter for an unset field.
        // eslint-disable-next-line unicorn/no-null
        { playersSeenAt: null },
        { playersSeenAt: { lt: ago(now, PLAYERS_SEEN_EVERY) } },
      ],
    },
    data: { playersSeenAt: new Date(now) },
  })
}

/** The moment this many milliseconds before another. */
function ago(now: number, ms: number): Date {
  return new Date(now - ms)
}
