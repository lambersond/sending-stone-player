import { z } from 'zod'
import {
  MOST_KEPT_CHANGE_BYTES,
  MOST_KEPT_CHANGE_KEYS,
} from '@/constants/cookbook'
import type { CookbookDishBody } from '@/types/cookbook'

// A dish from the Magical Recipe Book, as its server posts it, version 1, from module 0.38.0. It
// refuses only what this app or the module acts on and the bounds of the cookbook's seeded text:
// a string a cookbook player controls is kept or cut, never a refusal they can't fix. Unknown keys
// are stripped, as the cookbook may add fields within version 1, so this app stays the gate for
// what reaches Foundry.

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const SKILLS = [
  'acr',
  'ani',
  'arc',
  'ath',
  'dec',
  'his',
  'ins',
  'itm',
  'inv',
  'med',
  'nat',
  'prc',
  'prf',
  'per',
  'rel',
  'slt',
  'ste',
  'sur',
] as const
const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const
const CONDITIONS = [
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious',
] as const
const SENSES = ['blindsight', 'darkvision', 'tremorsense', 'truesight'] as const
const MODES = ['advantage', 'disadvantage'] as const
const BONUS_ROLLS = ['attack', 'damage', 'check', 'save'] as const

/** A rolled maximum's dice, as the cookbook checks them: such as `3+1d6`. */
const DICE = /^(\d+\+)?\d*d\d+(\+\d+)?$/

/** An integer from -10 to 10, never 0. */
const modifier = z
  .number()
  .int()
  .min(-10)
  .max(10)
  .refine(value => value !== 0)

/** Text of at most `max` characters, refused beyond. */
const text = (max: number) => z.string().max(max)

/**
 * Text kept, cut to `max` characters, and well formed again: the cut may split a surrogate pair,
 * whose half Postgres can't store, failing the dish's every insert (as the POST's reviver rules).
 */
const shown = (max: number) =>
  z.string().transform(value => value.slice(0, max).toWellFormed())

/** The kinds this app validates; the tests use it. */
export const KNOWN_CHANGES = [
  'abilityScore',
  'rollMode',
  'rollBonus',
  'maxHitPoints',
  'damageResistance',
  'damageVulnerability',
  'conditionImmunity',
  'sense',
  'exhaustion',
] as const

const knownChange = z.union([
  z.object({
    type: z.literal('abilityScore'),
    ability: z.enum(ABILITIES),
    value: modifier,
  }),
  z.object({
    type: z.literal('rollMode'),
    roll: z.enum(['check', 'save']),
    ability: z.enum(ABILITIES),
    mode: z.enum(MODES),
  }),
  z.object({
    type: z.literal('rollMode'),
    roll: z.literal('skill'),
    skill: z.enum(SKILLS),
    mode: z.enum(MODES),
  }),
  z.object({
    type: z.literal('rollBonus'),
    roll: z.enum(BONUS_ROLLS),
    value: modifier,
  }),
  // Flat: -10..10, never 0, no formula. Rolled: the signed total, with its formula.
  z
    .object({
      type: z.literal('maxHitPoints'),
      value: z.number().int().min(-1000).max(1000),
      formula: z.string().max(32).regex(DICE).optional(),
    })
    .refine(
      change =>
        change.formula !== undefined ||
        (change.value !== 0 && Math.abs(change.value) <= 10),
    ),
  z.object({
    type: z.literal('damageResistance'),
    damageType: z.enum(DAMAGE_TYPES),
  }),
  z.object({
    type: z.literal('damageVulnerability'),
    damageType: z.enum(DAMAGE_TYPES),
  }),
  z.object({
    type: z.literal('conditionImmunity'),
    condition: z.enum(CONDITIONS),
  }),
  z.object({
    type: z.literal('sense'),
    sense: z.enum(SENSES),
    range: z.number().int().positive().max(5280),
  }),
  z.object({
    type: z.literal('exhaustion'),
    levels: z.number().int().min(1).max(6),
  }),
])

// Any other change with a well-formed type is kept exactly as sent, for the module to show and
// skip: a kind this app doesn't know, or a known kind whose fields it doesn't recognise. Bounded
// (round 0.38.0), so a hand-made body can't keep a change of any size: no cookbook change comes
// near it.
const keptChange = z
  .looseObject({ type: z.string().regex(/^[A-Za-z]\w{0,63}$/) })
  .refine(
    change =>
      Object.keys(change).length <= MOST_KEPT_CHANGE_KEYS &&
      JSON.stringify(change).length <= MOST_KEPT_CHANGE_BYTES,
    { message: 'A change this app doesn’t know is too large to keep' },
  )

const change = z.union([knownChange, keptChange])

/**
 * A dish as the cookbook's server posts it. Its version is checked before this parse, so another
 * number is told apart from a body that can't be read.
 */
export const cookbookDishSchema: z.ZodType<CookbookDishBody> = z
  .object({
    version: z.literal(1),
    dish: z.object({
      // A cuid in the cookbook.
      id: z.string().regex(/^[\w-]{1,64}$/),
      recipe: text(200).min(1),
      // Stored, never acted on: the cookbook keeps whatever the browser posted.
      status: z.string().min(1).max(32),
      outcome: z.enum(['boon', 'bane', 'standard']),
      cookedOnDay: z.number().int(),
      consumedOnDay: z.number().int().nullable(),
    }),
    // The cookbook cuts it to 100; a body made by hand may not.
    cook: z.object({ name: shown(200) }),
    // May be "".
    message: text(4000),
    effect: z
      .object({
        name: text(300).min(1),
        ingredients: z
          .array(z.object({ name: text(200), text: text(2000) }))
          .max(20),
        duration: z.object({
          seconds: z.number().int().positive().max(604_800),
        }),
        stacks: z.literal(false),
        changes: z.array(change).max(100),
      })
      .nullable(),
  })
  .refine(
    body => (body.effect === null) === (body.dish.outcome === 'standard'),
    {
      path: ['effect'],
    },
  )
