import { BRIDGE_POLLED_WITHIN } from '@/constants/sending-stone'
import { allItems } from '@/utils/sheet-texts'
import type { GroupEntry } from '@/types/party'
import type { TransferInput } from '@/types/roll'
import type {
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/roll-requests'

// How this app checks a move of items and coins (module 0.31.0) before the Gamemaster's module is
// sent it: who may make it, by the campaign's roster and its groups' access, and whether what's
// moved is on the sheet it's moved from, as last sent. The module checks it all again, live, in
// the game; these checks only spare a player a move the game would refuse.

/** Why a move can't go to the game, as these checks say. */
export type TransferRefusal = Extract<
  RollRefusal,
  | 'unknown'
  | 'not-yours'
  | 'not-owner'
  | 'gone'
  | 'short'
  | 'container'
  | 'nested'
  | 'members'
  | 'split'
>

/**
 * Whether a campaign's players may move items and coins now: its Gamemaster lets them, and the
 * Gamemaster's module is fetching moves, as `availableRollKinds` reads it of rolls.
 */
export function transfersAvailable(
  campaign: { transfersEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  const polled = campaign.bridgePolledAt?.getTime()
  return (
    campaign.transfersEnabled === true &&
    !!polled &&
    now - polled < BRIDGE_POLLED_WITHIN
  )
}

/**
 * Whether the seat may make a move between these ends: each one of the campaign's characters or
 * listed groups, and a distribution's, from module 0.32.0, its characters alone; made as the seat's
 * character, one of the campaign's, a character's things moved only as one of the move's ends, the
 * Gamemaster's too; a distribution only from a group; and for a player, a move from their own
 * character, or from a party their character's users own to anyone, from module 0.32.0 (to their
 * own character only before it), with Owner on every party end, as Foundry needs to change a
 * group's inventory. Before it, never two groups. A group the player's character can't see is
 * `unknown`, as a group that isn't there is, whatever the other end, so a made-up id never says one
 * is; and so is a group among those a distribution is shared among, for every seat. The Gamemaster
 * may move anything between the campaign's characters and groups, party to party too from module
 * 0.32.0.
 * @param roster - The campaign's characters, from its hello.
 * @param groups - Its groups, as its roster keeps them.
 * @param features - The campaign's `transferFeatures`: without `partySends`, 0.31.0's rules.
 */
export function checkEnds(
  seat: { role: 'player' | 'gm'; actorId: string | null },
  transfer: Pick<TransferInput, 'from' | 'to' | 'among'>,
  roster: { id: string }[],
  groups: GroupEntry[],
  features: readonly string[] = [],
): TransferRefusal | undefined {
  const { from, to, among } = transfer
  // For a player, a group their character can't see isn't listed at all: were it read as listed,
  // a move it's no end of would be refused as not theirs, and so say it's there.
  const listed =
    seat.role === 'gm'
      ? groups
      : groups.filter(entry => accessOf(entry, seat.actorId) !== undefined)
  const character = (id: string) => roster.some(entry => entry.id === id)
  const group = (id: string) => listed.find(entry => entry.id === id)
  const ends = to === undefined ? [from] : [from, to]
  if (ends.some(id => !character(id) && !group(id))) return 'unknown'
  // Those a distribution shares among are characters alone: a group among them says nothing of
  // whether it's one.
  if (among?.some(id => !character(id))) return 'unknown'
  const { actorId } = seat
  if (!actorId || !character(actorId)) return 'not-yours'
  const fromGroup = group(from)
  const toGroup = to === undefined ? undefined : group(to)
  if (among && !fromGroup) return 'not-yours'
  const anEnd = actorId === from || actorId === to
  // A character's things are moved only as one of the move's ends.
  if (to !== undefined && !fromGroup && !anEnd) return 'not-yours'
  if (
    to !== undefined &&
    !features.includes('partySends') &&
    (!anEnd || (fromGroup && toGroup))
  ) {
    return 'not-yours'
  }
  if (seat.role === 'gm') return undefined
  if (!fromGroup && from !== actorId) return 'not-yours'
  if (fromGroup && accessOf(fromGroup, actorId) !== 'owner') return 'not-owner'
  if (toGroup && accessOf(toGroup, actorId) !== 'owner') return 'not-owner'
  return undefined
}

/**
 * Whether a distribution shares among exactly the party's members that are the campaign's
 * characters, as its sheet was last sent (module 0.32.0). The module checks it again, as Foundry
 * has them.
 * @param sheet - The party's sheet.
 */
export function checkAmong(
  transfer: Pick<TransferInput, 'among'>,
  sheet: { members?: { id: string; character?: boolean }[] } | undefined,
): Extract<TransferRefusal, 'members'> | undefined {
  if (!sheet?.members) return 'members'
  const members = new Set(
    sheet.members
      .filter(({ character }) => character === true)
      .map(({ id }) => id),
  )
  const among = new Set(transfer.among ?? [])
  return members.size === among.size && [...among].every(id => members.has(id))
    ? undefined
    : 'members'
}

/**
 * A campaign character's player's access to the group, read as the party routes read it: Observer
 * or Owner, and anything else, or anything the roster can't say, no access.
 */
function accessOf(
  entry: GroupEntry,
  actorId: string | null,
): 'observer' | 'owner' | undefined {
  const access = entry.access ?? {}
  if (!actorId || !Object.hasOwn(access, actorId)) return undefined
  const level = access[actorId]
  return level === 'observer' || level === 'owner' ? level : undefined
}

/**
 * Whether what's moved is on the sheet it's moved from, as last sent: each item, anywhere on it,
 * with as many of it, and each coin, of its whole coins; never part of a container that holds, or
 * may hold, anything, which moves whole; and never an item with the container it's in, which it
 * moves with already. A distribution, from module 0.32.0, shares a whole coin at least with each
 * of those it's shared among.
 * @param sheet - The `from` end's sheet: a character's or a group's.
 */
export function checkHoldings(
  transfer: Pick<TransferInput, 'items' | 'currency' | 'among'>,
  sheet: { inventory?: SheetInventory } | undefined,
): TransferRefusal | undefined {
  if (!sheet?.inventory) return 'gone'
  const held = new Map<string, SheetItem | SheetContainer>(
    allItems(sheet).map(item => [item.id, item]),
  )
  const coins = new Map(
    sheet.inventory.currency.map(coin => [coin.id, coin.value]),
  )
  const items = (transfer.items ?? []).flatMap(part => {
    const item = held.get(part.id)
    return item ? [{ part, item }] : []
  })
  const currency = Object.entries(transfer.currency ?? {})
  if (
    items.length < (transfer.items ?? []).length ||
    currency.some(([key]) => !coins.has(key))
  ) {
    return 'gone'
  }
  if (
    items.some(({ part, item }) => part.quantity > item.quantity) ||
    currency.some(([key, count]) => count > Math.floor(coins.get(key) ?? 0))
  ) {
    return 'short'
  }
  if (
    transfer.among &&
    currency.some(([, count]) => count < (transfer.among?.length ?? 0))
  ) {
    return 'split'
  }
  // A container whose contents are secret may hold anything.
  if (
    items.some(({ part, item }) => {
      const contents = contentsOf(item)
      return (
        contents !== undefined &&
        (contents === null || contents.length > 0) &&
        part.quantity < item.quantity
      )
    })
  ) {
    return 'container'
  }
  const listed = new Set(items.map(({ part }) => part.id))
  const inside = items.flatMap(({ item }) => contained(item))
  if (inside.some(id => listed.has(id))) return 'nested'
  return undefined
}

/** What a container holds: null for a secret, and undefined for an item that's no container. */
function contentsOf(
  item: SheetItem | SheetContainer,
): (SheetItem | SheetContainer)[] | null | undefined {
  return 'contents' in item ? item.contents : undefined
}

/** The ids of everything a container holds, however deep: none for an item or a secret. */
function contained(item: SheetItem | SheetContainer): string[] {
  return (contentsOf(item) ?? []).flatMap(inner => [
    inner.id,
    ...contained(inner),
  ])
}
