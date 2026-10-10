import { ABILITIES } from '@/constants/dnd5e'
import { DAMAGE_TYPE } from '@/constants/sending-stone'

/*
 * The links in a description the app can act on, as the module marks them since 0.17.0: a saving
 * throw it asks for, damage or healing it deals, a roll of its own, and a condition it names.
 * The module sends each as a span with a class of its own and what it means in data attributes:
 *
 *   <span class="ss-save roll" data-n="0" data-ability="dex" data-dc="15">DC 15 Dexterity</span>
 *   <span class="ss-damage roll" data-n="1" data-formulas="2d6&1d4" data-types="fire&cold|fire">…
 *   <span class="ss-roll roll" data-n="2" data-formula="1d6">1d6</span>
 *   <span class="ss-condition ref" data-condition="prone">Prone</span>
 *
 * A link the game acts on has `data-n`, its place among them in that description, by which a roll
 * request names it with the description's hash; the game then reads it from its own copy, so what
 * a link asks for is never taken from the app. The same patterns check the spans where the server
 * keeps them and where the page draws them.
 */

/** The classes of the links the app acts on. */
export const LINK_CLASSES = [
  'ss-save',
  'ss-damage',
  'ss-roll',
  'ss-condition',
] as const

export type LinkClass = (typeof LINK_CLASSES)[number]

/** The most links a description has that the game acts on, numbered from 0. */
export const MAX_LINKS = 200

/** A saving throw a description asks for, such as "DC 15 Dexterity saving throw". */
export type SaveLink = {
  kind: 'save'
  n: number
  /**
   * Ability ids, more than one for a choice, such as Strength or Dexterity; at least one, which
   * for a concentration check that names none is Constitution.
   */
  abilities: string[]
  /** Where the description says one. */
  dc?: number
  /** A concentration check, which is a Constitution saving throw. */
  concentration: boolean
}

/** Damage or healing a description deals, in one part or more, such as 1d6 fire plus 1d6 cold. */
export type DamageLink = {
  kind: 'damage'
  n: number
  parts: {
    formula: string
    /** dnd5e damage type ids, more than one for a choice; none where it doesn't say. */
    types: string[]
  }[]
  healing: boolean
}

/** A roll of a description's own, such as [[/r 1d4]]. */
export type RollLink = { kind: 'roll'; n: number; formula: string }

/** A condition a description names, such as Prone, by dnd5e's id. */
export type ConditionLink = { kind: 'condition'; condition: string }

export type DescriptionLink = SaveLink | DamageLink | RollLink | ConditionLink

/**
 * A link the game acts on, as found in a description: what it is, and whether it's in one of its
 * secrets, which only the Gamemaster and the character's owners read, so is never asked of the
 * table.
 */
export type FoundLink = {
  link: SaveLink | DamageLink | RollLink
  secret: boolean
}

/** A part's damage types: one, or several joined by | for a choice. */
const TYPES = String.raw`(?:[A-Za-z][\w-]{0,31}(?:\|[A-Za-z][\w-]{0,31}){0,9})`

/** The data attributes each link may have, each with the pattern its value must match. */
export const LINK_ATTRIBUTES: Record<LinkClass, Record<string, RegExp>> = {
  'ss-save': {
    'data-n': /^(?:0|[1-9]\d?|1\d\d)$/,
    'data-ability':
      /^(?:str|dex|con|int|wis|cha)(?:\|(?:str|dex|con|int|wis|cha)){0,5}$/,
    'data-dc': /^[1-9]\d?$/,
    'data-type': /^concentration$/,
  },
  'ss-damage': {
    'data-n': /^(?:0|[1-9]\d?|1\d\d)$/,
    // Parts joined by &, each a formula of numbers, dice and signs.
    'data-formulas':
      /^[\d\sd+\-−*/().]{1,100}(?:&[\d\sd+\-−*/().]{1,100}){0,9}$/,
    // A part's types joined by |, the parts by &; a part may have none.
    'data-types': new RegExp(`^${TYPES}?(?:&${TYPES}?){0,9}$`),
    'data-healing': /^true$/,
  },
  'ss-roll': {
    'data-n': /^(?:0|[1-9]\d?|1\d\d)$/,
    'data-formula': /^[\d\sd+\-−*/().]{1,100}$/,
  },
  'ss-condition': {
    'data-condition': /^[a-z][a-z-]{1,31}$/,
  },
}

/**
 * What each link must have to mean anything. A concentration check may name no ability, as dnd5e's
 * own `[[/concentration]]` doesn't: it's then rolled with Constitution.
 */
const REQUIRED: Record<LinkClass, string[]> = {
  'ss-save': ['data-n', 'data-ability'],
  'ss-damage': ['data-n', 'data-formulas'],
  'ss-roll': ['data-n', 'data-formula'],
  'ss-condition': ['data-condition'],
}

/** The ability a concentration check that names none is rolled with, as dnd5e's default. */
const CONCENTRATION_ABILITY = 'con'

/** Which link a class list names, if any. */
export function linkClassOf(
  className: string | undefined,
): LinkClass | undefined {
  const classes = new Set((className ?? '').split(/\s+/))
  return LINK_CLASSES.find(name => classes.has(name))
}

/**
 * A link's attributes as they may be kept: only those of its kind, each matching its pattern; none
 * where one it needs is missing or wrong, as then it's only text.
 */
export function linkAttributes(
  name: LinkClass,
  attribs: Record<string, string | undefined>,
): Record<string, string> | undefined {
  const kept: Record<string, string> = {}
  for (const [attribute, pattern] of Object.entries(LINK_ATTRIBUTES[name])) {
    const value = attribs[attribute]
    if (value !== undefined && pattern.test(value)) kept[attribute] = value
  }
  const required =
    name === 'ss-save' && kept['data-type'] === 'concentration'
      ? ['data-n']
      : REQUIRED[name]
  return required.every(attribute => attribute in kept) ? kept : undefined
}

/**
 * What a span in a description means, from its class and data attributes, as the module marks it;
 * none for anything else, or for a link whose attributes don't hold up.
 */
export function linkOf(
  attribs: Record<string, string | undefined>,
): DescriptionLink | undefined {
  const name = linkClassOf(attribs.class)
  if (!name) return
  const kept = linkAttributes(name, attribs)
  if (!kept) return
  const n = Number(kept['data-n'])
  switch (name) {
    case 'ss-save': {
      const abilities = kept['data-ability']
        ? [...new Set(kept['data-ability'].split('|'))]
        : [CONCENTRATION_ABILITY]
      if (!abilities.every(id => Object.hasOwn(ABILITIES, id))) return
      return {
        kind: 'save',
        n,
        abilities,
        ...(kept['data-dc'] && { dc: Number(kept['data-dc']) }),
        concentration: kept['data-type'] === 'concentration',
      }
    }
    case 'ss-damage': {
      const formulas = kept['data-formulas'].split('&')
      const types = (kept['data-types'] ?? '').split('&')
      return {
        kind: 'damage',
        n,
        parts: formulas.map((formula, index) => ({
          formula: formula.trim(),
          types: (types[index] ?? '')
            .split('|')
            .filter(type => DAMAGE_TYPE.test(type)),
        })),
        healing: kept['data-healing'] === 'true',
      }
    }
    case 'ss-roll': {
      return { kind: 'roll', n, formula: kept['data-formula'].trim() }
    }
    case 'ss-condition': {
      return { kind: 'condition', condition: kept['data-condition'] }
    }
  }
}
