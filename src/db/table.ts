import prisma from '@/clients/prisma'
import { isLive } from '@/db/campaigns'
import {
  pickCombat,
  toTableCombat,
  toTableMessages,
  toTableSheet,
  type Viewer,
} from '@/utils/table-view'
import type { Character } from '@/types/character'
import type {
  CharacterSheet,
  CombatSnapshot,
  ConnectedCharacter,
  SerializedMessage,
} from '@/types/sending-stone'
import type { TableView } from '@/types/table'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/** What tells a viewer whether anything is new: the campaign's version, and whether it is live. */
export type CampaignStatus = { version: number; live: boolean }

/**
 * The status of a character's campaign, to tell cheaply whether a viewer is up to date.
 * @returns Version 0, not live, while the character is in no campaign.
 */
export async function getCampaignStatus(
  character: Character,
): Promise<CampaignStatus> {
  if (!character.campaignId) return { version: 0, live: false }
  const campaign = await prisma.campaign.findUnique({
    where: { id: character.campaignId },
    select: { version: true, lastSeenAt: true },
  })
  return {
    version: campaign?.version ?? 0,
    live: isLive(campaign?.lastSeenAt),
  }
}

/**
 * A character's view of its campaign: the chat its player may read, the encounter under way, and
 * its own sheet. The caller must already have checked that the character belongs to the signed-in
 * user.
 */
export async function getTableView(character: Character): Promise<TableView> {
  const campaign = character.campaignId
    ? await prisma.campaign.findUnique({
        where: { id: character.campaignId },
        select: {
          id: true,
          origin: true,
          title: true,
          version: true,
          worldTitle: true,
          lastSeenAt: true,
          characters: true,
        },
      })
    : undefined
  if (!campaign) {
    return { version: 0, live: false, connected: false, messages: [] }
  }

  const roster = campaign.characters as unknown as ConnectedCharacter[]
  const viewer: Viewer = {
    actorId: character.actorId ?? undefined,
    party: new Set(roster.map(({ id }) => id)),
  }

  const [messages, combats, sheet] = await Promise.all([
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
    viewer.actorId
      ? prisma.actorSheet.findUnique({
          where: {
            campaignActor: { campaignId: campaign.id, actorId: viewer.actorId },
          },
          select: { data: true },
        })
      : undefined,
  ])

  const combat = pickCombat(
    combats.map(({ data }) => data as unknown as CombatSnapshot),
  )
  return {
    version: campaign.version,
    live: isLive(campaign.lastSeenAt),
    campaign: {
      title: campaign.title,
      worldTitle: campaign.worldTitle ?? undefined,
      lastSeenAt: campaign.lastSeenAt?.toISOString(),
    },
    connected: roster.some(({ id }) => id === viewer.actorId),
    messages: toTableMessages(
      messages
        .toReversed()
        .map(({ data }) => data as unknown as SerializedMessage),
      viewer,
    ),
    combat: combat ? toTableCombat(combat, viewer) : undefined,
    sheet: sheet
      ? toTableSheet(sheet.data as unknown as CharacterSheet, campaign.origin)
      : undefined,
  }
}
