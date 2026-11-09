import { MOST_AMONG } from '@/constants/sending-stone'
import { groupRoster } from '@/utils/roster'
import { inventoryView, portraitUrl } from '@/utils/table-view'
import { transfersAvailable } from '@/utils/transfers'
import type { SheetSeat } from '@/types/character'
import type {
  PartySeat,
  PartyView,
  TableGroup,
  TableMoves,
} from '@/types/party'
import type {
  ConnectedCharacter,
  GroupEntry,
  GroupSheet,
} from '@/types/sending-stone'

// Who may see and change a campaign's party sheets (module 0.30.0), as Foundry shows them, and what
// each seat is shown of them (src/db/party.ts, src/db/table.ts).

/**
 * Has this campaign character's player Observer or Owner on the group in Foundry? Limited or less
 * is no access, and so is anything the roster can't say.
 */
export function canSee(entry: GroupEntry, actorId: string | null): boolean {
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
export function tableGroup(entry: GroupEntry, origin: string): TableGroup {
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
export function characterEnds(
  characters: Pick<ConnectedCharacter, 'id' | 'name' | 'img'>[],
  origin: string,
): TableMoves['characters'] {
  return characters.map(({ id, name, img }) => {
    const portrait = portraitUrl(img, origin)
    return { id, name, ...(portrait && { portrait }) }
  })
}

/**
 * Whether the seat may take from the group, from module 0.31.0: while the campaign lets items and
 * coins be moved, and its game is taking moves; a player only with Owner on it in Foundry.
 */
export function takesFromParty(
  seat: PartySeat,
  campaign: { transfersEnabled: boolean; bridgePolledAt: Date | null },
  entry: GroupEntry,
): boolean {
  return (
    transfersAvailable(campaign) &&
    (seat.role === 'gm' || owns(entry, seat.actorId))
  )
}

/** Why a party's sheet was held back as too large, as its player is told it. */
export function partyTooLarge(withheld: { bytes?: unknown; limit?: unknown }) {
  return {
    reason: 'tooLarge' as const,
    ...(typeof withheld.bytes === 'number' && { bytes: withheld.bytes }),
    ...(typeof withheld.limit === 'number' && { limit: withheld.limit }),
  }
}

/**
 * The other parties a party's things may be sent to, from module 0.32.0: for a player, those
 * their Foundry user owns; for the Gamemaster, every other one listed; the primary first. Never
 * the party itself, nor anyone's access.
 */
export function sendParties(
  seat: PartySeat,
  groups: unknown,
  entry: GroupEntry,
  origin: string,
): TableGroup[] {
  return groupRoster(groups)
    .filter(
      other =>
        other.id !== entry.id &&
        (seat.role === 'gm' || owns(other, seat.actorId)),
    )
    .toSorted((a, b) => Number(b.primary === true) - Number(a.primary === true))
    .map(other => tableGroup(other, origin))
}

/**
 * Who a party's coin is distributed among, from module 0.32.0: its members that are the campaign's
 * characters, as its sheet was last sent, in its order, by name and portrait only; none where it
 * has none, or more than one distribution shares among.
 */
export function distributeAmong(
  sheet: GroupSheet,
  origin: string,
): TableMoves['characters'] | undefined {
  const members = (sheet.members ?? []).filter(
    ({ character }) => character === true,
  )
  if (members.length === 0 || members.length > MOST_AMONG) return
  return members.map(({ id, name, img }) => {
    const portrait = portraitUrl(img, origin)
    return { id, name, ...(portrait && { portrait }) }
  })
}

/** A group's sheet as the seat sees it, its portraits and icons loading from the game. */
export function partySheetView(
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
    description: sheet.description?.full ?? sheet.description?.summary ?? null,
  }
}
