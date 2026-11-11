import prisma from '@/clients/prisma'
import {
  GM_ROLLS_SHOWN,
  MIDI_PROMPT_GRACE,
  PROMPT_NOTICE_FOR,
  ROLLS_KEPT_FOR,
} from '@/constants/sending-stone'
import { companionDiceAsks, viewDiceAsks } from '@/db/dice-asks'
import { companionAsks } from '@/utils/companion-asks'
import { companionRoster, tableCompanion } from '@/utils/companions'
import { effectsAvailable } from '@/utils/effect-commands'
import { favoritesAvailable } from '@/utils/favorite-commands'
import { gmRollParts, gmRollsKey } from '@/utils/gm-rolls'
import { hitPointsAvailable } from '@/utils/hit-points'
import { isLive } from '@/utils/live'
import { tableGroups } from '@/utils/party'
import { toTablePrompts } from '@/utils/prompts'
import { removalsAvailable } from '@/utils/removals'
import { groupRoster } from '@/utils/roster'
import {
  ownCompanions,
  seatAllows,
  seatRolls,
  viewerOf,
  withheld,
} from '@/utils/table-seat'
import {
  pickCombat,
  toTableCombat,
  toTableMessages,
  toTableSheet,
} from '@/utils/table-view'
import { transfersAvailable } from '@/utils/transfers'
import { wildShapeAvailable } from '@/utils/wild-shape'
import type { CampaignStatus } from './types'
import type { SheetSeat } from '@/types/character'
import type {
  CharacterSheet,
  CombatSnapshot,
  CommandResult,
  CompanionEntry,
  ConnectedCharacter,
  SerializedMessage,
} from '@/types/sending-stone'
import type { TableView, Viewer } from '@/types/table'
import type { HeldRollRequest } from '@/utils/requests/types'
import type { Prisma } from '@prisma/client'

/** The most recent chat messages shown. */
export const MESSAGE_LIMIT = 100

/**
 * The rolls the campaign's Gamemaster made as a player's character (#156) that its player is shown,
 * beside their own: those of the character's actor in its campaign, of those kept. None for the
 * Gamemaster's own seat, whose page has them already, nor for a character in no campaign.
 */
export function gmRollsOf(
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
 * Of the attacks and uses the Gamemaster's damage shown to a player follows (#156), those the game
 * said healing follows, for that damage to be told as healing, as the player's own is: read from
 * the rolls shown, where the attack or use is among them, as it nearly always is, sent just before
 * its damage; else looked up, among the Gamemaster's as the same character, whose damage follows
 * only their own.
 */
export async function healingUses(
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
export const gmRollStateSelect = {
  id: true,
  status: true,
  createdAt: true,
  claimedAt: true,
  completedAt: true,
} as const

/**
 * What says which rolls a campaign's game takes from players, from module 0.31.0 whether it takes
 * their moves of items and coins, and from module 0.33.0 whether it removes their items.
 */
export const rollsSelect = {
  rollsEnabled: true,
  rollKinds: true,
  rollFeatures: true,
  bridgePolledAt: true,
  transfersEnabled: true,
  removalsEnabled: true,
} as const

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
      moves: false,
      // As the view, which has no campaign to say it in: a campaign removed leaves it stored.
      typed: false,
      removes: false,
      favorites: false,
      effects: false,
      wildShape: false,
      hitPoints: false,
    }
  }
  const now = Date.now()
  const gmRolls = gmRollsOf(seat, now)
  const [campaign, made] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: seat.campaignId },
      select: {
        version: true,
        lastSeenAt: true,
        ...rollsSelect,
        favoritesEnabled: true,
        effectsEnabled: true,
        wildShapeEnabled: true,
        hitPointsEnabled: true,
      },
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
    // The seat is read from the player's Character on every request, so their choice is as
    // stored; told only where the view tells it, with its campaign.
    typed: seat.role === 'player' && seat.manualDice === true && !!campaign,
    // Whether the seat may remove its character's items, from module 0.33.0, as `moves`.
    removes: !!seat.actorId && !!campaign && removalsAvailable(campaign, now),
    // Whether the player may change its character's favorites, from module 0.37.0: theirs alone,
    // never the Gamemaster's, whose page would leave no mark of it.
    favorites:
      seat.role === 'player' &&
      !!seat.actorId &&
      !!campaign &&
      favoritesAvailable(campaign, now),
    // Whether the player may change its character's own effects, from module 0.39.0, by the
    // campaign's switch: theirs alone, as favorites.
    effects:
      seat.role === 'player' &&
      !!seat.actorId &&
      !!campaign &&
      effectsAvailable(campaign, now),
    // Whether the player may use Wild Shape, from module 0.40.0, by the campaign's switch: theirs
    // alone, as effects.
    wildShape:
      seat.role === 'player' &&
      !!seat.actorId &&
      !!campaign &&
      wildShapeAvailable(campaign, now),
    // Whether the player may set its character's hit points, from module 0.44.0, by the campaign's
    // switch: theirs alone, as Wild Shape, with the rolls off too.
    hitPoints:
      seat.role === 'player' &&
      !!seat.actorId &&
      !!campaign &&
      hitPointsAvailable(campaign, now),
  }
}

/**
 * The saves the game asks of one of a campaign's characters, or from module 0.41.0 of a companion
 * by its key, as its view shows them: those still open, Midi-QOL's a while after their time runs
 * out, and those that closed just now, for which only Midi-QOL's are shown; oldest first.
 */
export function heldPrompts(campaignId: string, actorId: string, now: number) {
  return prisma.rollPrompt.findMany({
    where: {
      campaignId,
      actorId,
      OR: [
        {
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
}

/** What a table reads of its campaign. */
const TABLE_CAMPAIGN = {
  id: true,
  origin: true,
  title: true,
  version: true,
  worldTitle: true,
  lastSeenAt: true,
  characters: true,
  groups: true,
  companions: true,
  ...rollsSelect,
  favoritesEnabled: true,
  effectsEnabled: true,
  wildShapeEnabled: true,
  hitPointsEnabled: true,
  chatClearedAt: true,
  // Whether its module is one that asks for the dice an item rolls later, for Help.
  laterDice: true,
} as const

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
        select: TABLE_CAMPAIGN,
      })
    : undefined
  if (!campaign) {
    return { version: 0, live: false, connected: false, messages: [] }
  }

  const roster = campaign.characters as unknown as ConnectedCharacter[]
  // The campaign's characters' companions, from module 0.36.0: whose side each is on.
  const companions = companionRoster(campaign.companions)
  const viewer = viewerOf(seat, roster, companions, campaign.origin)
  const own = ownCompanions(seat, companions)
  const rolls = seatRolls(seat, campaign)
  const now = Date.now()
  const [messages, combats, sheet, prompts, made, asked, diceAsks, diceAsked] =
    await readTable(seat, campaign.id, viewer, own, rolls, now)
  const sheetVersion = sheet?.updatedAt.toISOString()
  const heals = await healingUses(made, seat)
  const waiting = companionAsks(asked, now, diceAsked)

  const combat = pickCombat(
    combats.map(({ data }) => data as unknown as CombatSnapshot),
  )
  // The party sheets the seat may open, from module 0.30.0: never who else may.
  const listed = groupRoster(campaign.groups)
  const groups = tableGroups(seat, listed, campaign.origin)
  const connected = roster.some(({ id }) => id === viewer.actorId)
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
    // When the chat was last cleared, here or in Foundry, which its empty log says (v0.44).
    ...(campaign.chatClearedAt && {
      chatClearedAt: campaign.chatClearedAt.toISOString(),
    }),
    rollsToTable: rolls.rollsToTable,
    rollFeatures: rolls.rollFeatures,
    prompts: toTablePrompts(prompts, now),
    ...diceAsks,
    ...(rolls.gm && { gm: rolls.gm }),
    ...gmRollParts(made, heals, now),
    ...(groups.length > 0 && { groups }),
    ...(own.length > 0 && {
      companions: own.map(entry => tableCompanion(entry, campaign.origin)),
    }),
    ...(waiting.length > 0 && { companionPrompts: waiting }),
    ...seatAllows(seat, campaign, connected, listed, roster, now),
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
    // Whether its module is one that asks a typing player for the dice an item rolls later, as its
    // hello said last, at either seat, for Help: by its versions, never its switches, and stored,
    // never whether it polled lately (the owner's round 3 decision 3).
    ...(campaign.laterDice && { laterDice: true as const }),
  }
}

/**
 * What a table shows, read at once: the chat the seat may read, the combats, its sheet, the saves
 * the game asks of the character, the Gamemaster's rolls as it its player is shown, those its game
 * asks of its companions, and from module 0.44.0 the dice its game asks its player for, its own
 * and in its companions' runs.
 */
function readTable(
  seat: SheetSeat,
  campaignId: string,
  viewer: Viewer,
  own: CompanionEntry[],
  rolls: ReturnType<typeof seatRolls>,
  now: number,
) {
  const features: string[] = rolls.rollFeatures
  // The saves the game asks of the character, while it takes their answers; and from module
  // 0.41.0, whether it asks any of its companions', which their own views show.
  const prompted = viewer.actorId && features.includes('prompts')
  const companionsAsked =
    !!prompted && features.includes('companionPrompts') && own.length > 0
  const gmRolls = gmRollsOf(seat, now)
  return Promise.all([
    prisma.chatMessage.findMany({
      where: {
        campaignId,
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
      where: { campaignId },
      orderBy: { updatedAt: 'desc' },
      select: { data: true },
    }),
    viewer.actorId
      ? prisma.actorSheet.findUnique({
          where: {
            campaignActor: { campaignId, actorId: viewer.actorId },
          },
          select: { data: true, updatedAt: true },
        })
      : undefined,
    prompted && viewer.actorId
      ? heldPrompts(campaignId, viewer.actorId, now)
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
    // Its companions' still open, from module 0.41.0, oldest first, to mark each one asked.
    companionsAsked
      ? prisma.rollPrompt.findMany({
          where: {
            campaignId,
            actorId: { in: own.map(({ key }) => key) },
            closedAt: null,
            expiresAt: { gt: new Date(now - MIDI_PROMPT_GRACE) },
          },
          orderBy: { openedAt: 'asc' },
          select: { actorId: true, data: true, expiresAt: true },
        })
      : [],
    viewDiceAsks(seat, rolls.rollsToTable, now),
    companionDiceAsks(
      seat,
      own.map(({ key }) => key),
      rolls.rollsToTable,
      now,
    ),
  ])
}
