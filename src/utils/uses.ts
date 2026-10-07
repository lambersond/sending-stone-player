import type { SheetUse } from '@/types/sending-stone'

/**
 * Spells and features a player has used in the Gamemaster's game, other than attacks: whom they're
 * used at.
 */

/** The kinds of target a heal or a utility's own side: the player's allies, and them. */
const FRIENDLY = new Set(['ally', 'willing'])

/**
 * The most targets a use takes when cast at a level: none for one used on its user alone; the
 * number it affects, and more for each level above its own where it says so, as Bless; or any
 * number.
 * @param spellLevel - The spell's own level; null for anything but a spell.
 * @param castAt - The level it's cast at.
 */
export function mostTargets(
  use: SheetUse,
  spellLevel: number | null,
  castAt: number | null,
): number {
  const { self, count, perLevel } = use.targets
  if (self) return 0
  if (count === null) return Number.POSITIVE_INFINITY
  const above =
    spellLevel !== null && castAt !== null
      ? Math.max(0, castAt - spellLevel)
      : 0
  return count + (perLevel ?? 0) * above
}

/**
 * Does a use have targets to pick: not one used on its user alone, and one that affects someone,
 * or everyone in an area? A use that affects no one, such as Action Surge, has none.
 */
export function picksTargets(use: SheetUse): boolean {
  const { self, area, affects } = use.targets
  if (self) return false
  return area || (affects !== null && !['object', 'space'].includes(affects))
}

/**
 * Is a use made at its user's side, so that its targets are picked from them and their allies:
 * healing, or one that affects allies or the willing?
 */
export function friendly(use: SheetUse): boolean {
  return (
    use.type === 'heal' ||
    FRIENDLY.has(use.targets.affects ?? '') ||
    (use.type === 'utility' && use.targets.affects === null)
  )
}
