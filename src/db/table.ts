import prisma from '@/clients/prisma'
import {
  findActorId,
  pickCombat,
  toTableCombat,
  toTableMessage,
  type Viewer,
} from '@/utils/table-view'
import type { Character } from '@/types/character'
import type {
  CombatSnapshot,
  ConnectedCharacter,
  SerializedMessage,
} from '@/types/sending-stone'
import type { TableView } from '@/types/table'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/**
 * The version of what is held for a game, to tell cheaply whether a viewer is up to date.
 * @returns The version, or 0 when the game has sent nothing yet.
 */
export async function getGameVersion(origin: string): Promise<number> {
  const game = await prisma.game.findUnique({
    where: { origin },
    select: { version: true },
  })
  return game?.version ?? 0
}

/**
 * A character's view of its game: the chat its player may read and the encounter under way.
 * The caller must already have checked that the character belongs to the signed-in user.
 */
export async function getTableView(character: Character): Promise<TableView> {
  const game = await prisma.game.findUnique({
    where: { origin: character.gameUrl },
    select: {
      id: true,
      version: true,
      worldTitle: true,
      lastEventAt: true,
      characters: true,
    },
  })
  if (!game) {
    return { version: 0, connected: false, messages: [] }
  }

  const roster = game.characters as unknown as ConnectedCharacter[]
  const viewer: Viewer = {
    actorId: findActorId(roster, character.name),
    party: new Set(roster.map(({ id }) => id)),
  }

  const [messages, combats] = await Promise.all([
    prisma.chatMessage.findMany({
      where: {
        gameId: game.id,
        // Whispers reach only the players they were meant for.
        OR: [
          { public: true },
          ...(viewer.actorId ? [{ readers: { has: viewer.actorId } }] : []),
        ],
      },
      orderBy: { sentAt: 'desc' },
      take: MESSAGE_LIMIT,
      select: { data: true },
    }),
    prisma.combat.findMany({
      where: { gameId: game.id },
      orderBy: { updatedAt: 'desc' },
      select: { data: true },
    }),
  ])

  const combat = pickCombat(
    combats.map(({ data }) => data as unknown as CombatSnapshot),
  )
  return {
    version: game.version,
    game: {
      worldTitle: game.worldTitle ?? undefined,
      lastEventAt: game.lastEventAt?.toISOString(),
    },
    connected: viewer.actorId !== undefined,
    messages: messages
      .toReversed()
      .map(({ data }) =>
        toTableMessage(data as unknown as SerializedMessage, viewer),
      ),
    combat: combat ? toTableCombat(combat, viewer) : undefined,
  }
}
