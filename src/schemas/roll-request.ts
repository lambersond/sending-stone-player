import { DIE_SIDES } from '@lambersond/3d-dice-core'
import { z } from 'zod'
import {
  ATTACK_MODE,
  DAMAGE_TYPE,
  HIT_DIE,
  MAX_DAMAGE_TERMS,
  MAX_ROLL_LABEL,
  MAX_SPEND,
  MAX_USE_TARGETS,
  MOST_AMONG,
  MOST_HIT_DICE,
  MOST_MOVED,
  MOST_MOVED_ITEMS,
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

/**
 * What may be a check an activity asks for, the player's own, made against it, from module 0.21.0:
 * a skill, tool or ability check, named by its item and activity.
 */
const ACTIVITY_CHECKS = new Set(['skill', 'tool', 'ability'])

/**
 * What may answer what the game asks: a saving throw, or from module 0.27.0, where Midi-QOL asks
 * for one, an ability or skill check.
 */
const ANSWERS = new Set(['save', 'ability', 'skill'])

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

/**
 * A turn ended, from module 0.36.0, as its player was shown it: its combat, its round and its
 * current combatant, never a turn index, which the app isn't sent.
 */
const turnSchema = z.strictObject({
  combatId: z.string().regex(FOUNDRY_ID),
  round: z.int().min(1).max(100_000),
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

/** Hit dice of one size spent at once: the size, and how many. */
const hitDiceSchema = z.strictObject({
  denomination: z.string().regex(HIT_DIE),
  count: z.int().min(1).max(MOST_HIT_DICE),
})

/** How many sizes of hit die there are, each of which may be spent at once. */
const HIT_DIE_SIZES = 5

/**
 * A counter charges are spent from directly, from module 0.29.0: an item's own uses, or one of its
 * activities', or an old-style resource, exactly as the sheet names it.
 */
const counterSchema = z.union([
  z.strictObject({
    item: z.string().regex(FOUNDRY_ID),
    activity: z.string().regex(FOUNDRY_ID).optional(),
  }),
  z.strictObject({ resource: z.enum(['primary', 'secondary', 'tertiary']) }),
])

/** A coin's key, as dnd5e keys its currencies, such as "gp". */
const COIN_KEY = /^[a-z][a-z0-9]{0,7}$/

/** The most kinds of coin one move moves. */
const MOST_COINS = 10

/**
 * Items and coins moved, from module 0.31.0: from one end to another, each a campaign character
 * or party by its Foundry id, one to ten items, each once and by how many, or one to ten kinds of
 * coin, or both. A coin of none isn't sent. From module 0.32.0, or a distribution: one kind of a
 * party's coin shared among its characters, `among`, in place of `to`.
 */
const transferSchema = z
  .strictObject({
    from: z.string().regex(FOUNDRY_ID),
    to: z.string().regex(FOUNDRY_ID).optional(),
    among: z
      .array(z.string().regex(FOUNDRY_ID))
      .min(1)
      .max(MOST_AMONG)
      .optional(),
    items: z
      .array(
        z.strictObject({
          id: z.string().regex(FOUNDRY_ID),
          quantity: z.int().min(1).max(MOST_MOVED),
        }),
      )
      .min(1)
      .max(MOST_MOVED_ITEMS)
      .optional(),
    currency: z
      .record(z.string().regex(COIN_KEY), z.int().min(1).max(MOST_MOVED))
      .optional(),
  })
  .superRefine((transfer, context) => {
    const { to, among } = transfer
    if ((to === undefined) === (among === undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'A move goes to one end, or is shared among characters',
      })
    }
    if (among) {
      if (new Set(among).size < among.length) {
        context.addIssue({
          code: 'custom',
          path: ['among'],
          message: 'Each character is given one share',
        })
      }
      if (among.includes(transfer.from)) {
        context.addIssue({
          code: 'custom',
          path: ['among'],
          message: "A party doesn't share with itself",
        })
      }
      if (transfer.items !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['items'],
          message: 'Only coins are shared',
        })
      }
      if (Object.keys(transfer.currency ?? {}).length !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['currency'],
          message: 'One kind of coin is shared at a time',
        })
      }
    }
    if (to !== undefined && transfer.from === to) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'A move goes from one end to another',
      })
    }
    const ids = (transfer.items ?? []).map(({ id }) => id)
    if (new Set(ids).size < ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Each item is moved once',
      })
    }
    const coins = Object.keys(transfer.currency ?? {}).length
    if (transfer.currency && (coins === 0 || coins > MOST_COINS)) {
      context.addIssue({
        code: 'custom',
        path: ['currency'],
        message: 'From one to ten kinds of coin',
      })
    }
    if (
      to !== undefined &&
      transfer.items === undefined &&
      transfer.currency === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'A move moves an item or coins',
      })
    }
  })

/**
 * An item removed from the character, from module 0.33.0: by its Foundry id, how many of its
 * stack, from 1 to all of it, and how many the sheet showed, which the game checks it still has;
 * 0 only of a stack of none, which removes it whole.
 */
const removeSchema = z
  .strictObject({
    item: z.string().regex(FOUNDRY_ID),
    quantity: z.int().min(0).max(MOST_MOVED),
    held: z.int().min(0).max(MOST_MOVED),
  })
  .refine(
    ({ quantity, held }) => quantity <= held && (quantity > 0 || held === 0),
    {
      path: ['quantity'],
      message: 'From 1 to as many as there are, or none of a stack of none',
    },
  )

/**
 * What names each of the kinds from module 0.29.0 that aren't rolls, and only it: a concentration
 * ended its effect, charges spent their counter, and Heroic Inspiration whether it's used; from
 * module 0.31.0, a move what moves; from module 0.33.0, a removal what it removes; and from module
 * 0.36.0, a turn ended which turn.
 */
const OWN_FIELDS = {
  endConcentration: {
    field: 'concentration',
    message: 'A concentration ended, and only that, names the concentration',
  },
  spend: {
    field: 'counter',
    message: 'Charges spent, and only those, name their counter',
  },
  inspiration: {
    field: 'inspiration',
    message: 'Heroic Inspiration, and only that, says whether it’s used',
  },
  transfer: {
    field: 'transfer',
    message: 'A move, and only that, names what moves',
  },
  remove: {
    field: 'remove',
    message: 'A removal, and only that, names what it removes',
  },
  endTurn: {
    field: 'turn',
    message: 'A turn ended, and only that, names the turn',
  },
} as const

/** What each of those, and ending an enchantment, is said not to throw. */
const PLAIN_WORDS: Partial<Record<RollRequestInput['kind'], string>> = {
  use: 'A use throws no dice',
  endEnchantment: 'Ending an enchantment throws no dice',
  endConcentration: 'Ending concentration throws no dice',
  spend: 'Spending throws no dice',
  inspiration: 'Heroic Inspiration throws no dice',
  transfer: 'Moving throws no dice',
  remove: 'Removing throws no dice',
  endTurn: 'Ending a turn throws no dice',
}

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
 * item and activity, the combatants it's used at, all in one combat, whether it's made at its user
 * too, from module 0.22.0, and the spell slot chosen, if any, and throws no dice. Their damage
 * names the attack or use, the dice it said its damage throws, which are checked against them when
 * it's taken, and the kinds of damage chosen; and how the player changed it, if they did, its dice
 * then changed so. A description's damage names its link, and may be changed so too, or be a
 * critical hit's, as the world's rules make one, which an attack's damage never says: its attack
 * did. A saving throw the game asked for names the prompt it answers, as does an ability or skill
 * check Midi-QOL asked for; a saving throw or check a description calls for may name its link; a
 * check an activity asks for may name its item and activity instead, never both. A use of an
 * enchant activity may say how it enchants, and which of the character's items, and nothing else
 * may; an enchantment ended, from module 0.21.0, names its item and effect, and nothing else, and
 * throws no dice; and from module 0.29.0, a concentration ended names its effect, charges spent
 * directly their counter and how many, 1 to 999, and Heroic Inspiration whether it's used or
 * gained, each that and nothing else, and none throws dice; and from module 0.31.0, a move of items
 * and coins names its ends and what moves, and nothing else, and throws no dice; and from module
 * 0.33.0, a removal names the item it removes and how many, and nothing else, and throws no dice.
 * Any roll may say what the page that sent it calls it, its `label`, which only
 * the Gamemaster's page sends (#156), for the character's player to be shown it by. A hit die
 * names its size, and throws its one die;
 * several hit dice spent at once name how many of each size, each size once, no more than 20 in
 * all, and throw those of each size together, in the same order; a feature's own
 * formula names its item and activity, and throws the dice its formula does, which are checked
 * against it when it's asked for. Any roll with dice may say its player typed them in from their
 * own dice, `typed`, from module 0.32.0; an attack with advantage may throw three d20s, for Elven
 * Accuracy. From module 0.36.0, an action's damage or healing on its own names its item and
 * activity, and may be a critical hit's, with kinds chosen and changes, as damage may, and throws
 * one to twenty dice; and a spent recharge names its item, and may name its activity, and throws
 * its one d6. Neither names anything else a roll does. From module 0.36.0, a turn ended names its
 * combat, round and current combatant, and nothing else, and throws no dice.
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
    self: z.literal(true).optional(),
    slot: z.string().regex(SPELL_SLOT).nullable().optional(),
    ammunition: z.string().regex(FOUNDRY_ID).optional(),
    attackMode: z.string().regex(ATTACK_MODE).optional(),
    use: z.string().regex(REQUEST_ID).optional(),
    types: z
      .array(z.string().regex(DAMAGE_TYPE).nullable())
      .max(MAX_DAMAGE_TERMS)
      .optional(),
    modifiers: modifiersSchema.optional(),
    critical: z.literal(true).optional(),
    prompt: z.string().regex(PROMPT_ID).optional(),
    denomination: z.string().regex(HIT_DIE).optional(),
    hitDice: z.array(hitDiceSchema).min(1).max(HIT_DIE_SIZES).optional(),
    text: z.string().regex(TEXT_HASH).optional(),
    link: z
      .int()
      .min(0)
      .max(MAX_LINKS - 1)
      .optional(),
    enchant: z
      .strictObject({
        profile: z.string().regex(FOUNDRY_ID),
        item: z.string().regex(FOUNDRY_ID).optional(),
      })
      .optional(),
    enchantment: z
      .strictObject({
        item: z.string().regex(FOUNDRY_ID),
        effect: z.string().regex(FOUNDRY_ID),
      })
      .optional(),
    concentration: z
      .strictObject({ effect: z.string().regex(FOUNDRY_ID) })
      .optional(),
    counter: counterSchema.optional(),
    count: z.int().min(1).max(MAX_SPEND).optional(),
    inspiration: z.enum(['use', 'gain']).optional(),
    transfer: transferSchema.optional(),
    remove: removeSchema.optional(),
    turn: turnSchema.optional(),
    label: z.string().min(1).max(MAX_ROLL_LABEL).optional(),
    typed: z.literal(true).optional(),
  })
  .superRefine((request, context) => {
    const attack = request.kind === 'attack'
    const use = request.kind === 'use'
    const formula = request.kind === 'formula'
    const hitDie = request.kind === 'hitDie'
    const hitDice = request.kind === 'hitDice'
    // From module 0.36.0: an action's damage or healing on its own, and a spent recharge.
    const alone = request.kind === 'itemDamage'
    const recharge = request.kind === 'recharge'
    const named = request.item !== undefined || request.activity !== undefined
    const both = request.item !== undefined && request.activity !== undefined
    // A check may be one an activity asks for, from module 0.21.0, which names both.
    const checked = ACTIVITY_CHECKS.has(request.kind)
    // A recharge names its item, and its activity where the uses are the activity's own.
    let unnamed = named && !(checked && both)
    if (attack || use || formula || alone) unnamed = !both
    else if (recharge) unnamed = request.item === undefined
    if (unnamed) {
      context.addIssue({
        code: 'custom',
        path: ['activity'],
        message:
          'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
      })
    }
    if (
      checked &&
      named &&
      (request.text !== undefined ||
        request.link !== undefined ||
        request.prompt !== undefined)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['item'],
        message:
          'A check an activity asks for is made against it, not a link or what the game asks',
      })
    }
    if (hitDie !== (request.denomination !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['denomination'],
        message: 'A hit die, and only a hit die, has a size',
      })
    }
    if (hitDice !== (request.hitDice !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['hitDice'],
        message: 'Hit dice, and only hit dice, say how many of each size',
      })
    }
    if (request.hitDice && !spentOnce(request.hitDice)) {
      context.addIssue({
        code: 'custom',
        path: ['hitDice'],
        message: `Each size is spent once, and no more than ${MOST_HIT_DICE} dice in all`,
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
    // A use may be made at its user too, from module 0.22.0; an attack never is.
    if (!use && request.self !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['self'],
        message: 'Only a use is made at its user',
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
    const damaging =
      request.kind === 'damage' || request.kind === 'textDamage' || alone
    if (!damaging && request.types !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['types'],
        message: 'Only damage has kinds to choose',
      })
    }
    if (!damaging && request.modifiers !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['modifiers'],
        message: 'Only damage is changed so',
      })
    }
    if (
      request.kind !== 'textDamage' &&
      !alone &&
      request.critical !== undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['critical'],
        message:
          "Only a description's damage, or an action's on its own, is rolled as a critical hit's here",
      })
    }
    if (!ANSWERS.has(request.kind) && request.prompt !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['prompt'],
        message:
          'Only a saving throw, or an ability or skill check, answers what the game asks',
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
    // An enchant activity's use says how it enchants, and only it; an enchantment ended names it,
    // and nothing else, and throws no dice, as a use doesn't.
    if (!use && request.enchant !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['enchant'],
        message: 'Only a use enchants',
      })
    }
    const ending = request.kind === 'endEnchantment'
    if (ending !== (request.enchantment !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['enchantment'],
        message: 'An enchantment ended, and only that, names the enchantment',
      })
    }
    // A concentration ended, charges spent and Heroic Inspiration, from module 0.29.0, a move
    // from module 0.31.0, a removal from module 0.33.0 and a turn ended from module 0.36.0, each
    // name what they're of, and nothing else does; charges, how many, which nothing else says.
    for (const [kind, { field, message }] of Object.entries(OWN_FIELDS)) {
      if ((request.kind === kind) !== (request[field] !== undefined)) {
        context.addIssue({ code: 'custom', path: [field], message })
      }
    }
    if ((request.kind === 'spend') !== (request.count !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['count'],
        message: 'Charges spent, and only those, say how many',
      })
    }
    const notRolled = Object.hasOwn(OWN_FIELDS, request.kind)
    if (use || request.kind === 'ask' || ending || notRolled) {
      const plain =
        request.mode === 0 &&
        !request.explicit &&
        request.extras.length === 0 &&
        request.dice.length === 0
      if (!plain) {
        const message = PLAIN_WORDS[request.kind] ?? 'An ask throws no dice'
        context.addIssue({ code: 'custom', path: ['dice'], message })
      }
      return
    }
    if (hitDice) {
      const plain =
        request.mode === 0 && !request.explicit && request.extras.length === 0
      if (!plain || !throwsHitDice(request.dice, request.hitDice ?? [])) {
        context.addIssue({
          code: 'custom',
          path: ['dice'],
          message:
            'Hit dice are rolled as they are, a die each, and nothing more',
        })
      }
      return
    }
    // A recharge throws its one d6, and nothing more.
    if (recharge) {
      const plain =
        request.mode === 0 && !request.explicit && request.extras.length === 0
      const [die] = request.dice
      const one =
        request.dice.length === 1 &&
        die.faces === 6 &&
        die.results.length === 1 &&
        die.results[0] >= 1 &&
        die.results[0] <= 6
      if (!plain || !one) {
        context.addIssue({
          code: 'custom',
          path: ['dice'],
          message: 'A recharge throws its one d6, and nothing more',
        })
      }
      return
    }
    if (damaging || hitDie || formula || request.kind === 'textRoll') {
      const plain =
        request.mode === 0 &&
        !request.explicit &&
        request.extras.length === 0 &&
        // Damage on its own throws the dice the game said, one at least.
        (!alone || request.dice.length > 0)
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
    const expected = expectedDice(
      request.mode,
      request.extras as ExtraTerm[],
      request.kind,
    )
    const { dice } = request
    const matches =
      dice.length === expected.length &&
      dice.every(
        ({ faces, results }, index) =>
          faces === expected[index].faces &&
          expected[index].counts.includes(results.length) &&
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

/** Are hit dice spent at once each of their sizes once, no more than the most in all? */
function spentOnce(hitDice: { denomination: string; count: number }[]) {
  const sizes = new Set(hitDice.map(({ denomination }) => denomination))
  const count = hitDice.reduce((all, { count }) => all + count, 0)
  return sizes.size === hitDice.length && count <= MOST_HIT_DICE
}

/**
 * Are these the dice hit dice spent at once throw: for each size, in the same order, a roll of as
 * many of that size as are spent, each result one of its faces?
 */
function throwsHitDice(
  dice: { faces: number; results: number[] }[],
  hitDice: { denomination: string; count: number }[],
): boolean {
  return (
    dice.length === hitDice.length &&
    dice.every(
      ({ faces, results }, index) =>
        `d${faces}` === hitDice[index].denomination &&
        results.length === hitDice[index].count &&
        results.every(result => result >= 1 && result <= faces),
    )
  )
}

/**
 * The dice a roll throws, in order, with how many of each it may: its d20s, then each added term's.
 * An attack with advantage may throw a third d20, for Elven Accuracy, which its action is checked
 * for when it's taken.
 */
function expectedDice(
  mode: -1 | 0 | 1,
  extras: ExtraTerm[],
  kind: RollRequestInput['kind'],
): { faces: number; counts: number[] }[] {
  let d20s = [mode === 0 ? 1 : 2]
  if (kind === 'attack' && mode === 1) d20s = [2, 3]
  return [
    { faces: 20, counts: d20s },
    ...extras.flatMap(term =>
      'sides' in term ? [{ faces: term.sides, counts: [term.count] }] : [],
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
