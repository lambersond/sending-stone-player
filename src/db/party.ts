import prisma from '@/clients/prisma'
import { isLive } from '@/db/campaigns'
import { inventoryView, portraitUrl } from '@/utils/table-view'
import { transfersAvailable } from '@/utils/transfers'
import type { SheetSeat } from '@/types/character'
import type {
  AllowedGroup,
  GroupEntry,
  GroupSheet,
  PartyView,
  TableGroup,
} from '@/types/party'
import type { ConnectedCharacter } from '@/types/sending-stone'
import type { TableMoves } from '@/types/table'

// Who may see a campaign's party sheets (module 0.30.0), as Foundry shows them: a player whose
// Foundry user has Observer or Owner on the group, through their character in the campaign; and the
// campaign's Gamemaster, through the campaign they own. Every read is checked here, each time, so
// that a player whose access is taken away in Foundry loses it here at once. Anyone else is told
// nothing: a group that isn't there, a campaign that isn't theirs and no access all look the same.

/** A Foundry document's id, as the module sends a group's. */
const GROUP_ID = /^[\dA-Za-z]{1,64}$/

/** Who is at a party sheet: a player, through their character, or the campaign's Gamemaster. */
export type PartySeat =
  | {
      role: 'player'
      campaignId: string | null
      actorId: string | null
      characterId: string
      name: string
    }
  | { role: 'gm'; campaignId: string; userId: string }

/** A seat at a character's sheet, at its party sheets: the same player, or the same Gamemaster. */
export function partySeat(seat: SheetSeat): PartySeat {
  if (seat.role === 'gm') {
    return {
      role: 'gm',
      campaignId: seat.campaignId ?? '',
      userId: seat.userId,
    }
  }
  return {
    role: 'player',
    campaignId: seat.campaignId,
    actorId: seat.actorId,
    characterId: seat.characterId ?? '',
    name: seat.name,
  }
}

/** A campaign's groups, as its roster keeps them: none where there's nothing to read. */
export function groupRoster(groups: unknown): GroupEntry[] {
  return Array.isArray(groups)
    ? (groups as (GroupEntry | null)[]).filter(
        (entry): entry is GroupEntry => typeof entry?.id === 'string',
      )
    : []
}

/**
 * Has this campaign character's player Observer or Owner on the group in Foundry? Limited or less
 * is no access, and so is anything the roster can't say.
 */
function canSee(entry: GroupEntry, actorId: string | null): boolean {
  if (!actorId || !entry.access || !Object.hasOwn(entry.access, actorId)) {
    return false
  }
  const level = entry.access[actorId]
  return level === 'observer' || level === 'owner'
}

/**
 * Has this campaign character's player Owner on the group in Foundry, as Foundry needs to change
 * its inventory (module 0.31.0)? Observer can see it, and moves nothing.
 */
function owns(entry: GroupEntry, actorId: string | null): boolean {
  return (
    !!actorId &&
    !!entry.access &&
    Object.hasOwn(entry.access, actorId) &&
    entry.access[actorId] === 'owner'
  )
}

/** The group, as a table page lists it to open: never who may see it. */
function tableGroup(entry: GroupEntry, origin: string): TableGroup {
  const portrait = portraitUrl(entry.img, origin)
  return {
    id: entry.id,
    name: entry.name,
    ...(portrait && { portrait }),
    primary: entry.primary === true,
  }
}

/**
 * The groups a seat at a character's sheet may open, for its table view to offer: for a player,
 * only those their Foundry user may see; for the Gamemaster, every one listed. The primary party
 * comes first, then the rest in the module's order.
 * @param seat - Who is at the sheet, already resolved for the signed-in user.
 * @param roster - The campaign's groups, as its roster keeps them.
 * @param origin - The game's address, which a portrait's path may be relative to.
 */
export function tableGroups(
  seat: SheetSeat,
  roster: GroupEntry[],
  origin: string,
): TableGroup[] {
  return roster
    .filter(entry => seat.role === 'gm' || canSee(entry, seat.actorId))
    .toSorted((a, b) => Number(b.primary === true) - Number(a.primary === true))
    .map(entry => tableGroup(entry, origin))
}

/**
 * Where a seat at a character's sheet may move its character's items and coins to, from module
 * 0.31.0: the groups it may give to, for a player only those their Foundry user has Owner on, for
 * the Gamemaster every one listed, the primary party first; and the campaign's other characters, in
 * its roster's order. Never anyone's access.
 * @param roster - The campaign's groups, as its roster keeps them.
 * @param characters - The campaign's characters, from its hello.
 */
export function tableMoves(
  seat: SheetSeat,
  roster: GroupEntry[],
  characters: Pick<ConnectedCharacter, 'id' | 'name' | 'img'>[],
  origin: string,
): TableMoves {
  return {
    parties: roster
      .filter(entry => seat.role === 'gm' || owns(entry, seat.actorId))
      .toSorted(
        (a, b) => Number(b.primary === true) - Number(a.primary === true),
      )
      .map(entry => tableGroup(entry, origin)),
    characters: characterEnds(
      characters.filter(({ id }) => id !== seat.actorId),
      origin,
    ),
  }
}

/** The campaign's characters, as a move names its ends: by name and portrait only. */
function characterEnds(
  characters: Pick<ConnectedCharacter, 'id' | 'name' | 'img'>[],
  origin: string,
): TableMoves['characters'] {
  return characters.map(({ id, name, img }) => {
    const portrait = portraitUrl(img, origin)
    return { id, name, ...(portrait && { portrait }) }
  })
}

/** What the check reads of a campaign: never anything only its Gamemaster may read. */
const campaignSelect = {
  id: true,
  title: true,
  origin: true,
  version: true,
  lastSeenAt: true,
  ownerId: true,
  groups: true,
  transfersEnabled: true,
  bridgePolledAt: true,
} as const

/**
 * Whether the seat may take from the group, from module 0.31.0: while the campaign lets items and
 * coins be moved, and its game is taking moves; a player only with Owner on it in Foundry.
 */
function takes(
  seat: PartySeat,
  campaign: { transfersEnabled: boolean; bridgePolledAt: Date | null },
  entry: GroupEntry,
): boolean {
  return (
    transfersAvailable(campaign) &&
    (seat.role === 'gm' || owns(entry, seat.actorId))
  )
}

/** The campaign and the group's entry, where the seat may see the group; else undefined. */
async function access(seat: PartySeat, groupId: string) {
  if (!GROUP_ID.test(groupId) || !seat.campaignId) return
  const campaign = await prisma.campaign.findUnique({
    where: { id: seat.campaignId },
    select: campaignSelect,
  })
  if (!campaign) return
  const entry = groupRoster(campaign.groups).find(({ id }) => id === groupId)
  if (!entry) return
  const allowed =
    seat.role === 'gm'
      ? !!seat.userId && campaign.ownerId === seat.userId
      : canSee(entry, seat.actorId)
  return allowed ? { campaign, entry } : undefined
}

/**
 * The group, where the seat may see it now, for its descriptions to be served by.
 * @returns Undefined where it may not, or the group isn't there.
 */
export async function allowedGroup(
  seat: PartySeat,
  groupId: string,
): Promise<AllowedGroup | undefined> {
  const found = await access(seat, groupId)
  return found && { campaignId: found.campaign.id, groupId: found.entry.id }
}

/**
 * Whether anything is new on a party sheet the seat may see now: the campaign's version, whether
 * its game is live, and from module 0.31.0 whether the seat may take from it, which its game's
 * taking moves or not changes with no new version. Checked before anything is said to be
 * unchanged, so a player whose access was taken away is told nothing, rather than that nothing
 * changed.
 * @returns Undefined where the seat may not see it.
 */
export async function getPartyStatus(
  seat: PartySeat,
  groupId: string,
): Promise<{ version: number; live: boolean; moves: boolean } | undefined> {
  const found = await access(seat, groupId)
  return (
    found && {
      version: found.campaign.version,
      live: isLive(found.campaign.lastSeenAt),
      moves: takes(seat, found.campaign, found.entry),
    }
  )
}

/**
 * A party sheet as the seat may see it: its members by name and portrait only, the player's own
 * character marked, its stash and its description; or, without a sheet, why there's none.
 * @param seat - Who is at it, already resolved for the signed-in user.
 * @param groupId - The group's actor id.
 * @param known - What the viewer already has: the sheet of this version is left out.
 * @returns Undefined where the seat may not see it, or it isn't there.
 */
export async function getGroupView(
  seat: PartySeat,
  groupId: string,
  known: { sheetVersion?: string } = {},
): Promise<PartyView | undefined> {
  const found = await access(seat, groupId)
  if (!found) return undefined
  const { campaign, entry } = found
  const held = await prisma.groupSheet.findUnique({
    where: { campaignGroup: { campaignId: campaign.id, actorId: entry.id } },
    select: { data: true, updatedAt: true },
  })
  const sheetVersion = held?.updatedAt.toISOString()
  const withheld = entry.sheetWithheld
  // Who the Gamemaster may take into, from module 0.31.0: any of the campaign's characters, which
  // only their view reads.
  const moves = takes(seat, campaign, entry)
  const roster =
    moves && seat.role === 'gm'
      ? await prisma.campaign.findUnique({
          where: { id: campaign.id },
          select: { characters: true },
        })
      : undefined
  return {
    version: campaign.version,
    live: isLive(campaign.lastSeenAt),
    campaign: { title: campaign.title },
    group: tableGroup(entry, campaign.origin),
    ...(held &&
      sheetVersion !== known.sheetVersion && {
        sheet: sheetView(
          held.data as unknown as GroupSheet,
          seat,
          campaign.origin,
        ),
      }),
    ...(sheetVersion && { sheetVersion }),
    ...(withheld?.reason === 'tooLarge' && {
      withheld: {
        reason: 'tooLarge' as const,
        ...(typeof withheld.bytes === 'number' && { bytes: withheld.bytes }),
        ...(typeof withheld.limit === 'number' && { limit: withheld.limit }),
      },
    }),
    // Only the Gamemaster is told of a group no player may see, as only they may open it.
    ...(seat.role === 'gm' &&
      Object.keys(entry.access ?? {}).length === 0 && {
        private: true as const,
      }),
    ...(moves && {
      moves: roster
        ? {
            characters: characterEnds(
              characterRoster(roster.characters),
              campaign.origin,
            ),
          }
        : {},
    }),
  }
}

/** A campaign's characters, as its hello listed them: none where there's nothing to read. */
function characterRoster(
  characters: unknown,
): Pick<ConnectedCharacter, 'id' | 'name' | 'img'>[] {
  return Array.isArray(characters)
    ? (characters as (ConnectedCharacter | null)[]).filter(
        (entry): entry is ConnectedCharacter => typeof entry?.id === 'string',
      )
    : []
}

/** A group's sheet as the seat sees it, its portraits and icons loading from the game. */
function sheetView(
  sheet: GroupSheet,
  seat: PartySeat,
  origin: string,
): NonNullable<PartyView['sheet']> {
  const own = seat.role === 'player' ? seat.actorId : undefined
  return {
    members: (sheet.members ?? []).map(member => {
      const portrait = portraitUrl(member.img, origin)
      return {
        id: member.id,
        name: member.name,
        ...(portrait && { portrait }),
        ...(own && member.id === own && { own: true as const }),
      }
    }),
    inventory: inventoryView(sheet.inventory, origin),
    // dnd5e shows the full description, else its summary.
    // eslint-disable-next-line unicorn/no-null -- the sheet uses null for none
    description: sheet.description?.full ?? sheet.description?.summary ?? null,
  }
}
