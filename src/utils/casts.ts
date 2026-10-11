/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { castAtLevel as levelCastAt } from '@/utils/action-groups'
import { allItems } from '@/utils/sheet-texts'
import type {
  CharacterSheet,
  SheetAction,
  SheetActivity,
  SheetCast,
  SheetSpellSection,
} from '@/types/sending-stone'

/*
 * How a spell an item casts is cast, such as a wand's Magic Missile, wherever the sheet lists the
 * spell or one of its activities: the item's Cast, by which the app has it cast from the item, and
 * the copy of the spell the Spells tab lists under the item, by which each of the spell's
 * activities is used after it's cast, such as Hex's Bonus Hex Damage. Each is cast at the levels
 * the Cast offers, from module 0.20.0, as the server checks and the use picker offers them.
 */

/** How each spell an item casts is cast, by the id of the copy of it the Spells tab lists. */
export type CastIndex = ReadonlyMap<string, SheetCast>

/** The parts of the sheet a Cast is listed in. */
type CastingSheet = Pick<
  CharacterSheet,
  'actions' | 'inventory' | 'features' | 'favorites'
>

/** Something that may be a Cast, with what its spell's copy is. */
type MaybeCast = Partial<Pick<SheetActivity, 'cast' | 'spellId'>>

/**
 * How each spell an item casts is cast, by its copy's id: the first Cast of it the sheet lists,
 * with how it's cast, among its actions and their activities, its inventory's items and theirs,
 * its features and theirs, and its favorite activities. None for one cast through nothing the app
 * can say, such as a summoning, as no Cast says how.
 */
export function castIndex(sheet: CastingSheet): CastIndex {
  const casts = new Map<string, SheetCast>()
  const add = (entry: MaybeCast) => {
    const { cast, spellId } = entry
    if (cast && spellId && !casts.has(spellId)) casts.set(spellId, cast)
  }
  const listed: (MaybeCast & { activities?: SheetActivity[] })[] = [
    ...sheet.actions.flatMap(section => section.actions),
    ...allItems(sheet),
    ...sheet.features.flatMap(section => section.features),
  ]
  for (const entry of listed) {
    add(entry)
    for (const activity of entry.activities ?? []) add(activity)
  }
  for (const favorite of sheet.favorites) {
    if (favorite.type === 'activity') add(favorite)
  }
  return casts
}

/**
 * How a spell an item casts is cast, for an action that casts it: the Cast's own, or for the copy
 * of the spell the Spells tab lists under the item, and each of its activities, the item's Cast
 * of it, while the item can cast it. One of its activities used after it's cast without spending
 * anything, such as Hex's Bonus Hex Damage, spends none of the item's uses at any level, nor is it
 * ever short of them. Nothing for anything else.
 */
export function castOf(
  action: SheetAction,
  casts: CastIndex,
): SheetCast | undefined {
  const cast =
    action.cast ??
    (action.type === 'spell' &&
    action.castFrom &&
    action.castFrom.usable !== false
      ? casts.get(action.id)
      : undefined)
  if (!cast) return undefined
  if (action.consumesSlot !== false) return cast
  return {
    ...cast,
    charges: null,
    short: false,
    ...(cast.levels && {
      levels: cast.levels.map(level => ({
        ...level,
        charges: null,
        short: false,
      })),
    }),
  }
}

/**
 * Whether an action casts a spell from an item, or is one of its activities, such as a wand's
 * Magic Missile, its copy on the Spells tab, or Hex's Bonus Hex Damage under the Cast that casts
 * it: it's cast at a level the item offers, not with a spell slot.
 */
export function isItemCast(action: SheetAction): boolean {
  return Boolean(action.cast ?? action.castFrom)
}

/**
 * The level a spell is cast at: for one an item casts, the level chosen, or else the one it's cast
 * at by default; for any other, as its slots make it.
 */
export function castAtLevel(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  slot: string | null | undefined,
  casts: CastIndex,
): number | null {
  const cast = castOf(action, casts)
  if (!cast) return levelCastAt(action, spellbook, slot)
  return slot ? Number(slot.slice(5)) : cast.level
}
