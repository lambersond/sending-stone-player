import { companionsByKey } from '@/utils/companions'
import { effectsAvailable } from '@/utils/effect-commands'
import { favoritesAvailable } from '@/utils/favorite-commands'
import { hitPointsAvailable } from '@/utils/hit-points'
import { tableMoves } from '@/utils/party'
import { removalsAvailable } from '@/utils/removals'
import {
  availableRollFeatures,
  availableRollKinds,
} from '@/utils/requests/availability'
import { GM_UNSENT } from '@/utils/requests/commands'
import { portraitUrl } from '@/utils/table-view'
import { transfersAvailable } from '@/utils/transfers'
import { wildShapeAvailable } from '@/utils/wild-shape'
import type { SheetSeat } from '@/types/character'
import type { RollFeature, RollKind } from '@/types/roll'
import type {
  CompanionEntry,
  ConnectedCharacter,
  GroupEntry,
  SheetWithheld,
} from '@/types/sending-stone'
import type { GmRolls, Viewer } from '@/types/table'

// What a seat at a character's table is shown, and may do, of its campaign (src/db/table.ts, and
// a companion's pane, src/db/companions.ts).

/**
 * The rolls a seat can have made in the game, none without an actor to make them, and what else
 * the game does with them. A player's never name `gmRolls`, which only the Gamemaster's view
 * reads, so their views, and what tells them apart, are as before it. The Gamemaster's (#156) are
 * none while the game doesn't make their rolls as the character's, marked as theirs, and never an
 * end of an enchantment, a concentration or from module 0.36.0 a turn, which is no roll and posts
 * nothing (`GM_UNSENT`); with where their rolls go: made in the game, kept here
 * until its module is updated, or kept here while it takes no rolls.
 */
export function seatRolls(
  seat: SheetSeat,
  campaign?: Parameters<typeof availableRollFeatures>[0] | null,
): {
  rollsToTable: RollKind[]
  rollFeatures: RollFeature[]
  gm?: { rolls: GmRolls }
} {
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
 * Why the module held a character's sheet back, as its entry in the roster keeps it, from module
 * 0.22.0: only what the player is told.
 */
export function withheld(
  entry: Pick<ConnectedCharacter, 'sheetWithheld'> | undefined,
): SheetWithheld | undefined {
  const held = entry?.sheetWithheld
  return held && { reason: held.reason, bytes: held.bytes, limit: held.limit }
}

/**
 * Who sees a table, as its messages and combat are worded for them: the seat's actor, the
 * campaign's characters, their portraits, and its characters' companions.
 */
export function viewerOf(
  seat: SheetSeat,
  roster: ConnectedCharacter[],
  companions: CompanionEntry[],
  origin: string,
): Viewer {
  return {
    actorId: seat.actorId ?? undefined,
    party: new Set(roster.map(({ id }) => id)),
    portraits: new Map(
      roster.flatMap(({ id, img }) => {
        const url = portraitUrl(img, origin)
        return url ? [[id, url] as const] : []
      }),
    ),
    companions: companionsByKey(companions, origin),
  }
}

/**
 * The character's own companions, for their tabs, from module 0.36.0: never another's, and none
 * at a companion's own seat, which has its own view.
 */
export function ownCompanions(
  seat: SheetSeat,
  companions: CompanionEntry[],
): CompanionEntry[] {
  return seat.companion
    ? []
    : companions.filter(
        entry => !!seat.actorId && entry.of.includes(seat.actorId),
      )
}

/**
 * What the seat may do with its character from here, beyond rolling, each only where its campaign
 * takes it now: where it may move its items and coins to, from module 0.31.0; whether it may
 * remove its items, from module 0.33.0, with no switch, with moves off too; and its player alone,
 * at their own seat, whether they may add to and remove from its favorites, from module 0.37.0,
 * with no switch; turn off, turn on and delete its own effects, from module 0.39.0, by the
 * campaign's switch, as favorites; use Wild Shape, from module 0.40.0, by the campaign's switch, as
 * effects; and set its hit points and temporary hit points, its form's while shaped, from module
 * 0.44.0, by the campaign's switch, as Wild Shape. What the character is, and what Wild Shape
 * gives, are on its sheet.
 * @param connected - The seat's actor is in the campaign's roster.
 * @param listed - The campaign's groups, as its roster keeps them.
 */
export function seatAllows(
  seat: SheetSeat,
  campaign: {
    origin: string
    bridgePolledAt: Date | null
    transfersEnabled: boolean
    removalsEnabled: boolean
    favoritesEnabled: boolean
    favoriteFeatures: string[]
    effectsEnabled: boolean
    wildShapeEnabled: boolean
    hitPointsEnabled: boolean
  },
  connected: boolean,
  listed: GroupEntry[],
  roster: ConnectedCharacter[],
  now: number,
) {
  const at = connected && !!seat.actorId
  const own = at && seat.role === 'player'
  const moves =
    at && transfersAvailable(campaign, now)
      ? tableMoves(seat, listed, roster, campaign.origin)
      : undefined
  return {
    ...(moves && { moves }),
    ...(at && removalsAvailable(campaign, now) && { removes: true as const }),
    ...(own &&
      favoritesAvailable(campaign, now) && { favorites: true as const }),
    // From module 0.47.0, where its module puts them in the order sent.
    ...(own &&
      favoritesAvailable(campaign, now) &&
      campaign.favoriteFeatures.includes('orders') && {
        favoriteOrders: true as const,
      }),
    ...(own && effectsAvailable(campaign, now) && { effects: true as const }),
    ...(own &&
      wildShapeAvailable(campaign, now) && { wildShape: true as const }),
    ...(own &&
      hitPointsAvailable(campaign, now) && { hitPoints: true as const }),
  }
}
