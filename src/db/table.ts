import prisma from '@/clients/prisma'
import { isLive } from '@/db/campaigns'
import { toTablePrompt } from '@/utils/prompts'
import {
  availableRollFeatures,
  availableRollKinds,
} from '@/utils/roll-requests'
import {
  pickCombat,
  portraitUrl,
  toTableCombat,
  toTableMessages,
  toTableSheet,
  type Viewer,
} from '@/utils/table-view'
import type { Character } from '@/types/character'
import type { RollFeature, RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  ConnectedCharacter,
  SerializedMessage,
} from '@/types/sending-stone'
import type { TableView } from '@/types/table'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/**
 * What tells a viewer whether anything is new: the campaign's version, whether it is live, and
 * which rolls its game takes from players, and what else it does with them.
 */
export type CampaignStatus = {
  version: number
  live: boolean
  rollsToTable: RollKind[]
  rollFeatures: RollFeature[]
}

/** What says which rolls a campaign's game takes from players. */
const rollsSelect = {
  rollsEnabled: true,
  rollKinds: true,
  rollFeatures: true,
  bridgePolledAt: true,
} as const

/** The rolls a character's player can have made in the game: none without an actor to make them. */
function rollsToTable(
  character: Character,
  campaign: Parameters<typeof availableRollFeatures>[0] | null | undefined,
): RollKind[] {
  return character.actorId && campaign ? availableRollKinds(campaign) : []
}

/** What else the game does with them, as with the rolls. */
function rollFeatures(
  character: Character,
  campaign: Parameters<typeof availableRollFeatures>[0] | null | undefined,
): RollFeature[] {
  return character.actorId && campaign ? availableRollFeatures(campaign) : []
}

/**
 * The status of a character's campaign, to tell cheaply whether a viewer is up to date.
 * @returns Version 0, not live, while the character is in no campaign.
 */
export async function getCampaignStatus(
  character: Character,
): Promise<CampaignStatus> {
  if (!character.campaignId)
    return { version: 0, live: false, rollsToTable: [], rollFeatures: [] }
  const campaign = await prisma.campaign.findUnique({
    where: { id: character.campaignId },
    select: { version: true, lastSeenAt: true, ...rollsSelect },
  })
  return {
    version: campaign?.version ?? 0,
    live: isLive(campaign?.lastSeenAt),
    rollsToTable: rollsToTable(character, campaign),
    rollFeatures: rollFeatures(character, campaign),
  }
}

/**
 * A character's view of its campaign: the chat its player may read, the encounter under way, and
 * its own sheet. The caller must already have checked that the character belongs to the signed-in
 * user.
 * @param character - The character.
 * @param known - What the viewer already has: the sheet of this version is left out.
 */
export async function getTableView(
  character: Character,
  known: { sheetVersion?: string } = {},
): Promise<TableView> {
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
          ...rollsSelect,
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
    portraits: new Map(
      roster.flatMap(({ id, img }) => {
        const url = portraitUrl(img, campaign.origin)
        return url ? [[id, url] as const] : []
      }),
    ),
  }

  // The saves the game asks of the character, while it takes their answers.
  const features = rollFeatures(character, campaign)
  const prompted = viewer.actorId && features.includes('prompts')
  const [messages, combats, sheet, prompts] = await Promise.all([
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
          select: { data: true, updatedAt: true },
        })
      : undefined,
    prompted
      ? prisma.rollPrompt.findMany({
          where: {
            campaignId: campaign.id,
            actorId: viewer.actorId,
            // eslint-disable-next-line unicorn/no-null -- Prisma's filter for an unset field
            closedAt: null,
            expiresAt: { gt: new Date() },
          },
          orderBy: { openedAt: 'asc' },
          select: { promptId: true, data: true, expiresAt: true },
        })
      : [],
  ])
  const sheetVersion = sheet?.updatedAt.toISOString()

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
    sheet:
      sheet && sheetVersion !== known.sheetVersion
        ? toTableSheet(sheet.data as unknown as CharacterSheet, campaign.origin)
        : undefined,
    sheetVersion,
    chatReadAt: character.chatReadAt,
    rollsToTable: rollsToTable(character, campaign),
    rollFeatures: features,
    prompts: prompts.map(prompt => toTablePrompt(prompt)),
  }
}
