import prisma from '@/clients/prisma'
import { COMPANION_KEY, GM_ROLLS_SHOWN } from '@/constants/sending-stone'
import { viewDiceAsks } from '@/db/dice-asks'
import {
  gmRollsOf,
  gmRollStateSelect,
  healingUses,
  heldPrompts,
  rollsSelect,
} from '@/db/table'
import {
  companionRolls,
  hitPointsFlag,
  initiativeOf,
  setsHitPoints,
} from '@/utils/companion-pane'
import { companionRoster, tableCompanion } from '@/utils/companions'
import { gmRollParts, gmRollsKey } from '@/utils/gm-rolls'
import { isLive } from '@/utils/live'
import { toTablePrompts } from '@/utils/prompts'
import { listedCompanion } from '@/utils/roster'
import { sheetTextRefs } from '@/utils/sheet-texts'
import { viewerOf, withheld } from '@/utils/table-seat'
import { pickCombat, toTableCombat, toTableSheet } from '@/utils/table-view'
import type { RollSeat, CompanionStatus } from '@/db/types'
import type { SheetSeat } from '@/types/character'
import type {
  CharacterSheet,
  CombatSnapshot,
  ConnectedCharacter,
} from '@/types/sending-stone'
import type { CompanionView, Viewer } from '@/types/table'

// A campaign's characters' companions, from module 0.36.0: each seen, and rolled for, from its
// character's seat, by that character's player or the campaign's Gamemaster, through a companion
// seat that is the character's seat with the companion in place of its actor, and only while the
// campaign's stored list says it's that character's. Every route re-reads it on every request,
// so a companion the module stops listing answers no more at once; all but the one that says
// where a roll sent for it stands, which answers its seat's own rolls for it, listed or not, so
// that one sent a moment before it left the list is still followed to what the game made of it.

/**
 * The seat at one of a character's companions' sheets (module 0.36.0): the character's seat, its
 * player's or the Gamemaster's, already resolved, with the companion in place of its actor, only
 * while the campaign's stored list says it's that character's.
 * @returns Undefined for a key not listed, or not the character's.
 */
export async function companionSeat(
  seat: SheetSeat,
  key: string,
): Promise<SheetSeat | undefined> {
  const { campaignId, actorId } = seat
  // A seat already at a companion is never nested.
  if (seat.companion || !campaignId || !actorId || !COMPANION_KEY.test(key)) {
    return undefined
  }
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { companions: true },
  })
  const entry = companionRoster(campaign?.companions).find(
    listed => listed.key === key && listed.of.includes(actorId),
  )
  if (!entry) return undefined
  return {
    ...seat,
    actorId: key,
    name: entry.name,
    companion: { of: actorId, entry },
  }
}

/**
 * The seat a roll sent for one of a character's companions is asked after from (module 0.36.0):
 * the character's seat, already resolved, with the companion's key in place of its actor, as
 * `companionSeat`'s, but whether or not the module lists it now. The module stops listing a
 * companion within a moment of its token being deleted or hidden, or the scene changing, while a
 * roll sent for it just before is still waiting, or was made already: it's still answered, refused
 * as no longer its character's companion or made, never lost as unanswered. Only the rolls the
 * seat sent for that companion from that character are served at it (`getRollRequestView`), so it
 * shows nothing the seat didn't make; its table, rolls and texts are a listed companion's only.
 * @returns Undefined for a bad key, or a seat already at a companion.
 */
export function companionRollSeat(
  seat: SheetSeat,
  key: string,
): RollSeat | undefined {
  const { role, userId, campaignId, actorId, characterId } = seat
  if (seat.companion || !campaignId || !actorId || !COMPANION_KEY.test(key)) {
    return undefined
  }
  return {
    role,
    userId,
    campaignId,
    actorId: key,
    characterId,
    companion: { of: actorId },
  }
}

/** What a companion's campaign is read for, for its view and its status. */
const companionSelect = {
  version: true,
  lastSeenAt: true,
  origin: true,
  characters: true,
  companions: true,
  companionKinds: true,
  companionInitiative: true,
  hitPointsEnabled: true,
  ...rollsSelect,
} as const

/**
 * The status of a companion's campaign, as its seat sees it, to tell cheaply whether its pane is up
 * to date (module 0.36.0).
 */
export async function getCompanionStatus(
  seat: SheetSeat,
): Promise<CompanionStatus> {
  const now = Date.now()
  const gmRolls = gmRollsOf(seat, now)
  const [campaign, made] = await Promise.all([
    seat.campaignId
      ? prisma.campaign.findUnique({
          where: { id: seat.campaignId },
          select: companionSelect,
        })
      : undefined,
    gmRolls
      ? prisma.rollRequest.findMany({
          where: gmRolls,
          orderBy: { createdAt: 'desc' },
          take: GM_ROLLS_SHOWN,
          select: gmRollStateSelect,
        })
      : [],
  ])
  if (!campaign) {
    return {
      version: 0,
      live: false,
      rollsToTable: [],
      rollFeatures: [],
      typed: false,
      hitPoints: false,
    }
  }
  const connected = !!listedCompanion(seat, campaign.companions)
  const key = gmRollsKey(made, now)
  return {
    version: campaign.version,
    live: isLive(campaign.lastSeenAt),
    ...companionRolls(seat, campaign, connected),
    ...(key && { gmRollsKey: key }),
    typed: seat.role === 'player' && seat.manualDice === true,
    // Whether its player may set its hit points, from module 0.44.0, as its view says.
    hitPoints: setsHitPoints(seat, campaign, connected, now),
  }
}

/**
 * A companion's own view, for its pane to poll (module 0.36.0): its sheet, the encounter seen from
 * it, so that its own combatant is the viewer's and its character the party's, and theirs; the
 * rolls it can have made; from module 0.41.0, the saves the game asks of it, by its key, never its
 * character's; the Gamemaster's rolls as it, at its player's seat; whether its dice are typed in,
 * as its character's are; from module 0.44.0, whether its player may set its hit points; and how
 * it enters initiative. Its chat is its character's, which its character's view has. The caller
 * must already have resolved the companion seat.
 * @param known - What the pane already has: the sheet of this version is left out.
 */
export async function getCompanionView(
  seat: SheetSeat,
  known: { sheetVersion?: string } = {},
): Promise<CompanionView> {
  const campaign =
    seat.campaignId && seat.companion
      ? await prisma.campaign.findUnique({
          where: { id: seat.campaignId },
          select: companionSelect,
        })
      : undefined
  const of = seat.companion?.of
  if (!campaign || !seat.campaignId || !seat.actorId || !of) {
    return {
      version: 0,
      live: false,
      connected: false,
      initiative: { mode: 'own' },
    }
  }
  const { campaignId, actorId: key } = seat
  const now = Date.now()
  const gmRolls = gmRollsOf(seat, now)
  // As the module lists it now, or else as the seat found it, a moment ago.
  const current = listedCompanion(seat, campaign.companions)
  const connected = !!current
  const rolls = companionRolls(seat, campaign, connected)
  // The saves the game asks of it, where it asks companions, as its character's view has its own.
  const prompted = rolls.rollFeatures.includes('prompts')
  const [combats, sheet, made, prompts, diceAsks] = await Promise.all([
    prisma.combat.findMany({
      where: { campaignId },
      orderBy: { updatedAt: 'desc' },
      select: { data: true },
    }),
    prisma.companionSheet.findUnique({
      where: { campaignCompanion: { campaignId, key } },
      select: { data: true, updatedAt: true },
    }),
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
    prompted ? heldPrompts(campaignId, key, now) : [],
    // The dice the game asks its character's player for, of its own typed rolls' runs (module
    // 0.44.0), as its character's view has its own.
    viewDiceAsks(seat, rolls.rollsToTable, now),
  ])
  const heals = await healingUses(made, seat)

  const listed = companionRoster(campaign.companions)
  const entry = current ?? seat.companion?.entry
  const roster = campaign.characters as unknown as ConnectedCharacter[]
  const viewer: Viewer = {
    ...viewerOf(seat, roster, listed, campaign.origin),
    of,
  }
  const snapshot = pickCombat(
    combats.map(({ data }) => data as unknown as CombatSnapshot),
  )
  const sheetVersion = sheet?.updatedAt.toISOString()
  const character = roster.find(({ id }) => id === of)
  return {
    version: campaign.version,
    live: isLive(campaign.lastSeenAt),
    connected,
    ...(entry && { companion: tableCompanion(entry, campaign.origin) }),
    ...(sheet &&
      sheetVersion !== known.sheetVersion && {
        sheet: toTableSheet(
          sheet.data as unknown as CharacterSheet,
          campaign.origin,
        ),
      }),
    ...(sheetVersion && { sheetVersion }),
    ...(withheld(entry) && { sheetWithheld: withheld(entry) }),
    ...(snapshot && { combat: toTableCombat(snapshot, viewer) }),
    rollsToTable: rolls.rollsToTable,
    rollFeatures: rolls.rollFeatures,
    ...(prompted && { prompts: toTablePrompts(prompts, now) }),
    ...diceAsks,
    ...(rolls.gm && { gm: rolls.gm }),
    ...gmRollParts(made, heals, now),
    // Its character's, as its character's view has it: for its player's seat alone.
    ...(seat.role === 'player' && {
      manualDice: {
        offered:
          character?.manualDice === true &&
          campaign.rollFeatures.includes('manualDice'),
        on: seat.manualDice === true,
      },
    }),
    ...hitPointsFlag(seat, campaign, connected, now),
    initiative: initiativeOf(
      campaign.companionInitiative,
      entry?.of ?? [of],
      snapshot,
      roster,
    ),
  }
}

/**
 * A description on a companion's sheet (module 0.36.0), for its seat: undefined unless that
 * companion's own sheet refers to it and the campaign holds it, never one only its character's
 * sheet, or another's, refers to.
 * @param seat - The companion seat, already resolved for the signed-in user.
 * @param hash - The description's hash.
 */
export async function getCompanionText(
  seat: SheetSeat,
  hash: string,
): Promise<string | undefined> {
  const { campaignId, actorId: key } = seat
  if (!seat.companion || !campaignId || !key) return undefined
  const sheet = await prisma.companionSheet.findUnique({
    where: { campaignCompanion: { campaignId, key } },
    select: { data: true },
  })
  const refs = sheet
    ? sheetTextRefs(sheet.data as unknown as CharacterSheet)
    : []
  if (!refs.includes(hash)) return undefined
  const text = await prisma.sheetText.findUnique({
    where: { campaignHash: { campaignId, hash } },
    select: { html: true },
  })
  return text?.html
}
