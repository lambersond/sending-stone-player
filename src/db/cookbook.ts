/* eslint-disable unicorn/no-null -- Prisma and the protocol use null for an absent value */
import { randomUUID } from 'node:crypto'
import { Prisma, type CookbookDishStatus } from '@prisma/client'
import prisma from '@/clients/prisma'
import {
  DISH_ATTEMPTS,
  DISH_CLAIM_LIMIT,
  DISHES_KEPT_FOR,
  DISHES_PER_DAY,
  DISHES_PER_MINUTE,
  DISHES_PRUNE_EVERY,
  DISHES_SHOWN,
  MOST_DISHES_WAITING,
} from '@/constants/cookbook'
import { ROLL_ANSWER_WITHIN } from '@/constants/sending-stone'
import { isLive } from '@/db/campaigns'
import { generateCookbookCode, hashCookbookCode } from '@/lib/cookbook-code'
import type {
  CookbookDishBody,
  CookbookDishView,
  CookbookView,
  DishCommand,
} from '@/types/cookbook'
import type {
  CommandResult,
  DishApplied,
  DishDismissed,
} from '@/types/sending-stone'

// Dishes from the Magical Recipe Book, from module 0.38.0: a player's link code names their seat,
// and each dish the cookbook's server posts with it is kept here for its campaign. A dish rides to
// Foundry as a journal change does: handed over until a result answers it, only to the session
// whose hello this app holds, and it never expires on its way, as a roll would; its row goes only
// 30 days after its last change. What the Gamemaster made of it comes back as an event, which
// only the sender's card shows, so nothing here bumps the campaign's version.
//
// Every function is scoped by user, owner or campaign, never by ids from a body.

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/** A link as the cookbook's post is checked against it. */
export type CookbookLinkFound = {
  id: string
  campaignId: string
  actorId: string
  characterId: string
  /** Its seat now: the link holds only while these are still the link's. */
  character: { campaignId: string | null; actorId: string | null }
  campaign: { dishesEnabled: boolean; dishVersions: number[] }
}

/** The link a code's hash names, or null where none does. */
export async function findCookbookLink(
  codeHash: string,
): Promise<CookbookLinkFound | null> {
  return prisma.cookbookLink.findUnique({
    where: { codeHash },
    select: {
      id: true,
      campaignId: true,
      actorId: true,
      characterId: true,
      character: { select: { campaignId: true, actorId: true } },
      campaign: { select: { dishesEnabled: true, dishVersions: true } },
    },
  })
}

/** Delete a link whose seat has since moved to another actor or campaign. */
export async function deleteCookbookLink(id: string): Promise<void> {
  await prisma.cookbookLink.deleteMany({ where: { id } })
}

/** What became of a dish posted: taken, held already, or why not. */
export type DishAccepted =
  | { kind: 'new' | 'repeat'; id: string; status: CookbookDishStatus }
  | { kind: 'off' | 'update' | 'busy' | 'daily' | 'full' }

/**
 * Take a dish posted through a link. A dish the campaign holds already is answered as it stands,
 * before any gate, as the cookbook would otherwise make its player send it again for ever; the
 * first body is kept, whatever a repeat says, since a retry rolls its dice again. Then the
 * campaign must take dishes, of this version, and the link and the campaign be within their
 * limits.
 */
export async function acceptDish(
  link: CookbookLinkFound,
  body: CookbookDishBody,
): Promise<DishAccepted> {
  const held = await findDish(link.campaignId, body.dish.id)
  if (held) return { kind: 'repeat', ...held }
  if (!link.campaign.dishesEnabled) return { kind: 'off' }
  if (!link.campaign.dishVersions.includes(body.version)) {
    return { kind: 'update' }
  }
  const now = Date.now()
  const sentSince = (ms: number) =>
    prisma.cookbookDish.count({
      where: { linkId: link.id, createdAt: { gte: new Date(now - ms) } },
    })
  if ((await sentSince(MINUTE)) >= DISHES_PER_MINUTE) return { kind: 'busy' }
  // A day's limit too (round 0.38.0, the user's answer): a leaked code can't fill a
  // Gamemaster's chat while their Foundry is open and serving dishes.
  if ((await sentSince(DAY)) >= DISHES_PER_DAY) return { kind: 'daily' }
  const waiting = await prisma.cookbookDish.count({
    where: {
      campaignId: link.campaignId,
      status: { in: ['queued', 'claimed'] },
    },
  })
  if (waiting >= MOST_DISHES_WAITING) return { kind: 'full' }

  let made
  try {
    made = await prisma.cookbookDish.create({
      data: {
        campaignId: link.campaignId,
        characterId: link.characterId,
        linkId: link.id,
        actorId: link.actorId,
        dishId: body.dish.id,
        version: body.version,
        recipe: body.dish.recipe,
        outcome: body.dish.outcome,
        payload: body as unknown as Prisma.InputJsonValue,
        queuedAt: new Date(now),
        createdAt: new Date(now),
      },
      select: { id: true, status: true },
    })
  } catch (error) {
    // Two first posts of one dish at once: the other was taken, so this one is a repeat of it.
    if (!isTaken(error)) throw error
    const raced = await findDish(link.campaignId, body.dish.id)
    if (!raced) throw error
    return { kind: 'repeat', ...raced }
  }
  await prisma.cookbookLink.updateMany({
    where: { id: link.id },
    data: { lastUsedAt: new Date(now) },
  })
  await pruneDishes(link.campaignId, now)
  return { kind: 'new', ...made }
}

const findDish = (campaignId: string, dishId: string) =>
  prisma.cookbookDish.findUnique({
    where: { campaignDish: { campaignId, dishId } },
    select: { id: true, status: true },
  })

/** A campaign's dishes past their keeping, whatever became of them. */
const pruneDishes = (campaignId: string, now: number) =>
  prisma.cookbookDish.deleteMany({
    where: { campaignId, updatedAt: { lt: new Date(now - DISHES_KEPT_FOR) } },
  })

const isTaken = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002'

/** Why no link code was made. */
export type CookbookLinkProblem = 'missing' | 'not-playing'

/**
 * Make a link code for one of the user's characters, while it plays a character of a campaign:
 * a new one replaces the old, which stops working at once, and the link keeps its id. Only its
 * player makes one; its Gamemaster can only revoke it.
 * @returns The code, shown to its player once and never kept; or why none was made.
 */
export async function makeCookbookLink(
  userId: string,
  characterId: string,
): Promise<{ code: string } | CookbookLinkProblem> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select: { campaignId: true, actorId: true },
  })
  if (!character?.campaignId) return 'missing'
  if (!character.actorId) return 'not-playing'
  const code = generateCookbookCode()
  const link = {
    codeHash: hashCookbookCode(code),
    hint: code.slice(-4),
    campaignId: character.campaignId,
    actorId: character.actorId,
    createdAt: new Date(),
    lastUsedAt: null,
  }
  await prisma.cookbookLink.upsert({
    where: { characterId },
    create: { characterId, ...link },
    update: link,
  })
  return { code }
}

/** Revoke the link of one of the user's characters. */
export async function revokeCookbookLink(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const { count } = await prisma.cookbookLink.deleteMany({
    where: { characterId, character: { userId } },
  })
  return count > 0
}

/** Revoke a link to one of the Gamemaster's campaigns, as removing a player is scoped. */
export async function revokeCampaignCookbookLink(
  ownerId: string,
  campaignId: string,
  characterId: string,
): Promise<boolean> {
  const { count } = await prisma.cookbookLink.deleteMany({
    where: { characterId, campaignId, campaign: { ownerId } },
  })
  return count > 0
}

/** When this server last pruned each campaign's dishes as the module fetched them. */
const pruned = new Map<string, number>()

/**
 * Hand a campaign's dishes to the module, at most a few at a time, oldest first: those waiting,
 * and those handed over whose answer is overdue, of a version its hello reads. Only to the
 * session whose hello is held, as notes are, and only while the campaign takes dishes, both read
 * again on every pass, so a newer hello's session takes over at once. A dish handed over too many
 * times unanswered fails for good. While nothing waits, a pass is two reads and no write, as a
 * held fetch claims about once a second.
 * @param session - The module session that fetched them.
 */
export async function claimDishes(
  campaignId: string,
  session: string,
): Promise<DishCommand[]> {
  const now = Date.now()
  if (now - (pruned.get(campaignId) ?? 0) >= DISHES_PRUNE_EVERY) {
    pruned.set(campaignId, now)
    await pruneDishes(campaignId, now)
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { helloSession: true, dishesEnabled: true, dishVersions: true },
  })
  if (
    !campaign ||
    campaign.helloSession !== session ||
    !campaign.dishesEnabled
  ) {
    return []
  }
  const due: Prisma.CookbookDishWhereInput = {
    campaignId,
    version: { in: campaign.dishVersions },
    OR: [
      { status: 'queued' },
      {
        status: 'claimed',
        claimedAt: { lt: new Date(now - ROLL_ANSWER_WITHIN) },
      },
    ],
  }
  const found = await prisma.cookbookDish.findMany({
    where: due,
    orderBy: { queuedAt: 'asc' },
    take: DISH_CLAIM_LIMIT,
    select: { id: true, attempts: true },
  })
  if (found.length === 0) return []
  const spent = found.filter(({ attempts }) => attempts >= DISH_ATTEMPTS)
  if (spent.length > 0) {
    await prisma.cookbookDish.updateMany({
      where: { id: { in: spent.map(({ id }) => id) }, AND: [due] },
      data: { status: 'failed', reason: 'undeliverable' },
    })
  }
  const handing = found.filter(({ attempts }) => attempts < DISH_ATTEMPTS)
  if (handing.length === 0) return []
  const claimToken = randomUUID()
  await prisma.cookbookDish.updateMany({
    where: { id: { in: handing.map(({ id }) => id) }, AND: [due] },
    data: {
      status: 'claimed',
      claimToken,
      claimSession: session,
      claimedAt: new Date(now),
      attempts: { increment: 1 },
    },
  })
  const claimed = await prisma.cookbookDish.findMany({
    where: { claimToken },
    orderBy: { queuedAt: 'asc' },
    select: { id: true, actorId: true, queuedAt: true, payload: true },
  })
  return claimed.map(dish => ({
    id: `dish-${dish.id}`,
    actorId: dish.actorId,
    kind: 'dish',
    dish: {
      queuedAt: dish.queuedAt.getTime(),
      body: dish.payload as unknown as CookbookDishBody,
    },
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
  }))
}

/** The claim a dish gives up once the module has answered it. */
const UNCLAIMED = { claimToken: null, claimSession: null, claimedAt: null }

/**
 * Record what the module made of a dish it fetched: its card posted, or why not. A card posted
 * lifts even a dish failed meanwhile, as it proves the card is in Foundry and the module never
 * posts a second; a failure counts only for a dish handed over and unanswered, so a late one from
 * an earlier hand-over changes nothing. A module that didn't try it ("off") gives its attempt
 * back and keeps the claim, to be handed over again once overdue; one whose runner threw puts it
 * back in the queue; a timeout changes nothing, as it's handed over again once overdue.
 */
export async function recordDishResult(
  campaignId: string,
  result: CommandResult,
): Promise<void> {
  const id = result.id.slice('dish-'.length)
  if (result.status === 'done') {
    const state = result.dish?.state ?? 'waiting'
    await prisma.cookbookDish.updateMany({
      where: {
        id,
        campaignId,
        status: { in: ['queued', 'claimed', 'failed'] },
      },
      data: {
        status: state === 'waiting' ? 'delivered' : state,
        messageId: result.dish?.card ?? result.messageId,
        reason: null,
        error: null,
        ...UNCLAIMED,
      },
    })
    return
  }
  const claimed = { id, campaignId, status: 'claimed' as const }
  switch (result.reason) {
    case 'timeout': {
      return
    }
    case 'off': {
      await prisma.cookbookDish.updateMany({
        where: claimed,
        data: { attempts: { decrement: 1 } },
      })
      return
    }
    case 'error': {
      await prisma.cookbookDish.updateMany({
        where: claimed,
        data: { status: 'queued', ...UNCLAIMED },
      })
      return
    }
    default: {
      await prisma.cookbookDish.updateMany({
        where: claimed,
        data: { status: 'failed', reason: result.reason, error: result.error },
      })
    }
  }
}

/** A Gamemaster's choice of what became of a dish, as the module's bridge tells of it. */
export type DishDecision =
  | { type: 'dish.applied'; data: DishApplied }
  | { type: 'dish.dismissed'; data: DishDismissed }

/**
 * Record what the Gamemaster did with a dish in Foundry. Served, it names everyone served so far,
 * so each overwrites the last; set aside or deleted never undoes one served, and nothing goes
 * back. An event for a dish no longer held, pruned or gone with its campaign, changes nothing.
 */
export async function recordDishDecision(
  campaignId: string,
  { type, data }: DishDecision,
): Promise<void> {
  const at = Date.parse(data.at?.time ?? '')
  const decidedAt = Number.isNaN(at) ? new Date() : new Date(at)
  if (type === 'dish.applied') {
    await prisma.cookbookDish.updateMany({
      where: { id: data.dish, campaignId },
      data: {
        status: 'applied',
        appliedTo: data.characters as unknown as Prisma.InputJsonValue,
        rolled: data.rolled as unknown as Prisma.InputJsonValue,
        decidedAt,
        ...(data.card && { messageId: data.card }),
      },
    })
    return
  }
  await prisma.cookbookDish.updateMany({
    where: {
      id: data.dish,
      campaignId,
      status: { in: ['queued', 'claimed', 'delivered', 'failed'] },
    },
    data: { status: 'dismissed', reason: data.reason, decidedAt },
  })
}

/** A player's character playing in a campaign, whose card is drawn. */
export type CookbookSeat = { id: string; campaignId: string; actorId: string }

/**
 * A player's Magical Recipe Book card, but its version: whether the campaign takes dishes, whether
 * its game is sending, the character's link, and its latest dishes, newest first. A link made for
 * the seat's earlier actor or campaign shows as none, so a stale row never shows as linked.
 * @returns Nothing where the campaign is gone.
 */
export async function getCookbookView(
  character: CookbookSeat,
): Promise<Omit<CookbookView, 'version'> | undefined> {
  const [campaign, link, dishes] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: character.campaignId },
      select: { dishesEnabled: true, lastSeenAt: true },
    }),
    prisma.cookbookLink.findUnique({
      where: { characterId: character.id },
      select: {
        hint: true,
        campaignId: true,
        actorId: true,
        createdAt: true,
        lastUsedAt: true,
      },
    }),
    prisma.cookbookDish.findMany({
      where: { characterId: character.id },
      orderBy: { createdAt: 'desc' },
      take: DISHES_SHOWN,
      select: {
        id: true,
        recipe: true,
        outcome: true,
        status: true,
        reason: true,
        appliedTo: true,
        rolled: true,
        queuedAt: true,
        decidedAt: true,
      },
    }),
  ])
  if (!campaign) return undefined
  const linked =
    !!link &&
    link.campaignId === character.campaignId &&
    link.actorId === character.actorId
  return {
    enabled: campaign.dishesEnabled,
    live: isLive(campaign.lastSeenAt),
    link: linked
      ? {
          hint: link.hint,
          createdAt: link.createdAt.toISOString(),
          lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
        }
      : null,
    dishes: dishes.map(dish => ({
      id: dish.id,
      recipe: dish.recipe,
      outcome: dish.outcome as CookbookDishView['outcome'],
      state: dish.status,
      reason: dish.reason,
      eatenBy: eatersOf(dish.appliedTo),
      rolled: rolledOf(dish.rolled),
      queuedAt: dish.queuedAt.toISOString(),
      decidedAt: dish.decidedAt?.toISOString() ?? null,
    })),
  }
}

/** The names of those served a dish, in the module's order: none until it's heard of. */
function eatersOf(appliedTo: Prisma.JsonValue): string[] {
  if (!Array.isArray(appliedTo)) return []
  return appliedTo.flatMap(entry => {
    const name = (entry as { name?: unknown } | null)?.name
    return typeof name === 'string' ? [name] : []
  })
}

/** What a dish's dice came to, rolled once in the cookbook, as the module tells of it. */
function rolledOf(rolled: Prisma.JsonValue): CookbookDishView['rolled'] {
  return Array.isArray(rolled)
    ? (rolled as unknown as CookbookDishView['rolled'])
    : []
}
