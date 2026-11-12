import { classLevels } from './class-line'
import { targetKey } from '@/utils/favorite-commands'
import type { FavoriteTarget } from '@/types/roll'
import type { FavoriteEntry, SheetFavorite } from '@/types/sending-stone'

// The character's favorites put in order from here (module 0.47.0): which the game puts in order,
// which of those the page moves, and where each is shown while an order is on its way.

/**
 * The favorites an order names: every one the sheet lists but its old-style resources, which dnd5e
 * lists first and keeps apart, in the sheet's order, as the game names them back.
 */
export function orderTargets(favorites: SheetFavorite[]): FavoriteTarget[] {
  return favorites.flatMap((favorite): FavoriteTarget[] => {
    switch (favorite.type) {
      case 'resource': {
        return []
      }
      case 'activity': {
        return [{ type: 'activity', id: favorite.id, item: favorite.itemId }]
      }
      default: {
        return [{ type: favorite.type, id: favorite.id }]
      }
    }
  })
}

/**
 * Whether a favorite shown may be moved: any but an old-style resource, or the feature one stands
 * for, whose place is the resource's, first.
 */
export function movable(entry: FavoriteEntry): boolean {
  if (entry.kind === 'resource') return false
  return !(
    (entry.kind === 'action' || entry.kind === 'feature') &&
    entry.resource
  )
}

/**
 * The favorites in a new order, by key: those the page moved, `shown`, take the places they held
 * among them all, in their new order; any it doesn't show keep theirs.
 */
export function placeShown(all: string[], shown: string[]): string[] {
  const moved = new Set(shown)
  let next = 0
  return all.map(key => (moved.has(key) ? shown[next++] : key))
}

/**
 * The favorites shown in an order, by key, such as one on its way: those that may move take it,
 * in the places movable ones hold; the rest, an old-style resource first, stay where they are.
 */
export function arrangeEntries(
  entries: FavoriteEntry[],
  order: string[],
): FavoriteEntry[] {
  const place = new Map(order.map((key, index) => [key, index]))
  const moves = (entry: FavoriteEntry) => movable(entry) && place.has(entry.key)
  const moving = entries
    .filter(entry => moves(entry))
    .toSorted((a, b) => (place.get(a.key) ?? 0) - (place.get(b.key) ?? 0))
  let next = 0
  return entries.map(entry => (moves(entry) ? moving[next++] : entry))
}

/** A favorite's name, as its row shows it, for what's said as it moves. */
export function entryName(entry: FavoriteEntry): string {
  switch (entry.kind) {
    case 'action': {
      return entry.action.name
    }
    case 'spell': {
      return entry.spell.name
    }
    case 'feature': {
      return entry.feature.name
    }
    case 'class': {
      return classLevels(entry.entry)
    }
    case 'effect': {
      return entry.effect.name
    }
    case 'check': {
      return entry.check.label
    }
    case 'slots': {
      return entry.slots.name
    }
    case 'resource': {
      return entry.resource.name
    }
    case 'item':
    case 'other': {
      return entry.item.name
    }
  }
}

/** The targets of these keys, as the sheet names them, in their order; none it doesn't name. */
export function targetsOf(
  keys: string[],
  targets: FavoriteTarget[],
): FavoriteTarget[] {
  const byKey = new Map(targets.map(target => [targetKey(target), target]))
  return keys.flatMap(key => byKey.get(key) ?? [])
}
