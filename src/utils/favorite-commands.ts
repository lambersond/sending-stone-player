import { BRIDGE_POLLED_WITHIN } from '@/constants/sending-stone'
import { favoriteIndex } from '@/utils/favorites'
import type { FavoriteInput, FavoriteTarget } from '@/types/roll'
import type { CharacterSheet, SheetFavorite } from '@/types/sending-stone'

// How this app reads a favorite added to or removed from a character's (module 0.37.0) before the
// Gamemaster's module is sent it: whether the game takes them now, what a favorite is keyed by,
// whether the character has it, and whether what's added is on the sheet as last sent. The module
// checks it all again, live, in the game; these checks only spare a player one the game would
// refuse.

/**
 * Whether the game adds and removes a campaign's characters' favorites now: its module says it
 * does, and is fetching, as `removalsAvailable` reads it of removals.
 */
export function favoritesAvailable(
  campaign: { favoritesEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  const polled = campaign.bridgePolledAt?.getTime()
  return (
    campaign.favoritesEnabled === true &&
    !!polled &&
    now - polled < BRIDGE_POLLED_WITHIN
  )
}

/**
 * A favorite's key, as the favorites' entries have it: "activity:<itemId>.<id>" for one of an
 * item's activities, as two items may hold activities of one id, else "<type>:<id>".
 */
export function targetKey(target: FavoriteTarget): string {
  return target.type === 'activity'
    ? `activity:${target.item}.${target.id}`
    : `${target.type}:${target.id}`
}

/**
 * Whether it's one of the character's favorites, as the sheet lists them: one of that type and id;
 * for an activity, one whose item is the target's too.
 */
export function isFavorite(
  target: FavoriteTarget,
  favorites: SheetFavorite[],
): boolean {
  return favorites.some(favorite =>
    target.type === 'activity'
      ? favorite.type === 'activity' &&
        favorite.id === target.id &&
        favorite.itemId === target.item
      : favorite.type === target.type && favorite.id === target.id,
  )
}

/**
 * Whether what's added is on the character's sheet, as last sent: an item, or an activity's item,
 * among its actions, spells, inventory at any depth, features or classes; an effect among its
 * effects; a skill among its skills. A tool or spell slots aren't checked here: the game does. A
 * Remove is never refused here, as a favorite of something gone can go.
 */
export function checkFavorite(
  favorite: FavoriteInput,
  sheet?: Pick<
    CharacterSheet,
    | 'actions'
    | 'spells'
    | 'inventory'
    | 'features'
    | 'classes'
    | 'effects'
    | 'skills'
  >,
): 'gone' | undefined {
  if (favorite.op === 'remove') return undefined
  if (!sheet) return 'gone'
  const index = favoriteIndex(sheet)
  switch (favorite.type) {
    case 'item':
    case 'activity': {
      const id = favorite.type === 'activity' ? favorite.item : favorite.id
      const listed =
        index.actions.has(id) ||
        index.spells.has(id) ||
        index.items.has(id) ||
        index.features.has(id) ||
        index.classes.has(id)
      return listed ? undefined : 'gone'
    }
    case 'effect': {
      return index.effects.has(favorite.id) ? undefined : 'gone'
    }
    case 'skill': {
      return index.skills.has(favorite.id) ? undefined : 'gone'
    }
    default: {
      return undefined
    }
  }
}
