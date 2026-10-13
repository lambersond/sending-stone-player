import type {
  SheetAction,
  SheetUse,
  SheetUseTargets,
} from '@/types/sending-stone'

/**
 * Spells and features a player has used in the Gamemaster's game, other than attacks: whom they're
 * used at.
 */

/** The kinds of target a heal or a utility's own side: the player's allies, and them. */
const FRIENDLY = new Set(['ally', 'willing'])

/**
 * The most targets a use, or an area attack, takes when cast at a level: none for one used on its
 * user alone; the number it affects, and more for each level above its own where it says so, as
 * Bless; or any number.
 * @param targets - A use's targets, or an area attack's area.
 * @param spellLevel - The spell's own level; null for anything but a spell.
 * @param castAt - The level it's cast at.
 */
export function mostTargets(
  {
    self = false,
    count,
    perLevel,
  }: Partial<Pick<SheetUseTargets, 'self'>> &
    Pick<SheetUseTargets, 'count' | 'perLevel'>,
  spellLevel: number | null,
  castAt: number | null,
): number {
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
 * or everyone in an area? A use that affects no one, such as Action Surge, has none; nor has one
 * that enchants an item, whatever dnd5e says it affects, as it's used at no one.
 */
export function picksTargets(use: SheetUse): boolean {
  const { self, area, affects } = use.targets
  if (self || use.type === 'enchant') return false
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

/** The kinds of activity a range of Self makes at their user unless the player picks otherwise. */
const AT_SELF = new Set<SheetUse['type']>(['heal', 'utility'])

/**
 * Is a use's range Self, as a potion's or Wild Shape's: as the sheet says, from module 0.22.0;
 * before, as its action's range reads.
 */
export function fromSelf(action: Pick<SheetAction, 'range' | 'activity'>) {
  return (
    action.activity?.targets.fromSelf ??
    action.range?.trim().toLowerCase() === 'self'
  )
}

/**
 * Is a use made at its user unless the player picks otherwise: one used on its user alone, as
 * Second Wind; or healing or a utility whose range is Self, with no area, though it may take
 * another target, as a potion or Wild Shape. Never one that enchants, which is used at no one, nor
 * one that saves, deals damage or asks for a check, whose range of Self is where it starts from.
 */
export function selfDefault(
  action: Pick<SheetAction, 'range' | 'activity'>,
): boolean {
  const use = action.activity
  if (!use || use.type === 'enchant') return false
  if (use.targets.self) return true
  return fromSelf(action) && !use.targets.area && AT_SELF.has(use.type)
}

/**
 * May a use be made at its user, as Self among its targets: one made there by default, or one with
 * targets to pick that doesn't affect only enemies. An attack never is, as its range of Self is
 * where its area starts from.
 */
export function offersSelf(
  action: Pick<SheetAction, 'range' | 'activity'>,
): boolean {
  const use = action.activity
  if (!use) return false
  return (
    selfDefault(action) ||
    (picksTargets(use) && use.targets.affects !== 'enemy')
  )
}
