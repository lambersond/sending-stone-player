import prisma from '@/clients/prisma'
import { BRIDGE_TIMEOUT } from '@/constants/sending-stone'
import {
  generateInviteCode,
  hashSecret,
  verifySecret,
} from '@/lib/campaign-secret'
import { literalPattern } from '@/utils/literal-pattern'
import { availableRollKinds } from '@/utils/roll-requests'
import type {
  CampaignChoice,
  CampaignSetupInput,
  OwnedCampaign,
} from '@/types/campaign'
import type { CampaignRef, ConnectedCharacter } from '@/types/sending-stone'

/** Is a Gamemaster's game sending, judging by when its campaign last heard anything? */
export function isLive(lastSeenAt: Date | null | undefined, now = Date.now()) {
  return !!lastSeenAt && now - lastSeenAt.getTime() < BRIDGE_TIMEOUT
}

const rosterOf = (characters: unknown) =>
  characters as unknown as ConnectedCharacter[]

/* -------------------------------------------- */
/*  Gamemasters                                 */
/* -------------------------------------------- */

// Every query is scoped to the campaign's owner, so one Gamemaster can never read or change
// another's campaign by guessing an id.

export async function listOwnedCampaigns(
  userId: string,
): Promise<OwnedCampaign[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { ownerId: userId },
    orderBy: [{ title: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      origin: true,
      worldTitle: true,
      inviteCode: true,
      foundryId: true,
      lastSeenAt: true,
      helloSession: true,
      characters: true,
      rollsEnabled: true,
      rollKinds: true,
      rollFeatures: true,
      bridgePolledAt: true,
      players: {
        select: { id: true, actorId: true, user: { select: { name: true } } },
      },
    },
  })
  return campaigns.map(campaign => {
    const players = new Map(
      campaign.players.map(player => [player.actorId, player]),
    )
    return {
      id: campaign.id,
      title: campaign.title,
      gameUrl: campaign.origin,
      worldTitle: campaign.worldTitle ?? undefined,
      inviteCode: campaign.inviteCode ?? '',
      connected: campaign.foundryId !== null,
      rosterReceived: campaign.helloSession !== null,
      live: isLive(campaign.lastSeenAt),
      lastSeenAt: campaign.lastSeenAt?.toISOString(),
      rolls: {
        enabled: campaign.rollsEnabled,
        reaching: availableRollKinds(campaign).length > 0,
        attacks: campaign.rollKinds.includes('attack'),
        spells: campaign.rollKinds.includes('use'),
        prompts: campaign.rollFeatures.includes('prompts'),
      },
      characters: rosterOf(campaign.characters).map(({ id, name }) => {
        const player = players.get(id)
        return { id, name, player: player?.user.name, characterId: player?.id }
      }),
    }
  })
}

/**
 * Set up a campaign for its Gamemaster. Its secret is kept only as a hash.
 * @returns The new campaign, or 'duplicate' if they already set up one with that title in
 *   that game.
 */
export async function setUpCampaign(
  userId: string,
  { title, gameUrl, secret }: CampaignSetupInput,
): Promise<{ id: string } | 'duplicate'> {
  const existing = await prisma.campaign.findFirst({
    where: {
      ownerId: userId,
      origin: gameUrl,
      title: { equals: literalPattern(title), mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (existing) return 'duplicate'
  return prisma.campaign.create({
    data: {
      origin: gameUrl,
      title,
      ownerId: userId,
      secretHash: await hashSecret(secret),
      inviteCode: generateInviteCode(),
    },
    select: { id: true },
  })
}

/** @returns Whether the Gamemaster had a campaign with that id to change. */
export async function changeCampaignSecret(
  userId: string,
  campaignId: string,
  secret: string,
): Promise<boolean> {
  const { count } = await prisma.campaign.updateMany({
    where: { id: campaignId, ownerId: userId },
    data: { secretHash: await hashSecret(secret) },
  })
  return count > 0
}

/** Retire a campaign's invite link for a new one. Players who already joined are unaffected. */
export async function resetInviteCode(
  userId: string,
  campaignId: string,
): Promise<boolean> {
  const { count } = await prisma.campaign.updateMany({
    where: { id: campaignId, ownerId: userId },
    data: { inviteCode: generateInviteCode() },
  })
  return count > 0
}

/**
 * Remove a player's character from one of the Gamemaster's campaigns, so that another player can
 * choose it.
 * @returns Whether the Gamemaster had such a player's character to remove.
 */
export async function removePlayer(
  userId: string,
  campaignId: string,
  characterId: string,
): Promise<boolean> {
  const { count } = await prisma.character.deleteMany({
    where: {
      id: characterId,
      campaignId,
      campaign: { is: { ownerId: userId } },
    },
  })
  return count > 0
}

/** Remove a campaign with its chat and combats. Its players' characters stay, without it. */
export async function removeCampaign(
  userId: string,
  campaignId: string,
): Promise<boolean> {
  const { count } = await prisma.campaign.deleteMany({
    where: { id: campaignId, ownerId: userId },
  })
  return count > 0
}

/* -------------------------------------------- */
/*  The module                                  */
/* -------------------------------------------- */

/** The campaign an event is for, with the module session whose state it holds, if any. */
export type EventCampaign =
  { id: string; helloSession?: string } | 'unknown' | 'refused'

/**
 * Find the campaign an event is for, and check that the secret it came with is that campaign's.
 * The module's campaign is bound by its first event to the campaign set up here with its title
 * in its game; from then on its id finds it, whatever it is renamed.
 * @param origin - The game's origin, from the request's Origin header.
 * @param campaign - The module's campaign, as the envelope names it.
 * @param secret - The secret the request carried.
 * @returns The campaign; 'unknown' when none is set up for it; 'refused' for the wrong secret.
 */
export async function findEventCampaign(
  origin: string,
  campaign: CampaignRef,
  secret: string,
): Promise<EventCampaign> {
  const bound = await prisma.campaign.findUnique({
    where: { originCampaign: { origin, foundryId: campaign.id } },
    select: { id: true, secretHash: true, helloSession: true },
  })
  if (bound?.secretHash) {
    return (await verifySecret(secret, bound.secretHash))
      ? { id: bound.id, helloSession: bound.helloSession ?? undefined }
      : 'refused'
  }

  const candidates = await prisma.campaign.findMany({
    where: {
      origin,
      // Prisma's filters for an unset field.
      // eslint-disable-next-line unicorn/no-null
      foundryId: null,
      // eslint-disable-next-line unicorn/no-null
      secretHash: { not: null },
      title: { equals: literalPattern(campaign.title), mode: 'insensitive' },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, secretHash: true },
  })
  if (candidates.length === 0) return 'unknown'
  for (const candidate of candidates) {
    if (await verifySecret(secret, candidate.secretHash ?? '')) {
      // Bound only now, so it holds no state from the module's session.
      return { id: await bind(candidate.id, campaign.id, bound?.id) }
    }
  }
  return 'refused'
}

/**
 * Bind a campaign set up here to the module's campaign. If that campaign was already followed
 * before Gamemasters set campaigns up, the set-up moves to it, keeping its chat, combats and
 * players.
 * @returns The bound campaign's id.
 */
async function bind(
  campaignId: string,
  foundryId: string,
  earlierId: string | undefined,
): Promise<string> {
  if (!earlierId) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { foundryId },
    })
    return campaignId
  }
  return prisma.$transaction(async tx => {
    // Nothing has been sent to it yet, so the set-up is all it holds.
    const setUp = await tx.campaign.delete({
      where: { id: campaignId },
      select: {
        title: true,
        ownerId: true,
        secretHash: true,
        inviteCode: true,
      },
    })
    await tx.campaign.update({ where: { id: earlierId }, data: setUp })
    return earlierId
  })
}

/**
 * Does a secret belong to any campaign set up for a game? For a connection test, which names no
 * campaign.
 */
export async function checkGameSecret(
  origin: string,
  secret: string,
): Promise<'ok' | 'unknown' | 'refused'> {
  const campaigns = await prisma.campaign.findMany({
    // eslint-disable-next-line unicorn/no-null -- Prisma's filter for a set field
    where: { origin, secretHash: { not: null } },
    select: { secretHash: true },
  })
  if (campaigns.length === 0) return 'unknown'
  for (const { secretHash } of campaigns) {
    if (await verifySecret(secret, secretHash ?? '')) return 'ok'
  }
  return 'refused'
}

/** Note that a campaign's Gamemaster is connected, without anything having changed. */
export async function markSeen(campaignId: string): Promise<void> {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { lastSeenAt: new Date() },
  })
}

/* -------------------------------------------- */
/*  Players                                     */
/* -------------------------------------------- */

const choiceSelect = {
  id: true,
  title: true,
  worldTitle: true,
  origin: true,
  characters: true,
  owner: { select: { name: true } },
  players: { select: { id: true, actorId: true, userId: true } },
} as const

/**
 * A campaign's characters, as offered to a player choosing one.
 * @param userId - The player.
 * @param exceptCharacterId - A character of theirs choosing again, whose own choice is not a claim.
 */
function toChoice(
  campaign: {
    id: string
    title: string
    worldTitle: string | null
    origin: string
    characters: unknown
    owner: { name: string } | null
    players: { id: string; actorId: string | null; userId: string }[]
  },
  userId: string,
  exceptCharacterId?: string,
): CampaignChoice {
  const claims = new Map(
    campaign.players
      .filter(({ id, actorId }) => actorId && id !== exceptCharacterId)
      .map(player => [player.actorId, player]),
  )
  return {
    id: campaign.id,
    title: campaign.title,
    worldTitle: campaign.worldTitle ?? undefined,
    gameUrl: campaign.origin,
    gamemaster: campaign.owner?.name,
    characters: rosterOf(campaign.characters).map(({ id, name }) => {
      const claim = claims.get(id)
      if (!claim) return { id, name }
      return claim.userId === userId
        ? { id, name, claimedBy: 'you', characterId: claim.id }
        : { id, name, claimedBy: 'someone' }
    }),
  }
}

/** The campaign an invite link is for, or undefined if the link is not (or no longer) valid. */
export async function findInvite(
  inviteCode: string,
  userId: string,
): Promise<CampaignChoice | undefined> {
  if (!inviteCode) return undefined
  const campaign = await prisma.campaign.findUnique({
    where: { inviteCode },
    select: choiceSelect,
  })
  return campaign ? toChoice(campaign, userId) : undefined
}

/** A campaign's characters, for one of a player's characters in it choosing again. */
export async function getCampaignChoice(
  campaignId: string,
  userId: string,
  characterId: string,
): Promise<CampaignChoice | undefined> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: choiceSelect,
  })
  return campaign ? toChoice(campaign, userId, characterId) : undefined
}
