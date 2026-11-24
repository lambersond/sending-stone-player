import { offeredAt } from '@/features/sheet/utils/enchantments'
import type {
  SheetSummon,
  SheetSummonLabel,
  SheetSummonProfile,
  SheetUse,
} from '@/types/sending-stone'

/*
 * Summon activities, as dnd5e casts them, such as Find Familiar or Conjure Animals, from module
 * 0.54.0: the creatures each may summon at the level it's cast at, written as dnd5e's usage dialog
 * writes them there, which the Gamemaster places in Foundry from the card.
 */

/** A creature as dnd5e's dialog writes it at a level: its name, and the number before it. */
type Written = Pick<SheetSummonLabel, 'name' | 'count'>

/** What an action is used through in the game, if it summons: the creatures it may summon. */
export function summonOf(
  use: SheetUse | null | undefined,
): SheetSummon | undefined {
  return use?.type === 'summon' ? use.summon : undefined
}

/**
 * The creatures a summon activity may summon at the spell level it's cast at, in dnd5e's order:
 * one offered only from a level on, as Summon Beast's Air from the 3rd, there and above.
 */
export function offeredSummons(
  summon: SheetSummon,
  level: number | null,
): SheetSummonProfile[] {
  return summon.profiles.filter(profile => offeredAt(profile, level))
}

/**
 * How dnd5e's dialog writes a creature at a level: as it says it does there, for one written
 * otherwise above the spell's own level, as Conjure Animals' "4 × CR 1" at the 5th; else as at the
 * spell's own.
 */
export function labelAt(
  profile: SheetSummonProfile,
  level: number | null,
): Written {
  const { name, count } =
    profile.higher.find(each => each.level === level) ?? profile
  return { name, count }
}

/** A creature's words: "2 × Wolf", or the name alone where dnd5e writes no number. */
function written({ name, count }: Written): string {
  return count ? `${count} × ${name}` : name
}

/**
 * The creatures offered at a level as dnd5e's dialog labels them there: "<count> × <name>", or the
 * name, with "1 × " dropped where every one would start with it.
 */
export function summonLabels(
  profiles: SheetSummonProfile[],
  level: number | null,
): string[] {
  const labels = profiles.map(profile => written(labelAt(profile, level)))
  return labels.every(label => label.startsWith('1 × '))
    ? labels.map(label => label.replace('1 × ', ''))
    : labels
}

/**
 * A creature's label as a screen reader is told it, without the "×": "Owl"; "Wolf, 2 of them";
 * "Wolf, 1d4 of them". The name alone for one, or for no number.
 */
export function summonAria({ name, count }: Written): string {
  return count && count !== '1' ? `${name}, ${count} of them` : name
}

/**
 * Whether what a creature cast at a level summons is one creature, or more, as the tray says of
 * what the Gamemaster places: more where dnd5e writes a number other than one, as "2" or "1d4".
 */
export function placingOf(
  profile: SheetSummonProfile,
  level: number | null,
): 'one' | 'many' {
  const { count } = labelAt(profile, level)
  return count && count !== '1' ? 'many' : 'one'
}
