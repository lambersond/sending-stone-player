import { DIE_SIDES } from '@lambersond/3d-dice-core'
import { z } from 'zod'
import {
  MAX_DAMAGE_TERMS,
  PROTOCOL_VERSION,
  ROLL_KINDS,
} from '@/constants/sending-stone'
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
 * it's made with, and the combatant it's made at, if any; its damage names the attack, and has the
 * dice that attack said its damage throws, which are checked against them when it's taken.
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
    target: z
      .strictObject({
        combatId: z.string().regex(FOUNDRY_ID),
        combatantId: z.string().regex(FOUNDRY_ID),
      })
      .nullable()
      .optional(),
    use: z.string().regex(REQUEST_ID).optional(),
  })
  .superRefine((request, context) => {
    const attack = request.kind === 'attack'
    const named = request.item !== undefined || request.activity !== undefined
    const both = request.item !== undefined && request.activity !== undefined
    if (attack ? !both : named) {
      context.addIssue({
        code: 'custom',
        path: ['activity'],
        message: 'An attack, and only an attack, is made with an item',
      })
    }
    if (!attack && request.target !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['target'],
        message: 'Only an attack has a target',
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
        message: 'Damage, and only damage, follows an attack',
      })
    }
    if (request.kind === 'damage') {
      const plain =
        request.mode === 0 && !request.explicit && request.extras.length === 0
      const dice = request.dice.every(
        ({ faces, results }) =>
          (DIE_SIDES as readonly number[]).includes(faces) &&
          results.every(result => result >= 1 && result <= faces),
      )
      if (!plain || !dice) {
        context.addIssue({
          code: 'custom',
          path: ['dice'],
          message: 'Damage is rolled as the attack said, and nothing more',
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
