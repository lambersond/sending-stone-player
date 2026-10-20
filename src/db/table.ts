import { createHash } from 'node:crypto'
import prisma from '@/clients/prisma'
import {
  GM_ROLLS_SHOWN,
  MIDI_PROMPT_GRACE,
  PROMPT_NOTICE_FOR,
  ROLLS_KEPT_FOR,
} from '@/constants/sending-stone'
import { isLive } from '@/db/campaigns'
import { groupRoster, tableGroups, tableMoves } from '@/db/party'
import { toTablePrompts } from '@/utils/prompts'
import {
  availableRollFeatures,
  availableRollKinds,
  GM_UNSENT,
  rollStatus,
  toGmRollView,
  type HeldRollRequest,
} from '@/utils/roll-requests'
import {
  pickCombat,
  portraitUrl,
  toTableCombat,
  toTableMessages,
  toTableSheet,
  type Viewer,
} from '@/utils/table-view'
import { transfersAvailable } from '@/utils/transfers'
import type { SheetSeat } from '@/types/character'
import type { RollFeature, RollKind } from '@/types/roll'
import type {
  CharacterSheet,
  CombatSnapshot,
  CommandResult,
  ConnectedCharacter,
  SerializedMessage,
  SheetWithheld,
} from '@/types/sending-stone'
import type { GmRolls, TableView } from '@/types/table'
import type { Prisma } from '@prisma/client'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/**
 * What tells a viewer whether anything is new: the campaign's version, whether it is live, and
 * which rolls its game takes from players, and what else it does with them; for the Gamemaster at
 * a character's sheet (#156), where their rolls go; and for its player, what changes whenever any
 * of the rolls the Gamemaster made as their character lately does, `TableView`'s `gmRollsKey`; and
 * from module 0.31.0, whether the seat may move its character's items and coins, which its game's
 * taking moves or not changes with no new version; and from module 0.32.0, whether the player
 * types in their own dice for it, which another of their devices may change.
 */
export type CampaignStatus = {
  version: number
  live: boolean
  rollsToTable: RollKind[]
  rollFeatures: RollFeature[]
  gm?: { rolls: GmRolls }
  gmRollsKey?: string
  moves: boolean
  typed: boolean
}

/**
 * The rolls the campaign's Gamemaster made as a player's character (#156) that its player is shown,
 * beside their own: those of the character's actor in its campaign, of those kept. None for the
 * Gamemaster's own seat, whose page has them already, nor for a character in no campaign.
 */
function gmRollsOf(
  seat: SheetSeat,
  now: number,
): Prisma.RollRequestWhereInput | undefined {
  if (seat.role !== 'player' || !seat.campaignId || !seat.actorId) return
  return {
    campaignId: seat.campaignId,
    actorId: seat.actorId,
    role: 'gm',
    createdAt: { gt: new Date(now - ROLLS_KEPT_FOR) },
  }
}

/**
 * What changes whenever any of the Gamemaster's rolls a player is shown does: its status, as time
 * moves it too, or what the game said of it. None for none.
 */
function gmRollsKey(
  rolls: (Pick<HeldRollRequest, 'id' | 'status' | 'createdAt' | 'claimedAt'> & {
    completedAt: Date | null
  })[],
  now: number,
): string | undefined {
  if (rolls.length === 0) return undefined
  const states = rolls.map(
    roll =>
      `${roll.id}:${rollStatus(roll, now)}:${roll.completedAt?.getTime() ?? ''}`,
  )
  return createHash('sha256')
    .update(states.join(','))
    .digest('base64url')
    .slice(0, 16)
}

/**
 * Of the attacks and uses the Gamemaster's damage shown to a player follows (#156), those the game
 * said healing follows, for that damage to be told as healing, as the player's own is: read from
 * the rolls shown, where the attack or use is among them, as it nearly always is, sent just before
 * its damage; else looked up, among the Gamemaster's as the same character, whose damage follows
 * only their own.
 */
async function healingUses(
  made: (Pick<HeldRollRequest, 'id' | 'kind' | 'result'> & {
    useId: string | null
  })[],
  seat: SheetSeat,
): Promise<ReadonlySet<string>> {
  const followed = new Set(
    made.flatMap(({ kind, useId }) =>
      kind === 'damage' && useId ? [useId] : [],
    ),
  )
  if (followed.size === 0) return followed
  const missing = [...followed].filter(id => !made.some(roll => roll.id === id))
  const found =
    missing.length > 0
      ? await prisma.rollRequest.findMany({
          where: {
            id: { in: missing },
            campaignId: seat.campaignId ?? '',
            actorId: seat.actorId ?? '',
            role: 'gm',
          },
          select: { id: true, result: true },
        })
      : []
  const heals = [...made, ...found].filter(
    ({ id, result }) =>
      followed.has(id) &&
      (result as CommandResult | null)?.damage?.healing === true,
  )
  return new Set(heals.map(({ id }) => id))
}

/** What says where each of the Gamemaster's rolls a player is shown stands. */
const gmRollStateSelect = {
  id: true,
  status: true,
  createdAt: true,
  claimedAt: true,
  completedAt: true,
} as const

/**
 * What says which rolls a campaign's game takes from players, and from module 0.31.0 whether it
 * takes their moves of items and coins.
 */
const rollsSelect = {
  rollsEnabled: true,
  rollKinds: true,
  rollFeatures: true,
  bridgePolledAt: true,
  transfersEnabled: true,
} as const

/**
 * The rolls a seat can have made in the game, none without an actor to make them, and what else
 * the game does with them. A player's never name `gmRolls`, which only the Gamemaster's view
 * reads, so their views, and what tells them apart, are as before it. The Gamemaster's (#156) are
 * none while the game doesn't make their rolls as the character's, marked as theirs, and never an
 * end of an enchantment or a concentration, which is no roll and posts nothing (`GM_UNSENT`); with
 * where their rolls go: made in the game, kept here
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
    rollsToTable: made ? kinds.filter(kind => !GM_UNSENT.has(kind)) : [],
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
  // The seat is read from the player's Character on every request, so their choice is as stored.
  const typed = seat.role === 'player' && seat.manualDice === true
  if (!seat.campaignId) {
    return {
      version: 0,
      live: false,
      ...seatRolls(seat),
      moves: false,
      typed,
    }
  }
  const now = Date.now()
  const gmRolls = gmRollsOf(seat, now)
  const [campaign, made] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: seat.campaignId },
      select: { version: true, lastSeenAt: true, ...rollsSelect },
    }),
    gmRolls
      ? prisma.rollRequest.findMany({
          where: gmRolls,
          orderBy: { createdAt: 'desc' },
          take: GM_ROLLS_SHOWN,
          select: gmRollStateSelect,
        })
      : [],
  ])
  const gmRollsKeyNow = gmRollsKey(made, now)
  return {
    version: campaign?.version ?? 0,
    live: isLive(campaign?.lastSeenAt),
    ...seatRolls(seat, campaign),
    ...(gmRollsKeyNow && { gmRollsKey: gmRollsKeyNow }),
    // Whether the character is in the roster, which the view reads too, changes the version.
    moves: !!seat.actorId && !!campaign && transfersAvailable(campaign, now),
    typed,
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
          groups: true,
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
  const now = Date.now()
  const gmRolls = gmRollsOf(seat, now)
  const [messages, combats, sheet, prompts, made] = await Promise.all([
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
    // Those Midi-QOL asks a while after their time runs out, and those that closed just now, for
    // which only Midi-QOL's are shown.
    prompted
      ? prisma.rollPrompt.findMany({
          where: {
            campaignId: campaign.id,
            actorId: viewer.actorId,
            OR: [
              {
                // eslint-disable-next-line unicorn/no-null -- Prisma's filter for an unset field
                closedAt: null,
                expiresAt: { gt: new Date(now - MIDI_PROMPT_GRACE) },
              },
              {
                closedAt: { gt: new Date(now - PROMPT_NOTICE_FOR) },
                closedReason: { in: ['rolled', 'expired'] },
              },
            ],
          },
          orderBy: { openedAt: 'asc' },
          select: {
            promptId: true,
            data: true,
            expiresAt: true,
            closedAt: true,
            closedReason: true,
          },
        })
      : [],
    gmRolls
      ? prisma.rollRequest.findMany({
          where: gmRolls,
          orderBy: { createdAt: 'desc' },
          take: GM_ROLLS_SHOWN,
          select: {
            ...gmRollStateSelect,
            actorId: true,
            role: true,
            kind: true,
            label: true,
            payload: true,
            useId: true,
            result: true,
          },
        })
      : [],
  ])
  const sheetVersion = sheet?.updatedAt.toISOString()
  const heals = await healingUses(made, seat)

  const combat = pickCombat(
    combats.map(({ data }) => data as unknown as CombatSnapshot),
  )
  // The party sheets the seat may open, from module 0.30.0: never who else may.
  const listed = groupRoster(campaign.groups)
  const groups = tableGroups(seat, listed, campaign.origin)
  const connected = roster.some(({ id }) => id === viewer.actorId)
  // Where the seat may move the character's items and coins to, from module 0.31.0.
  const moves =
    connected && !!seat.actorId && transfersAvailable(campaign, now)
      ? tableMoves(seat, listed, roster, campaign.origin)
      : undefined
  return {
    version: campaign.version,
    live: isLive(campaign.lastSeenAt),
    campaign: {
      title: campaign.title,
      worldTitle: campaign.worldTitle ?? undefined,
      lastSeenAt: campaign.lastSeenAt?.toISOString(),
    },
    connected,
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
    prompts: toTablePrompts(prompts, now),
    ...(rolls.gm && { gm: rolls.gm }),
    ...(made.length > 0 && {
      gmRolls: made.map(roll =>
        toGmRollView(roll, now, !!roll.useId && heals.has(roll.useId)),
      ),
      gmRollsKey: gmRollsKey(made, now),
    }),
    ...(groups.length > 0 && { groups }),
    ...(moves && { moves }),
    // Whether the player may type in their own dice follows what the game said last, stored,
    // never whether it polled lately, so a gap in polling never changes how they roll.
    ...(seat.role === 'player' && {
      manualDice: {
        offered:
          roster.find(({ id }) => id === viewer.actorId)?.manualDice === true &&
          campaign.rollFeatures.includes('manualDice'),
        on: seat.manualDice === true,
      },
    }),
  }
}
