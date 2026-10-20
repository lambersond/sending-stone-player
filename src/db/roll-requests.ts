import { randomUUID } from 'node:crypto'
import prisma from '@/clients/prisma'
import {
  ASKS_PER_MINUTE,
  MOST_OPEN,
  OPEN_WITHIN,
  PLAYERS_PRESENT_FOR,
  PLAYERS_SEEN_EVERY,
  ROLL_ANSWER_WITHIN,
  ROLL_PENDING_FOR,
  ROLLS_IN_FLIGHT,
  ROLLS_KEPT_FOR,
  ROLLS_PER_MINUTE,
  TABLE_SEEN_EVERY,
} from '@/constants/sending-stone'
import { closePrompt } from '@/db/campaign-events'
import { createTransferRequest } from '@/db/transfers'
import { sheetLinks } from '@/lib/sheet-html'
import { changes } from '@/utils/damage-modifiers'
import { checkPrompt } from '@/utils/prompts'
import {
  availableRollKinds,
  checkDamage,
  checkRoll,
  GM_UNSENT,
  toCommand,
  toRollRequestView,
  type HeldRollRequest,
  type RollCommand,
  type RollRefusal,
} from '@/utils/roll-requests'
import type { SheetSeat } from '@/types/character'
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
  role: true,
  kind: true,
  payload: true,
  status: true,
  result: true,
  createdAt: true,
  claimedAt: true,
} as const

/**
 * The rolls a seat sent (#156): its player's, by their character; or the Gamemaster's as this
 * character in this campaign, by them. Never only `characterId: null`, which every Gamemaster's
 * roll has, of every campaign. The two seats' rolls are apart, so each has its own limits, and
 * damage follows only its own seat's attack or use.
 */
export function madeBy(seat: SheetSeat): Prisma.RollRequestWhereInput {
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
 * Why a roll wasn't taken, with the HTTP status that says so; for a move of items and coins, from
 * module 0.31.0, also that the seat has a move of the same on its way already (`moving`).
 */
export type RollRejection = {
  status: 409 | 422 | 429
  reason: RollRefusal | 'busy' | 'moving'
}

/**
 * Take a roll for a character to make in the Gamemaster's game, from its player or from the
 * campaign's Gamemaster as it (#156): if the game takes this kind of roll now, and the Gamemaster's
 * at all, the sheet allows it, and the seat isn't sending too many, nor asking the table too often.
 * One from a link in a description is checked against that description, as held here. A move of
 * items and coins, from module 0.31.0, is no roll, and has a switch of its own: it's checked by
 * `createTransferRequest` alone.
 * @param seat - Who is at the sheet, already checked to be the signed-in user's.
 * @returns The roll's id, or why it wasn't taken.
 */
export async function createRollRequest(
  seat: SheetSeat,
  input: RollRequestInput,
): Promise<{ id: string } | RollRejection> {
  if (input.kind === 'transfer') return createTransferRequest(seat, input)
  const { campaignId, actorId } = seat
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
  // The Gamemaster's rolls go only to a game that makes them as the character's, marked as theirs;
  // and ending an enchantment or a concentration is no roll, and posts nothing, so it would leave
  // no mark: the Gamemaster ends one in Foundry. Charges spent and Heroic Inspiration post a line
  // marked as theirs, so they're the Gamemaster's to send too.
  if (
    seat.role === 'gm' &&
    (!campaign?.rollFeatures.includes('gmRolls') || GM_UNSENT.has(input.kind))
  ) {
    return { status: 409, reason: 'unavailable' }
  }
  if (!campaign || !availableRollKinds(campaign).includes(input.kind)) {
    return { status: 409, reason: 'unavailable' }
  }
  // Damage a player changed goes only to a game that can roll it so, an answer to what the game
  // asked only to one that asks, an area attack only to one that makes it at those picked, and a
  // check an activity asks for only to one that makes it against the activity.
  if (
    (changes(input.modifiers) &&
      !campaign.rollFeatures.includes('modifiers')) ||
    (input.prompt && !campaign.rollFeatures.includes('prompts')) ||
    (input.kind === 'attack' &&
      input.targets !== undefined &&
      !campaign.rollFeatures.includes('areaAttacks')) ||
    (['skill', 'tool', 'ability'].includes(input.kind) &&
      input.item !== undefined &&
      !campaign.rollFeatures.includes('activityChecks'))
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
  const text = input.text
  const [
    sheet,
    combats,
    use,
    others,
    inFlight,
    lastMinute,
    asked,
    answers,
    described,
    asks,
  ] = await Promise.all([
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
          where: { id: damage, ...madeBy(seat) },
          select: heldSelect,
        })
      : undefined,
    damage
      ? prisma.rollRequest.findMany({
          where: { useId: damage, ...madeBy(seat) },
          select: { status: true, createdAt: true, claimedAt: true },
        })
      : [],
    prisma.rollRequest.count({
      where: {
        ...madeBy(seat),
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
        ...madeBy(seat),
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
    // Either seat's answer: the first, its player's or the Gamemaster's, answers it; a saving
    // throw, or what Midi-QOL asks may be, an ability or skill check.
    prompt
      ? prisma.rollRequest.findMany({
          where: {
            campaignId,
            actorId,
            kind: { in: ['save', 'ability', 'skill'] },
            payload: { path: ['prompt'], equals: prompt },
          },
          select: { status: true, createdAt: true, claimedAt: true },
        })
      : [],
    text
      ? prisma.sheetText.findUnique({
          where: { campaignHash: { campaignId, hash: text } },
          select: { html: true },
        })
      : undefined,
    // Asks the game made, or may yet make.
    input.kind === 'ask'
      ? prisma.rollRequest.count({
          where: {
            ...madeBy(seat),
            kind: 'ask',
            status: { in: ['pending', 'claimed', 'done'] },
            createdAt: { gt: ago(now, 60_000) },
          },
        })
      : 0,
  ])
  if (
    inFlight >= ROLLS_IN_FLIGHT ||
    lastMinute >= ROLLS_PER_MINUTE ||
    asks >= ASKS_PER_MINUTE
  ) {
    return { status: 429, reason: 'busy' }
  }
  const refusal = damage
    ? checkDamage(input, use, others, now)
    : (checkRoll(
        input,
        sheet?.data as unknown as CharacterSheet | undefined,
        combats.map(({ data }) => data as unknown as CombatSnapshot),
        actorId,
        described ? sheetLinks(described.html) : undefined,
        campaign.rollFeatures,
      ) ??
      (prompt ? checkPrompt(input, asked, actorId, answers, now) : undefined))
  if (refusal) return { status: 422, reason: refusal }

  // What it's called is the app's alone: the module is sent only what to roll. The Gamemaster's is
  // kept, for the character's player to be shown it by; a player's own page never asks for theirs.
  const { label, ...command } = input
  const { id } = await prisma.rollRequest.create({
    data: {
      campaignId,
      characterId: seat.characterId,
      role: seat.role,
      requestedById: seat.userId,
      actorId,
      kind: input.kind,
      ...(seat.role === 'gm' && label !== undefined && { label }),
      payload: command as unknown as Prisma.InputJsonValue,
      useId: damage,
      createdAt: new Date(now),
    },
    select: { id: true },
  })
  // Only the latest rolls are asked after; the seat's older ones go.
  await prisma.rollRequest.deleteMany({
    where: {
      ...madeBy(seat),
      createdAt: { lt: ago(now, ROLLS_KEPT_FOR) },
    },
  })
  return { id }
}

/**
 * A roll a seat sent, as it is told of it.
 * @returns Undefined for a roll that isn't the seat's: another character's, or the other seat's.
 */
export async function getRollRequestView(
  seat: SheetSeat,
  requestId: string,
): Promise<RollRequestView | undefined> {
  const request = await prisma.rollRequest.findFirst({
    where: { id: requestId, ...madeBy(seat) },
    select: heldSelect,
  })
  return request ? toRollRequestView(request as HeldRollRequest) : undefined
}

/**
 * Hand the module the rolls waiting for its game, oldest first, marking them fetched. Two fetches
 * at once, as from a Gamemaster's two tabs, never take the same roll: only rows still waiting are
 * marked, and each fetch returns only the rows it marked. The Gamemaster's rolls as a character
 * (#156) go only to the session whose hello said it makes them, `gmRolls`, and only those of the
 * campaign's owner: a module before 0.23.0 would make them unmarked, as the player's. Others stay
 * waiting, and run out. From module 0.31.0, a move of items or coins goes only to the session whose
 * hello said it takes them, the Gamemaster's as a player's.
 * @param session - The module session that fetched them.
 */
export async function claimRollRequests(
  campaignId: string,
  session: string,
): Promise<RollCommand[]> {
  const now = Date.now()
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      helloSession: true,
      rollFeatures: true,
      ownerId: true,
      transfersEnabled: true,
    },
  })
  const ownerId = campaign?.ownerId
  const current = campaign?.helloSession === session
  const gmRolls =
    !!ownerId && current && campaign.rollFeatures.includes('gmRolls')
  // Moves go only to the session whose hello said it takes them, and the Gamemaster's need no
  // `gmRolls`, which the module says only while rolls are on.
  const transfers = current && campaign?.transfersEnabled === true
  const notMove = { kind: { not: 'transfer' } }
  const waiting = await prisma.rollRequest.findMany({
    where: {
      campaignId,
      status: 'pending',
      createdAt: { gt: ago(now, ROLL_PENDING_FOR) },
      OR: [
        { role: 'player', ...(transfers ? {} : notMove) },
        ...(gmRolls
          ? [{ role: 'gm' as const, requestedById: ownerId, ...notMove }]
          : []),
        ...(transfers && ownerId
          ? [{ role: 'gm' as const, requestedById: ownerId, kind: 'transfer' }]
          : []),
      ],
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
 * counts, as does one saying it was made after all, once the module had said it took too long, or
 * of hit dice spent at once, that some of them were before it stopped. A save that answered what
 * the game asked, or found it no longer waits, closes it. The chat messages the Gamemaster's roll
 * as a character made (#156), which the module lists from 0.25.0, are marked as theirs: those
 * held already now, and any yet to come as they come.
 */
export async function recordCommandResult(
  campaignId: string,
  result: CommandResult,
): Promise<void> {
  const made = result.status === 'done'
  // Late, but made after all, or some of them.
  const late = made || (result.spent?.made ?? 0) > 0
  const { count } = await prisma.rollRequest.updateMany({
    where: {
      id: result.id,
      campaignId,
      OR: [
        { status: 'claimed' },
        ...(late
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
  const listed = result.messages ?? []
  const answers = made || result.reason === 'prompt'
  if (count === 0 || (!answers && listed.length === 0)) return
  const request = await prisma.rollRequest.findFirst({
    where: { id: result.id, campaignId },
    select: { payload: true, role: true },
  })
  // Only what the module said a roll handed over as the Gamemaster's made, never a player's.
  const marked =
    request?.role === 'gm' && listed.length > 0
      ? await prisma.chatMessage.updateMany({
          where: { campaignId, messageId: { in: listed }, byGm: false },
          data: { byGm: true },
        })
      : { count: 0 }
  const prompt = answers
    ? (request?.payload as RollRequestInput | null)?.prompt
    : undefined
  const reason = made ? 'answered' : (result.error ?? 'gone')
  const closed =
    !!prompt && (await closePrompt(prisma, campaignId, prompt, reason))
  // The campaign's pages are told only when that changes what they show.
  if (marked.count > 0 || closed) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    })
  }
}

/**
 * Note that the module is fetching players' rolls, which also says its game is connected.
 * @returns Whether the campaign takes players' rolls, and from module 0.31.0 their moves of items
 * and coins, and whether any of its players have their table open, so that one may be coming.
 */
export async function markBridgePolled(campaignId: string): Promise<{
  rollsEnabled: boolean
  transfersEnabled: boolean
  playersPresent: boolean
}> {
  const now = new Date()
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { bridgePolledAt: now, lastSeenAt: now },
    select: { rollsEnabled: true, transfersEnabled: true, playersSeenAt: true },
  })
  const seen = campaign.playersSeenAt?.getTime()
  return {
    rollsEnabled: campaign.rollsEnabled,
    transfersEnabled: campaign.transfersEnabled,
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

/** When this server last noted each character's table open. */
const tablesNoted = new Map<string, number>()

/**
 * Note that a player has their character's table open, so that the module waits for their answers
 * to what Midi-QOL asks of it (module 0.27.0). Written at most once every few seconds, in the
 * database, as the module's fetches that read it may be answered by another of this app's servers.
 * @param characterId - The player's character; never the Gamemaster's seat, which has none.
 */
export async function noteTableOpen(characterId: string): Promise<void> {
  const now = Date.now()
  if (now - (tablesNoted.get(characterId) ?? 0) < TABLE_SEEN_EVERY) return
  tablesNoted.set(characterId, now)
  await prisma.character.updateMany({
    where: {
      id: characterId,
      OR: [
        // Prisma's filter for an unset field.
        // eslint-disable-next-line unicorn/no-null
        { tableSeenAt: null },
        { tableSeenAt: { lt: ago(now, TABLE_SEEN_EVERY) } },
      ],
    },
    data: { tableSeenAt: new Date(now) },
  })
}

/** An actor's id as the module sends it, and reads it back. */
const ACTOR_ID = /^[A-Za-z0-9]{1,64}$/

/**
 * The campaign's characters open in the app now, by their actors' ids, sorted: those whose
 * player's page asked for their table lately. The module waits only for their answers.
 */
export async function openActorIds(campaignId: string): Promise<string[]> {
  const characters = await prisma.character.findMany({
    where: {
      campaignId,
      // eslint-disable-next-line unicorn/no-null -- Prisma's filter for a set field
      actorId: { not: null },
      tableSeenAt: { gt: ago(Date.now(), OPEN_WITHIN) },
    },
    orderBy: { actorId: 'asc' },
    take: MOST_OPEN,
    select: { actorId: true },
  })
  const ids = characters.flatMap(({ actorId }) =>
    actorId && ACTOR_ID.test(actorId) ? [actorId] : [],
  )
  return [...new Set(ids)]
}

/** The moment this many milliseconds before another. */
export function ago(now: number, ms: number): Date {
  return new Date(now - ms)
}
