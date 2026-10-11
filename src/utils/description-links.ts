import { ABILITIES, SKILLS, TOOLS } from '@/constants/dnd5e'
import { DAMAGE_TYPE } from '@/constants/sending-stone'

/*
 * The links in a description the app can act on, as the module marks them since 0.17.0: a saving
 * throw it asks for, damage or healing it deals, a roll of its own, and a condition it names; and
 * since 0.18.0, a check it asks for; and since 0.19.0, damage never rolled as a critical hit's, as
 * dnd5e's own link offers none, is marked so. The module sends each as a span with a class of its
 * own and what it means in data attributes:
 *
 *   <span class="ss-save roll" data-n="0" data-ability="dex" data-dc="15">DC 15 Dexterity</span>
 *   <span class="ss-damage roll" data-n="1" data-formulas="2d6&1d4" data-types="fire&cold|fire">…
 *   <span class="ss-roll roll" data-n="2" data-formula="1d6">1d6</span>
 *   <span class="ss-condition ref" data-condition="prone">Prone</span>
 *   <span class="ss-check roll" data-n="3" data-checks="skill:str:ath" data-dc="15">DC 15 Str…
 *
 * A link the game acts on has `data-n`, its place among them in that description, by which a roll
 * request names it with the description's hash; the game then reads it from its own copy, so what
 * a link asks for is never taken from the app. The same patterns check the spans where the server
 * keeps them and where the page draws them.
 */

/** The classes of the links the app acts on. */
export const LINK_CLASSES = [
  'ss-save',
  'ss-check',
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

/**
 * One way a check a description asks for may be made, as dnd5e's roll request card offers it: an
 * ability check, or a skill's or a tool's, each with the ability it's made with. That is the one
 * the description names, or else dnd5e's for the skill or tool, never the character's own.
 */
export type CheckOption = {
  type: 'check' | 'skill' | 'tool'
  /** dnd5e's id, such as "str". */
  ability: string
  /** The skill's or tool's key, such as "ath" or "thief"; none for an ability check. */
  key?: string
}

/**
 * A check a description asks for, such as "DC 15 Strength (Athletics) check". Module 0.18.0; never
 * a passive one, which is only text.
 */
export type CheckLink = {
  kind: 'check'
  n: number
  /**
   * At least one, each skill, tool or ability once; more for a choice, such as Strength
   * (Athletics) or Dexterity (Acrobatics).
   */
  checks: CheckOption[]
  /** Where the description says one. */
  dc?: number
  /** For a skill check made using a tool, as the 2024 rules have it: the tool's key. */
  usingTool?: string
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
  /**
   * Damage never rolled as a critical hit's, as dnd5e's own link offers none, such as a saving
   * throw's, or the game can't plan its dice, as a weapon's extra dice. Module 0.19.0.
   */
  critical?: false
}

/** A roll of a description's own, such as [[/r 1d4]]. */
export type RollLink = { kind: 'roll'; n: number; formula: string }

/** A condition a description names, such as Prone, by dnd5e's id. */
export type ConditionLink = { kind: 'condition'; condition: string }

export type DescriptionLink =
  SaveLink | CheckLink | DamageLink | RollLink | ConditionLink

/**
 * A link the game acts on, as found in a description: what it is, and whether it's in one of its
 * secrets, which only the Gamemaster and the character's owners read, so is never asked of the
 * table.
 */
export type FoundLink = {
  link: SaveLink | CheckLink | DamageLink | RollLink
  secret: boolean
}

/** A part's damage types: one, or several joined by | for a choice. */
const TYPES = String.raw`(?:[A-Za-z][\w-]{0,31}(?:\|[A-Za-z][\w-]{0,31}){0,9})`

/** One of dnd5e's abilities. */
const ABILITY = '(?:str|dex|con|int|wis|cha)'

/** A skill's or tool's key, as dnd5e's are. */
const KEY = String.raw`[A-Za-z][\w-]{0,31}`

/**
 * One way a check may be made: `check:<ability>`, `skill:<ability>:<skill>` or
 * `tool:<ability>:<tool>`.
 */
const CHECK = `(?:check:${ABILITY}|(?:skill|tool):${ABILITY}:${KEY})`

/** The most ways a check a description asks for may be made. */
export const MAX_CHECKS = 10

/** The data attributes each link may have, each with the pattern its value must match. */
export const LINK_ATTRIBUTES: Record<LinkClass, Record<string, RegExp>> = {
  'ss-save': {
    'data-n': /^(?:0|[1-9]\d?|1\d\d)$/,
    'data-ability':
      /^(?:str|dex|con|int|wis|cha)(?:\|(?:str|dex|con|int|wis|cha)){0,5}$/,
    'data-dc': /^[1-9]\d?$/,
    'data-type': /^concentration$/,
  },
  'ss-check': {
    'data-n': /^(?:0|[1-9]\d?|1\d\d)$/,
    // Its options joined by |, each its type, its ability and its skill or tool, joined by :.
    'data-checks': new RegExp(
      String.raw`^${CHECK}(?:\|${CHECK}){0,${MAX_CHECKS - 1}}$`,
    ),
    'data-dc': /^[1-9]\d?$/,
    'data-using-tool': new RegExp(`^${KEY}$`),
  },
  'ss-damage': {
    'data-n': /^(?:0|[1-9]\d?|1\d\d)$/,
    // Parts joined by &, each a formula of numbers, dice and signs.
    'data-formulas':
      /^[\d\sd+\-−*/().]{1,100}(?:&[\d\sd+\-−*/().]{1,100}){0,9}$/,
    // A part's types joined by |, the parts by &; a part may have none.
    'data-types': new RegExp(`^${TYPES}?(?:&${TYPES}?){0,9}$`),
    'data-healing': /^true$/,
    'data-critical': /^false$/,
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
  'ss-check': ['data-n', 'data-checks'],
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
    case 'ss-check': {
      return {
        kind: 'check',
        n,
        checks: checkOptions(kept['data-checks']),
        ...(kept['data-dc'] && { dc: Number(kept['data-dc']) }),
        ...(kept['data-using-tool'] && {
          usingTool: kept['data-using-tool'],
        }),
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
        ...(kept['data-critical'] === 'false' && { critical: false as const }),
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

/**
 * A check's options, from its `data-checks`, which its pattern has checked: each skill, tool or
 * ability once, the first kept, as the module keeps them, and the game finds them.
 */
function checkOptions(value: string): CheckOption[] {
  const seen = new Set<string>()
  return value.split('|').flatMap(each => {
    const [type, ability, key] = each.split(':') as [
      CheckOption['type'],
      string,
      string | undefined,
    ]
    const id = `${type}:${key ?? ability}`
    if (seen.has(id)) return []
    seen.add(id)
    return [{ type, ability, ...(key !== undefined && { key }) }]
  })
}

/**
 * What a check is called, as dnd5e's roll request card names it: such as "Strength", "Strength
 * (Athletics)" or "Dexterity (Thieves' Tools)".
 * @param name - The skill's or tool's name, where it's known better than dnd5e's own, as from the
 *   character's sheet; else dnd5e's, or else its key.
 */
export function checkName(option: CheckOption, name?: string): string {
  const ability = Object.hasOwn(ABILITIES, option.ability)
    ? ABILITIES[option.ability]
    : option.ability
  if (option.type === 'check' || option.key === undefined) return ability
  return `${ability} (${name || toolOrSkillName(option.type, option.key)})`
}

/** A skill's or tool's name, as dnd5e has it, or else its key. */
export function toolOrSkillName(type: 'skill' | 'tool', key: string): string {
  const names = type === 'skill' ? SKILLS : TOOLS
  return Object.hasOwn(names, key) ? names[key] : key
}

/**
 * What a check is, in words, from what its options are called: such as "DC 15 Strength
 * (Athletics) check", "Intelligence or Wisdom check", or "Dexterity (Sleight of Hand) check using
 * Thieves' Tools".
 * @param names - Each option's, as `checkName` calls it.
 * @param using - For a skill check made using a tool, the tool's name.
 */
export function checkTitle(
  names: string[],
  { dc, using }: { dc?: number; using?: string } = {},
): string {
  const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(names)
  const against = dc === undefined ? '' : `DC ${dc} `
  return `${against}${list} check${using ? ` using ${using}` : ''}`
}
