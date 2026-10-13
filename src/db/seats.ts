import prisma from '@/clients/prisma'
import type { Character, SheetSeat } from '@/types/character'
import type { ConnectedCharacter } from '@/types/sending-stone'

// Who is at a character's sheet (#156). A player reaches their own character's sheet through
// their Character; a campaign's Gamemaster reaches any of the campaign's characters' sheets
// through the campaign they own, without claiming the character. Every route that reads a sheet,
// its descriptions, rolls, prompts or chat resolves a seat one of these two ways and scopes all it
// does by it, never by ids in a request's body.

/** An actor's id as the module sends it. */
const ACTOR_ID = /^[\dA-Za-z]{1,64}$/

/** A player at their own character's sheet. */
export function playerSeat(character: Character, userId: string): SheetSeat {
  return {
    name: character.name,
    gameUrl: character.gameUrl,
    campaignTitle: character.campaignTitle,
    campaignId: character.campaignId,
    actorId: character.actorId,
    chatReadAt: character.chatReadAt,
    role: 'player',
    userId,
    characterId: character.id,
  }
}

/**
 * The Gamemaster at one of their campaign's characters' sheets: only the campaign's owner, and
 * only for an actor in its roster, claimed or not.
 * @returns Undefined for anyone else, a campaign of another's, or an actor not in the roster.
 */
export async function getGmSeat(
  userId: string,
  campaignId: string,
  actorId: string,
): Promise<SheetSeat | undefined> {
  if (!userId || !ACTOR_ID.test(actorId)) return undefined
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, ownerId: userId },
    select: { id: true, title: true, origin: true, characters: true },
  })
  const roster = campaign?.characters as unknown as
    ConnectedCharacter[] | undefined
  const entry = Array.isArray(roster)
    ? roster.find(character => character?.id === actorId)
    : undefined
  if (!campaign || !entry) return undefined
  return {
    name: entry.name,
    gameUrl: campaign.origin,
    campaignTitle: campaign.title,
    campaignId: campaign.id,
    actorId,
    role: 'gm',
    userId,
    // The Gamemaster has no Character of the campaign's for this actor, and never reads its
    // player's place in the chat.
    // eslint-disable-next-line unicorn/no-null -- the seat has no character
    characterId: null,
  }
}
