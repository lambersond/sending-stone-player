import { BRIDGE_POLLED_WITHIN } from '@/constants/sending-stone'
import { allItems } from '@/utils/sheet-texts'
import type { RemoveInput } from '@/types/roll'
import type {
  SheetContainer,
  SheetInventory,
  SheetItem,
} from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/roll-requests'

// How this app checks a removal of a character's item (module 0.33.0) before the Gamemaster's
// module is sent it: whether the game takes removals now, and whether the item is on the sheet as
// last sent, with as many of it as the page showed. The module checks it all again, live, in the
// game; these checks only spare a player a removal the game would refuse.

/** Why a removal can't go to the game, as these checks say. */
export type RemovalRefusal = Extract<
  RollRefusal,
  'unknown' | 'gone' | 'short' | 'changed'
>

/**
 * Whether the game removes a campaign's characters' items now: its module says it does, and is
 * fetching, as `transfersAvailable` reads it of moves.
 */
export function removalsAvailable(
  campaign: { removalsEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  const polled = campaign.bridgePolledAt?.getTime()
  return (
    campaign.removalsEnabled === true &&
    !!polled &&
    now - polled < BRIDGE_POLLED_WITHIN
  )
}

/**
 * Whether what's removed is on the character's sheet, as last sent: the item, anywhere on it, with
 * at least as many of it as asked, and as many as the page showed (`held`).
 */
export function checkRemoval(
  remove: RemoveInput,
  sheet: { inventory?: SheetInventory } | undefined,
): Extract<RemovalRefusal, 'gone' | 'short' | 'changed'> | undefined {
  if (!sheet?.inventory) return 'gone'
  const item = allItems(sheet).find(({ id }) => id === remove.item)
  if (!item) return 'gone'
  if (remove.quantity > item.quantity) return 'short'
  // Part of a stack is never taken for all of it, nor more taken than the page showed.
  if (item.quantity !== remove.held) return 'changed'
  return undefined
}

/**
 * The item, everything inside it at any depth, and every container it's inside, by id, as the sheet
 * has them: what a move or removal on its way mustn't touch. Empty where it isn't on the sheet.
 */
export function relatedItems(
  sheet: { inventory?: SheetInventory } | undefined,
  id: string,
): ReadonlySet<string> {
  const inventory = sheet?.inventory
  if (!inventory) return new Set()
  /** The item's chain of containers, outermost first, ending with it; undefined where it isn't. */
  const find = (
    items: (SheetItem | SheetContainer)[],
    above: string[],
  ): { item: SheetItem | SheetContainer; above: string[] } | undefined => {
    for (const item of items) {
      if (item.id === id) return { item, above }
      const contents = 'contents' in item ? (item.contents ?? []) : []
      const found = find(contents, [...above, item.id])
      if (found) return found
    }
    return undefined
  }
  const found = find(
    [
      ...inventory.sections.flatMap(section => section.items),
      ...inventory.containers,
    ],
    [],
  )
  if (!found) return new Set()
  return new Set([...found.above, ...within(found.item)])
}

/** The ids of an item and of everything it holds, however deep: of a secret's, none. */
function within(item: SheetItem | SheetContainer): string[] {
  const contents = 'contents' in item ? (item.contents ?? []) : []
  return [item.id, ...contents.flatMap(inner => within(inner))]
}
