import { allItems } from '@/utils/sheet-texts'
import type {
  CharacterSheet,
  SheetEnchant,
  SheetEnchantment,
  SheetEnchantProfile,
  SheetUse,
} from '@/types/sending-stone'

/*
 * Enchant activities, as dnd5e uses them, such as Magic Weapon on a weapon of the character's, or a
 * Flame Tongue set alight, from module 0.21.0: the ways each may enchant, at the level it's cast
 * at, and what the character has for it to enchant.
 */

/** Something of the character's an enchantment may be put on, as the sheet lists it. */
export type Belonging = { name: string; img: string | null }

/** What an action is used through in the game, if it enchants: what it enchants, and how. */
export function enchantOf(
  use: SheetUse | null | undefined,
): SheetEnchant | undefined {
  return use?.type === 'enchant' ? use.enchant : undefined
}

/**
 * Is a way an enchant activity enchants offered at the spell level it's cast at: one with limits,
 * such as Magic Weapon's +2, from 4th level to 5th, within them; one without, at any level, or
 * none? None with limits is offered at no level, as for a spell whose level isn't known.
 */
export function offeredAt(
  profile: SheetEnchantProfile,
  level: number | null,
): boolean {
  if (profile.min === null && profile.max === null) return true
  if (level === null) return false
  return (
    (profile.min === null || level >= profile.min) &&
    (profile.max === null || level <= profile.max)
  )
}

/**
 * The ways an enchant activity may enchant now, at the level it's cast at, in dnd5e's order: but,
 * for one that enchants its own item, the way it's on it already, which using it again would only
 * end, as dnd5e does, for what using it costs.
 */
export function offeredProfiles(
  enchant: SheetEnchant,
  level: number | null,
): SheetEnchantProfile[] {
  const applied = new Set(
    enchant.self ? enchant.applied.map(({ profile }) => profile) : [],
  )
  return enchant.profiles.filter(
    profile => offeredAt(profile, level) && !applied.has(profile.id),
  )
}

/**
 * Is an enchant activity that enchants its own item on it already, in every way it may enchant, so
 * that there's nothing left to use it for but to end it, as Dagger of Venom's Coat Blade once the
 * blade is coated? Never for one that's a switch, nor one that enchants another item.
 */
export function allApplied(enchant: SheetEnchant): boolean {
  if (!enchant.self || enchant.toggle || enchant.applied.length === 0) {
    return false
  }
  const applied = new Set(enchant.applied.map(({ profile }) => profile))
  return enchant.profiles.every(({ id }) => applied.has(id))
}

/**
 * What the character has that an enchantment may be put on, by id, with its name and icon, for
 * choosing among them: its inventory's items, those in containers too, then its spells and
 * features, the first of each id kept.
 */
export function belongingsOf(
  sheet: Partial<Pick<CharacterSheet, 'inventory' | 'spells' | 'features'>>,
): ReadonlyMap<string, Belonging> {
  const belongings = new Map<string, Belonging>()
  const listed = [
    ...allItems(sheet),
    ...(sheet.spells ?? []).flatMap(section => section.spells),
    ...(sheet.features ?? []).flatMap(section => section.features),
  ]
  for (const { id, name, img } of listed) {
    if (!belongings.has(id)) belongings.set(id, { name, img })
  }
  return belongings
}

/**
 * What to say of an enchantment on an item, after its name: that it lasts while its caster
 * concentrates, the time it has left, or that its time has run out, and what put it there, such as
 * "Concentration · 1 Hour · from Magic Weapon".
 */
export function enchantmentParts(
  enchantment: SheetEnchantment,
): (string | false | null)[] {
  return [
    enchantment.concentration && 'Concentration',
    enchantment.expired ? 'Expired' : enchantment.duration,
    enchantment.source && `from ${enchantment.source}`,
  ]
}
