import { Prisma } from '@prisma/client'
import prisma from '@/clients/prisma'
import type { Character } from '@/types/character'
import type { ConnectedCharacter } from '@/types/sending-stone'

// Every query is scoped to the user who owns the characters, so one user can never read or
// change another's by guessing an id.

const select = {
  id: true,
  name: true,
  gameUrl: true,
  campaignTitle: true,
  campaignId: true,
  actorId: true,
  campaign: { select: { title: true, origin: true } },
} as const

type Row = Prisma.CharacterGetPayload<{ select: typeof select }>

/** A character as the app uses it, with its campaign's current title and game. */
function toCharacter({ campaign, ...character }: Row): Character {
  return {
    ...character,
    gameUrl: campaign?.origin ?? character.gameUrl,
    campaignTitle: campaign?.title ?? character.campaignTitle,
  }
}

export async function listCharacters(userId: string): Promise<Character[]> {
  const rows = await prisma.character.findMany({
    where: { userId },
    select,
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(row => toCharacter(row))
}

export async function getCharacter(
  userId: string,
  characterId: string,
): Promise<Character | undefined> {
  const row = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select,
  })
  return row ? toCharacter(row) : undefined
}

/** Why a character could not be chosen. */
export type ChoiceProblem = 'invalid-invite' | 'unknown-character' | 'taken'

/**
 * Join the campaign an invite link is for, as one of its characters.
 * @returns The new character, or why it could not be made.
 */
export async function joinCampaign(
  userId: string,
  inviteCode: string,
  actorId: string,
): Promise<{ id: string } | ChoiceProblem> {
  const campaign = inviteCode
    ? await prisma.campaign.findUnique({
        where: { inviteCode },
        select: { id: true, title: true, origin: true, characters: true },
      })
    : undefined
  if (!campaign) return 'invalid-invite'
  const actor = findActor(campaign.characters, actorId)
  if (!actor) return 'unknown-character'

  try {
    return await prisma.character.create({
      data: {
        name: actor.name,
        gameUrl: campaign.origin,
        campaignTitle: campaign.title,
        campaignId: campaign.id,
        actorId,
        userId,
      },
      select: { id: true },
    })
  } catch (error) {
    if (isTaken(error)) return 'taken'
    throw error
  }
}

/**
 * Choose which of its campaign's characters one of the user's characters is: for one made before
 * players chose, or whose actor could not be matched.
 * @returns True once chosen, 'missing' if the user has no such character in a campaign, or why
 *   the actor could not be chosen.
 */
export async function chooseCharacter(
  userId: string,
  characterId: string,
  actorId: string,
): Promise<true | 'missing' | Exclude<ChoiceProblem, 'invalid-invite'>> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, userId },
    select: { campaign: { select: { characters: true } } },
  })
  if (!character?.campaign) return 'missing'
  const actor = findActor(character.campaign.characters, actorId)
  if (!actor) return 'unknown-character'

  try {
    await prisma.character.update({
      where: { id: characterId },
      data: { actorId, name: actor.name },
    })
    return true
  } catch (error) {
    if (isTaken(error)) return 'taken'
    throw error
  }
}

/** @returns Whether the user had a character with that id to delete. */
export async function deleteCharacter(
  userId: string,
  characterId: string,
): Promise<boolean> {
  const { count } = await prisma.character.deleteMany({
    where: { id: characterId, userId },
  })
  return count > 0
}

const findActor = (characters: unknown, actorId: string) =>
  (characters as ConnectedCharacter[]).find(({ id }) => id === actorId)

/** Another player chose that character first: each is one player's. */
const isTaken = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002'
