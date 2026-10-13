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
import type { SheetSeat } from '@/types/character'
import type { RollFeature, RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  ConnectedCharacter,
  SerializedMessage,
  SheetWithheld,
} from '@/types/sending-stone'
import type { GmRolls, TableView } from '@/types/table'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/**
 * What tells a viewer whether anything is new: the campaign's version, whether it is live, and
 * which rolls its game takes from players, and what else it does with them; and for the
 * Gamemaster at a character's sheet (#156), where their rolls go.
 */
export type CampaignStatus = {
  version: number
  live: boolean
  rollsToTable: RollKind[]
  rollFeatures: RollFeature[]
  gm?: { rolls: GmRolls }
}

/** What says which rolls a campaign's game takes from players. */
const rollsSelect = {
  rollsEnabled: true,
  rollKinds: true,
  rollFeatures: true,
  bridgePolledAt: true,
} as const

/**
 * The rolls a seat can have made in the game, none without an actor to make them, and what else
 * the game does with them. A player's never name `gmRolls`, which only the Gamemaster's view
 * reads, so their views, and what tells them apart, are as before it. The Gamemaster's (#156) are
 * none while the game doesn't make their rolls as the character's, marked as theirs, and never an
 * end of an enchantment, which is no roll; with where their rolls go: made in the game, kept here
 * until its module is updated, or kept here while it takes no rolls.
 */
function seatRolls(
  seat: SheetSeat,
  campaign?: Parameters<typeof availableRollFeatures>[0] | null,
): Pick<CampaignStatus, 'rollsToTable' | 'rollFeatures' | 'gm'> {
  const kinds = seat.actorId && campaign ? availableRollKinds(campaign) : []
  const features =
    seat.actorId && campaign ? availableRollFeatures(campaign) : []
  const others = features.filter(feature => feature !== 'gmRolls')
  if (seat.role !== 'gm') return { rollsToTable: kinds, rollFeatures: others }
  const made = features.includes('gmRolls')
  let rolls: GmRolls = 'off'
  if (made) rolls = 'made'
  else if (kinds.length > 0) rolls = 'update'
  return {
    rollsToTable: made ? kinds.filter(kind => kind !== 'endEnchantment') : [],
    rollFeatures: made ? others : [],
    gm: { rolls },
  }
}

/**
 * The status of a seat's campaign, to tell cheaply whether a viewer is up to date.
 * @returns Version 0, not live, while the character is in no campaign.
 */
export async function getCampaignStatus(
  seat: SheetSeat,
): Promise<CampaignStatus> {
  if (!seat.campaignId) {
    return {
      version: 0,
      live: false,
      ...seatRolls(seat),
    }
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: seat.campaignId },
    select: { version: true, lastSeenAt: true, ...rollsSelect },
  })
  return {
    version: campaign?.version ?? 0,
    live: isLive(campaign?.lastSeenAt),
    ...seatRolls(seat, campaign),
  }
}

/**
 * Why the module held a character's sheet back, as its entry in the roster keeps it, from module
 * 0.22.0: only what the player is told.
 */
function withheld(
  entry: ConnectedCharacter | undefined,
): SheetWithheld | undefined {
  const held = entry?.sheetWithheld
  return held && { reason: held.reason, bytes: held.bytes, limit: held.limit }
}

/**
 * A character's view of its campaign: the chat its player may read, the encounter under way, and
 * its own sheet. The Gamemaster at its sheet (#156) sees the same, as its player does, but never
 * their place in the chat. The caller must already have resolved the seat for the signed-in user.
 * @param seat - Who is at the sheet.
 * @param known - What the viewer already has: the sheet of this version is left out.
 */
export async function getTableView(
  seat: SheetSeat,
  known: { sheetVersion?: string } = {},
): Promise<TableView> {
  const campaign = seat.campaignId
    ? await prisma.campaign.findUnique({
        where: { id: seat.campaignId },
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
    actorId: seat.actorId ?? undefined,
    party: new Set(roster.map(({ id }) => id)),
    portraits: new Map(
      roster.flatMap(({ id, img }) => {
        const url = portraitUrl(img, campaign.origin)
        return url ? [[id, url] as const] : []
      }),
    ),
  }

  // The saves the game asks of the character, while it takes their answers.
  const rolls = seatRolls(seat, campaign)
  const prompted = viewer.actorId && rolls.rollFeatures.includes('prompts')
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
      select: { messageId: true, data: true, byGm: true },
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
      new Set(
        messages.filter(({ byGm }) => byGm).map(({ messageId }) => messageId),
      ),
    ),
    combat: combat ? toTableCombat(combat, viewer) : undefined,
    sheet:
      sheet && sheetVersion !== known.sheetVersion
        ? toTableSheet(sheet.data as unknown as CharacterSheet, campaign.origin)
        : undefined,
    sheetVersion,
    sheetWithheld: withheld(roster.find(({ id }) => id === viewer.actorId)),
    // The player's own; the Gamemaster's seat never reads nor moves it.
    chatReadAt: seat.role === 'gm' ? undefined : seat.chatReadAt,
    rollsToTable: rolls.rollsToTable,
    rollFeatures: rolls.rollFeatures,
    prompts: prompts.map(prompt => toTablePrompt(prompt)),
    ...(rolls.gm && { gm: rolls.gm }),
  }
}
