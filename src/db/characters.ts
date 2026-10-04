import prisma from '@/clients/prisma'
import type { Character, CharacterInput } from '@/types/character'

// Every query is scoped to the user who owns the characters, so one user can never read or
// change another's by guessing an id.

const select = {
  id: true,
  name: true,
  gameUrl: true,
  campaignTitle: true,
} as const

export function listCharacters(userId: string): Promise<Character[]> {
  return prisma.character.findMany({
    where: { userId },
    select,
    orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
  })
}

export function getCharacter(
  userId: string,
  characterId: string,
): Promise<Character | null> {
  return prisma.character.findFirst({
    where: { id: characterId, userId },
    select,
  })
}

export function createCharacter(
  userId: string,
  input: CharacterInput,
): Promise<Character> {
  return prisma.character.create({ data: { ...input, userId }, select })
}

/** @returns Whether the user had a character with that id to change. */
export async function setCampaignTitle(
  userId: string,
  characterId: string,
  campaignTitle: string,
): Promise<boolean> {
  const { count } = await prisma.character.updateMany({
    where: { id: characterId, userId },
    data: { campaignTitle },
  })
  return count > 0
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
