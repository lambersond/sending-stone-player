import { DIE_SIDES } from '@lambersond/3d-dice-core'
import { z } from 'zod'
import {
  ATTACK_MODE,
  DAMAGE_TYPE,
  HIT_DIE,
  MAX_DAMAGE_TERMS,
  MAX_USE_TARGETS,
  PROMPT_ID,
  PROTOCOL_VERSION,
  ROLL_KINDS,
  SPELL_SLOT,
} from '@/constants/sending-stone'
import { TEXT_HASH } from '@/schemas/sending-stone'
import { DIE_SIZES, MOST_DICE } from '@/utils/damage-modifiers'
import { MAX_LINKS } from '@/utils/description-links'
import { MAX_DICE, MAX_FLAT, type ExtraTerm } from '@/utils/roll-modifiers'
import type { RollRequestInput } from '@/types/roll'

/** The most terms a player may add to one roll. */
export const MAX_EXTRAS = 10

/** A skill's, tool's or ability's key, such as "prc", "thief" or "str". */
const KEY = /^[\w.:-]{1,64}$/

/** A Foundry document's id. */
const FOUNDRY_ID = /^[\dA-Za-z]{1,64}$/

/** A roll request's id, as this app gives it. */
const REQUEST_ID = /^[\w-]{1,64}$/

/** What is asked for by a link in a description, and only by one. */
const FROM_TEXT = new Set(['ask', 'textDamage', 'textRoll'])

/**
 * What may be asked for by a link in a description, or not: a saving throw, or from module 0.18.0
 * a check, the player's own.
 */
const LINKABLE = new Set(['save', 'skill', 'tool', 'ability'])

const sign = z.union([z.literal(1), z.literal(-1)])

/** A term the player added, as the app's Modify roll reads it: dice, or a number. */
const extraTermSchema = z.union([
  z.strictObject({
    sign,
    count: z.int().min(1).max(MAX_DICE),
    sides: z
      .int()
      .refine(sides => (DIE_SIDES as readonly number[]).includes(sides)),
  }),
  z.strictObject({ sign, flat: z.int().min(0).max(MAX_FLAT) }),
])

/** A combatant picked, in a combat its player sees. */
const targetSchema = z.strictObject({
  combatId: z.string().regex(FOUNDRY_ID),
  combatantId: z.string().regex(FOUNDRY_ID),
})

/** How a player changed damage: more of its first die, another size of it, its highest. */
const modifiersSchema = z.strictObject({
  extra: z.int().min(0).max(MOST_DICE).optional(),
  faces: z
    .int()
    .refine(faces => (DIE_SIZES as readonly number[]).includes(faces))
    .optional(),
  maximize: z.boolean().optional(),
})

const rolledDiceSchema = z.strictObject({
  faces: z.int().min(2).max(100),
  results: z
    .array(z.int())
    .min(1)
    .max(MAX_DICE * 2),
})

/**
 * A roll a player asks to have made in the Gamemaster's game, with the dice they rolled. The dice
 * must be exactly those the roll throws: its d20, or two of them with advantage or disadvantage,
 * then the dice of each term added, in order, each result one of the die's faces. The game uses
 * them as they are, so no more could be slipped in. An attack names the item and attack activity
 * it's made with, the combatant it's made at, if any, or for an area attack those in its area, and
 * the spell slot, ammunition and attack mode chosen, if any. A use of a spell or feature names its
 * item and activity, the combatants it's used at, all in one combat, and the spell slot chosen, if
 * any, and throws no dice. Their damage
 * names the attack or use, the dice it said its damage throws, which are checked against them when
 * it's taken, and the kinds of damage chosen; and how the player changed it, if they did, its dice
 * then changed so. A saving throw the game asked for names the prompt it answers; a saving throw
 * or check a description calls for may name its link. A hit die names its size, and throws its one
 * die; a feature's own formula names its item and activity, and throws the dice its formula does,
 * which are checked against it when it's asked for.
 */
export const rollRequestSchema = z
  .strictObject({
    kind: z.enum(ROLL_KINDS),
    key: z.string().regex(KEY).optional(),
    mode: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    explicit: z.boolean(),
    extras: z.array(extraTermSchema).max(MAX_EXTRAS),
    dice: z.array(rolledDiceSchema).max(MAX_DAMAGE_TERMS),
    combatId: z.string().regex(FOUNDRY_ID).optional(),
    item: z.string().regex(FOUNDRY_ID).optional(),
    activity: z.string().regex(FOUNDRY_ID).optional(),
    target: targetSchema.nullable().optional(),
    targets: z.array(targetSchema).max(MAX_USE_TARGETS).optional(),
    slot: z.string().regex(SPELL_SLOT).nullable().optional(),
    ammunition: z.string().regex(FOUNDRY_ID).optional(),
    attackMode: z.string().regex(ATTACK_MODE).optional(),
    use: z.string().regex(REQUEST_ID).optional(),
    types: z
      .array(z.string().regex(DAMAGE_TYPE).nullable())
      .max(MAX_DAMAGE_TERMS)
      .optional(),
    modifiers: modifiersSchema.optional(),
    prompt: z.string().regex(PROMPT_ID).optional(),
    denomination: z.string().regex(HIT_DIE).optional(),
    text: z.string().regex(TEXT_HASH).optional(),
    link: z
      .int()
      .min(0)
      .max(MAX_LINKS - 1)
      .optional(),
  })
  .superRefine((request, context) => {
    const attack = request.kind === 'attack'
    const use = request.kind === 'use'
    const formula = request.kind === 'formula'
    const hitDie = request.kind === 'hitDie'
    const named = request.item !== undefined || request.activity !== undefined
    const both = request.item !== undefined && request.activity !== undefined
    if (attack || use || formula ? !both : named) {
      context.addIssue({
        code: 'custom',
        path: ['activity'],
        message:
          'An attack, a use or a formula, and only those, is made with an item',
      })
    }
    if (hitDie !== (request.denomination !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['denomination'],
        message: 'A hit die, and only a hit die, has a size',
      })
    }
    if (!attack && request.target !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Only an attack has a target',
      })
    }
    // A use has its targets; an area attack, such as a breath weapon's, has those in its area,
    // and no target of its own.
    const targeted = request.targets !== undefined
    if (use ? !targeted : targeted && !attack) {
      context.addIssue({
        code: 'custom',
        path: ['targets'],
        message: 'A use, or an area attack, and only those, has its targets',
      })
    }
    if (attack && targeted && request.target !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['targets'],
        message:
          'An attack is made at a target, or at those in its area, not both',
      })
    }
    const targets = request.targets ?? []
    const combats = new Set(targets.map(({ combatId }) => combatId))
    const combatants = new Set(targets.map(({ combatantId }) => combatantId))
    if (combats.size > 1 || combatants.size < targets.length) {
      context.addIssue({
        code: 'custom',
        path: ['targets'],
        message:
          'A use or an attack is made at different combatants of one combat',
      })
    }
    if (!attack && !use && request.slot !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['slot'],
        message: 'Only an attack or a use casts a spell',
      })
    }
    const weapon =
      request.ammunition !== undefined || request.attackMode !== undefined
    if (!attack && weapon) {
      context.addIssue({
        code: 'custom',
        path: ['attackMode'],
        message: 'Only an attack is made with ammunition, in a mode',
      })
    }
    const damaging = request.kind === 'damage' || request.kind === 'textDamage'
    if (!damaging && request.types !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['types'],
        message: 'Only damage has kinds to choose',
      })
    }
    if (request.kind !== 'damage' && request.modifiers !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['modifiers'],
        message: 'Only damage is changed so',
      })
    }
    if (request.kind !== 'save' && request.prompt !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['prompt'],
        message: 'Only a saving throw answers what the game asks',
      })
    }
    const linked = request.text !== undefined
    if (linked !== (request.link !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['link'],
        message: 'A link is named by its description and its number together',
      })
    }
    const fromText = FROM_TEXT.has(request.kind)
    if (fromText ? !linked : linked && !LINKABLE.has(request.kind)) {
      context.addIssue({
        code: 'custom',
        path: ['text'],
        message:
          'An ask, or damage or a roll from a description, and only those or a saving throw or check, names a link',
      })
    }
    if (linked && request.prompt !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['prompt'],
        message:
          'A saving throw answers what the game asks, or what a description calls for, not both',
      })
    }
    const keyed = ['skill', 'tool', 'ability', 'save'].includes(request.kind)
    if (keyed !== (request.key !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['key'],
        message: keyed ? 'Name what is rolled' : 'Nothing to name',
      })
    }
    if ((request.kind === 'initiative') !== (request.combatId !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['combatId'],
        message: 'Initiative, and only initiative, is rolled in a combat',
      })
    }
    if ((request.kind === 'damage') !== (request.use !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['use'],
        message: 'Damage, and only damage, follows an attack or a use',
      })
    }
    if (use || request.kind === 'ask') {
      const plain =
        request.mode === 0 &&
        !request.explicit &&
        request.extras.length === 0 &&
        request.dice.length === 0
      if (!plain) {
        context.addIssue({
          code: 'custom',
          path: ['dice'],
          message: use ? 'A use throws no dice' : 'An ask throws no dice',
        })
      }
      return
    }
    if (damaging || hitDie || formula || request.kind === 'textRoll') {
      const plain =
        request.mode === 0 && !request.explicit && request.extras.length === 0
      const dice = request.dice.every(
        ({ faces, results }) =>
          (DIE_SIDES as readonly number[]).includes(faces) &&
          results.every(result => result >= 1 && result <= faces),
      )
      // A hit die throws its one die.
      const [die] = request.dice
      const one =
        !hitDie ||
        (request.dice.length === 1 &&
          `d${die.faces}` === request.denomination &&
          die.results.length === 1)
      if (!plain || !dice || !one) {
        context.addIssue({
          code: 'custom',
          path: ['dice'],
          message:
            request.kind === 'damage'
              ? 'Damage is rolled as the attack said, and nothing more'
              : 'It is rolled as it is, and nothing more',
        })
      }
      return
    }
    const expected = expectedDice(request.mode, request.extras as ExtraTerm[])
    const { dice } = request
    const matches =
      dice.length === expected.length &&
      dice.every(
        ({ faces, results }, index) =>
          faces === expected[index].faces &&
          results.length === expected[index].count &&
          results.every(result => result >= 1 && result <= faces),
      )
    if (!matches) {
      context.addIssue({
        code: 'custom',
        path: ['dice'],
        message: 'The dice are not those the roll throws',
      })
    }
  }) as unknown as z.ZodType<RollRequestInput>

/** The dice a roll throws, in order: its d20s, then each added term's. */
function expectedDice(
  mode: -1 | 0 | 1,
  extras: ExtraTerm[],
): { faces: number; count: number }[] {
  return [
    { faces: 20, count: mode === 0 ? 1 : 2 },
    ...extras.flatMap(term =>
      'sides' in term ? [{ faces: term.sides, count: term.count }] : [],
    ),
  ]
}

/** The module's fetch of what players ask its game to do, for one of its campaigns. */
export const commandsPollSchema = z.looseObject({
  protocol: z.literal(PROTOCOL_VERSION),
  session: z.string().min(1).max(64),
  campaign: z.looseObject({
    id: z.string().min(1),
    title: z.string().trim().min(1),
  }),
})
