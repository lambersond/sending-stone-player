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
import type { Prisma } from '@prisma/client'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/**
 * Escape the wildcards in a value compared case-insensitively: Prisma compares with ILIKE on
 * Postgres, where `%` and `_` would otherwise match any title.
 */
const literal = (value: string) => value.replaceAll(/[\\%_]/g, String.raw`\$&`)

/**
 * Find a character's campaign: the one in its game with the title it was given, ignoring case.
 * Titles differ within a world, but a game can switch worlds, so the most recently active wins.
 */
function findCampaign<Select extends Prisma.CampaignSelect>(
  character: Character,
  select: Select,
) {
  const title = character.campaignTitle.trim()
  if (!title) return Promise.resolve(undefined)
  return prisma.campaign.findFirst({
    where: {
      origin: character.gameUrl,
      title: { equals: literal(title), mode: 'insensitive' },
    },
    orderBy: { lastEventAt: { sort: 'desc', nulls: 'last' } },
    select,
  })
}

/**
 * The version of what is held for a character's campaign, to tell cheaply whether a viewer is up
 * to date.
 * @returns The version, or 0 when the campaign has sent nothing yet.
 */
export async function getCampaignVersion(
  character: Character,
): Promise<number> {
  const campaign = await findCampaign(character, { version: true })
  return campaign?.version ?? 0
}

/**
 * A character's view of its campaign: the chat its player may read and the encounter under way.
 * The caller must already have checked that the character belongs to the signed-in user.
 */
export async function getTableView(character: Character): Promise<TableView> {
  const campaign = await findCampaign(character, {
    id: true,
    title: true,
    version: true,
    worldTitle: true,
    lastEventAt: true,
    characters: true,
  })
  if (!campaign) {
    return { version: 0, connected: false, messages: [] }
  }

  const roster = campaign.characters as unknown as ConnectedCharacter[]
  const viewer: Viewer = {
    actorId: findActorId(roster, character.name),
    party: new Set(roster.map(({ id }) => id)),
  }

  const [messages, combats] = await Promise.all([
    prisma.chatMessage.findMany({
      where: {
        campaignId: campaign.id,
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
      where: { campaignId: campaign.id },
      orderBy: { updatedAt: 'desc' },
      select: { data: true },
    }),
  ])

  const combat = pickCombat(
    combats.map(({ data }) => data as unknown as CombatSnapshot),
  )
  return {
    version: campaign.version,
    campaign: {
      title: campaign.title,
      worldTitle: campaign.worldTitle,
      lastEventAt: campaign.lastEventAt?.toISOString(),
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
