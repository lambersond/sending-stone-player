import { ABILITIES, SKILLS } from '@/constants/dnd5e'
import { ownName } from '@/utils/own-name'
import type { GameNames } from '@/types/sending-stone'

/*
 * The game's abilities and skills, by their keys and by its names for them: any it has, dnd5e's
 * Honor and Sanity where its settings turn them on, and a world's own, each named as the
 * character's sheet names it, in the game's language. dnd5e's English six and 18 only where no
 * sheet is at hand to say, and then the key.
 */

/** An ability's key, as dnd5e's and a world's own are, and as a skill's is. */
export const ABILITY_KEY = /^[A-Za-z][\w-]{0,31}$/

/**
 * Is this an ability's key, any the game may have, and not a name every object answers to, such as
 * `constructor`? Which abilities a character has is its sheet's to say.
 */
export function isAbilityKey(id: unknown): id is string {
  return (
    typeof id === 'string' && ABILITY_KEY.test(id) && !(id in Object.prototype)
  )
}

/**
 * The game's names for its abilities and skills, as a character's sheet has them, a blank one left
 * to dnd5e's English; with no sheet, dnd5e's English six and 18.
 */
export function gameNames(sheet?: {
  abilities: { id: string; label: string; abbreviation?: string }[]
  skills: { id: string; label: string }[]
}): GameNames {
  const abilities = sheet?.abilities ?? []
  const skills = sheet?.skills ?? []
  return {
    abilities: {
      ...ABILITIES,
      ...Object.fromEntries(named(abilities, ability => ability.label)),
    },
    abbreviations: Object.fromEntries(
      named(abilities, ability => ability.abbreviation),
    ),
    skills: {
      ...SKILLS,
      ...Object.fromEntries(named(skills, skill => skill.label)),
    },
  }
}

/** dnd5e's English names, for where no sheet names them. */
export const DND5E_NAMES: GameNames = gameNames()

/** Each row's id with its name, as `nameOf` reads it, those with none left out. */
function named<T extends { id: string }>(
  rows: T[],
  nameOf: (row: T) => string | undefined,
): [string, string][] {
  return rows.flatMap(row => {
    const name = nameOf(row)?.trim()
    return name ? [[row.id, name]] : []
  })
}

/** An ability's name, such as "Strength", "Honor" or "Sagesse"; or else its key. */
export function abilityName(names: GameNames, id: string): string {
  return ownName(names.abilities, id) ?? id
}

/** A skill's name, such as "Athletics" or "Etiquette"; or else its key. */
export function skillName(names: GameNames, id: string): string {
  return ownName(names.skills, id) ?? id
}

/**
 * An ability's abbreviation, as the sheet's grid shows it, such as "dex" or "SAG"; or else its key.
 */
export function abilityAbbreviation(names: GameNames, id: string): string {
  return ownName(names.abbreviations, id) ?? id
}
