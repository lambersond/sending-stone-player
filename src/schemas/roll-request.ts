import { z } from 'zod'
import { DIE_SIZES } from '@/constants/dice'
import { ROLL_KIND_INFO } from '@/constants/roll-kinds'
import {
  ATTACK_MODE,
  DAMAGE_TYPE,
  EFFECT_DICE_KINDS,
  EFFECT_DIE_FACES,
  EFFECT_ID,
  EFFECT_OPS,
  FORM_UUID,
  HIT_DIE,
  MAX_DAMAGE_TERMS,
  MAX_ROLL_LABEL,
  MAX_SPEND,
  MAX_USE_TARGETS,
  MOST_AMONG,
  MOST_EFFECT_DICE,
  MOST_HIT_DICE,
  MOST_MOVED,
  MOST_MOVED_ITEMS,
  PREPARE_OPS,
  PROFILE_ID,
  PROMPT_ID,
  PROTOCOL_VERSION,
  ROLL_KINDS,
  SPELL_SLOT,
  SPELL_SLOT_OPS,
} from '@/constants/sending-stone'
import { TEXT_HASH } from '@/schemas/sending-stone'
import { MOST_DICE } from '@/utils/damage-modifiers'
import { MAX_LINKS } from '@/utils/description-links'
import { isDieSides } from '@/utils/dice'
import { MAX_DICE, MAX_FLAT } from '@/utils/roll-modifiers'
import type { Issue, RequestRule } from '@/schemas/types'
import type {
  DieSize,
  ExtraTerm,
  RollKind,
  RollKindInfo,
  RollRequestInput,
  TransferInput,
} from '@/types/roll'

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
    sides: z.int().refine(sides => isDieSides(sides)),
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
    .refine((faces): faces is DieSize =>
      (DIE_SIZES as readonly number[]).includes(faces),
    )
    .optional(),
  maximize: z.boolean().optional(),
})

/** Hit dice of one size spent at once: the size, and how many. */
const hitDiceSchema = z.strictObject({
  denomination: z.string().regex(HIT_DIE),
  count: z.int().min(1).max(MOST_HIT_DICE),
})

/** How many sizes of hit die there are, each of which may be spent at once. */
const HIT_DIE_SIZES = DIE_SIZES.length

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
    const issue = issuesTo(context)
    shareRules(transfer, issue)
    moveRules(transfer, issue)
  })

/**
 * A move goes to one end, or is shared among characters, from module 0.32.0: one kind of a party's
 * coin, never to itself, a share each.
 */
function shareRules(transfer: TransferInput, issue: Issue) {
  const { to, among } = transfer
  if ((to === undefined) === (among === undefined)) {
    issue('to', 'A move goes to one end, or is shared among characters')
  }
  if (!among) return
  if (new Set(among).size < among.length) {
    issue('among', 'Each character is given one share')
  }
  if (among.includes(transfer.from)) {
    issue('among', "A party doesn't share with itself")
  }
  if (transfer.items !== undefined) {
    issue('items', 'Only coins are shared')
  }
  if (Object.keys(transfer.currency ?? {}).length !== 1) {
    issue('currency', 'One kind of coin is shared at a time')
  }
}

/** A move goes from one end to another, and moves each item once, or one to ten kinds of coin. */
function moveRules(transfer: TransferInput, issue: Issue) {
  const { to } = transfer
  if (to !== undefined && transfer.from === to) {
    issue('to', 'A move goes from one end to another')
  }
  const ids = (transfer.items ?? []).map(({ id }) => id)
  if (new Set(ids).size < ids.length) {
    issue('items', 'Each item is moved once')
  }
  const coins = Object.keys(transfer.currency ?? {}).length
  if (transfer.currency && (coins === 0 || coins > MOST_COINS)) {
    issue('currency', 'From one to ten kinds of coin')
  }
  if (
    to !== undefined &&
    transfer.items === undefined &&
    transfer.currency === undefined
  ) {
    issue('items', 'A move moves an item or coins')
  }
}

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

/** What may be done to a favorite, from module 0.37.0: added, or removed. */
const favoriteOp = z.enum(['add', 'remove'])

/**
 * A favorite added to or removed from the character's, from module 0.37.0, by what it is: an item
 * by its Foundry id; one of an item's activities by its own id and its item's, as two items may
 * hold activities of one id; an effect by the sheet's id, the actor's "<id>" or an item's
 * "<itemId>.<id>"; and a skill, tool or pool of spell slots by its key, which never has a dot, so
 * no favorite ever names one of the old resources, whose removal in dnd5e zeroes its maximum.
 * Nothing else: no other type, and no field its type doesn't name.
 */
const favoriteSchema = z.discriminatedUnion('type', [
  z.strictObject({
    op: favoriteOp,
    type: z.enum(['item']),
    id: z.string().regex(FOUNDRY_ID),
  }),
  z.strictObject({
    op: favoriteOp,
    type: z.literal('activity'),
    id: z.string().regex(FOUNDRY_ID),
    item: z.string().regex(FOUNDRY_ID),
  }),
  z.strictObject({
    op: favoriteOp,
    type: z.literal('effect'),
    id: z.string().regex(/^[\dA-Za-z]{1,64}(?:\.[\dA-Za-z]{1,64})?$/),
  }),
  z.strictObject({
    op: favoriteOp,
    type: z.enum(['skill', 'tool', 'slots']),
    id: z.string().regex(/^[A-Za-z][\w-]{0,31}$/),
  }),
])

/**
 * Wild Shape from the app, from module 0.40.0, by its op: a change into one of the druid's known
 * forms, by its profile's id; a return; a Beast learned, by its uuid in one of the campaign's
 * compendiums, never a world actor's, into an empty place or in place of a known form; or the
 * Beasts to learn listed. Nothing else.
 */
const wildShapeSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('transform'),
    form: z.string().regex(PROFILE_ID),
  }),
  z.strictObject({ op: z.literal('revert') }),
  z.strictObject({
    op: z.literal('learn'),
    uuid: z.string().regex(FORM_UUID),
    replace: z.string().regex(PROFILE_ID).nullable(),
  }),
  z.strictObject({ op: z.literal('forms') }),
])

/**
 * What names each of the kinds from module 0.29.0 that aren't rolls, and only it: a concentration
 * ended its effect, charges spent their counter, and Heroic Inspiration whether it's used; from
 * module 0.31.0, a move what moves; from module 0.33.0, a removal what it removes; from module
 * 0.36.0, a turn ended which turn, and a turn taken back the End Turn it takes back and the turn
 * that End Turn left; and from module 0.37.0, a favorite added or removed what it is; and from
 * module 0.39.0, one of the character's own effects turned off, on or deleted which; and from
 * module 0.40.0, Wild Shape its op and form; and from module 0.42.1, a spell slot spent or restored
 * its pool, which, and the count it was made from; and from module 0.42.1 a spell prepared or
 * unprepared which spell, and which of those. A field more than one kind names lists them all,
 * `kinds`.
 */
const OWN_FIELDS: Readonly<
  Record<
    string,
    {
      field: keyof RollRequestInput
      kinds?: readonly RollRequestInput['kind'][]
      message: string
    }
  >
> = {
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
  spellSlot: {
    field: 'spellSlot',
    message:
      'A spell slot spent or restored, and only that, names the pool, which, and the count it was made from',
  },
  transfer: {
    field: 'transfer',
    message: 'A move, and only that, names what moves',
  },
  remove: {
    field: 'remove',
    message: 'A removal, and only that, names what it removes',
  },
  favorite: {
    field: 'favorite',
    message: 'A favorite added or removed, and only that, names what',
  },
  effect: {
    field: 'effect',
    message:
      'An effect turned off, on or deleted, and only that, names the effect',
  },
  wildShape: {
    field: 'wildShape',
    message: 'Wild Shape, and only that, names its op and form',
  },
  prepare: {
    field: 'prepare',
    message:
      'A spell prepared or unprepared, and only that, names the spell and which',
  },
  endTurn: {
    field: 'turn',
    kinds: ['endTurn', 'undoEndTurn'],
    message: 'A turn ended or taken back, and only that, names the turn',
  },
  undoEndTurn: {
    field: 'undo',
    message:
      'A turn taken back, and only that, names the End Turn it takes back',
  },
}

/** What each of those, and ending an enchantment, is said not to throw. */
const PLAIN_WORDS: Partial<Record<RollRequestInput['kind'], string>> = {
  use: 'A use throws no dice',
  endEnchantment: 'Ending an enchantment throws no dice',
  endConcentration: 'Ending concentration throws no dice',
  spend: 'Spending throws no dice',
  inspiration: 'Heroic Inspiration throws no dice',
  spellSlot: 'A spell slot spent or restored throws no dice',
  transfer: 'Moving throws no dice',
  remove: 'Removing throws no dice',
  favorite: 'A favorite throws no dice',
  effect: 'Changing an effect throws no dice',
  wildShape: 'Wild Shape throws no dice',
  prepare: 'Preparing a spell throws no dice',
  endTurn: 'Ending a turn throws no dice',
  undoEndTurn: 'Taking a turn back throws no dice',
}

const rolledDiceSchema = z.strictObject({
  faces: z.int().min(2).max(100),
  results: z
    .array(z.int())
    .min(1)
    .max(MAX_DICE * 2),
})

/**
 * A die an effect adds to a typed d20 roll, or takes from it, as its player typed it, from module
 * 0.42.0: by its faces and sign, with what each of its dice showed.
 */
const effectDieSchema = z.strictObject({
  faces: z.int().refine(faces => isDieSides(faces)),
  sign,
  results: z.array(z.int()).min(1).max(MAX_DICE),
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
 * combat, round and current combatant, and nothing else, and throws no dice; and a turn taken back
 * names the End Turn it takes back and where it left the combat, and nothing else, and throws no
 * dice either. From module 0.37.0, a favorite added or removed names what, and nothing else, and
 * throws no dice. From module 0.39.0, one of the character's own effects turned off, on or deleted
 * names the effect, as the sheet does, and which of those, and nothing else, and throws no dice.
 * From module 0.40.0, Wild Shape names its op, and the known form changed into, or the Beast
 * learned and the known form it replaces, if any, and nothing else, and throws no dice. From module
 * 0.41.0, damage on its own may name the spell slot it's rolled at, never none as null, the attack
 * mode and the ammunition, and ask to spend what its use would, `consume`, which nothing else does.
 * From module 0.42.0, a typed d20 roll may name the dice its effects add that its player typed in,
 * `effectDice`, each by its faces, never a d20's, and its sign, at most 10, each result one of its
 * faces; and any typed roll may say its player rerolled at the table, `rerolls`. Neither is said of
 * a roll not typed in. From module 0.42.1, a spell slot spent or restored names which, its pool, as
 * a cast's slot is named, and the count of that pool the page showed, 0 to 999, and nothing else,
 * and throws no dice. From module 0.42.1 too, a spell prepared or unprepared names the spell, by
 * its id, and the state wanted, and nothing else, and throws no dice.
 */
export const rollRequestSchema: z.ZodType<RollRequestInput> = z
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
    // From module 0.41.0: damage on its own spends what its use would.
    consume: z.literal(true).optional(),
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
    // From module 0.42.1: one spell slot spent or restored, from the count the page showed.
    spellSlot: z
      .strictObject({
        op: z.enum(SPELL_SLOT_OPS),
        id: z.string().regex(SPELL_SLOT),
        from: z.int().min(0).max(999),
      })
      .optional(),
    transfer: transferSchema.optional(),
    remove: removeSchema.optional(),
    favorite: favoriteSchema.optional(),
    effect: z
      .strictObject({
        op: z.enum(EFFECT_OPS),
        id: z.string().regex(EFFECT_ID),
      })
      .optional(),
    wildShape: wildShapeSchema.optional(),
    // From module 0.42.1: one of the character's spells prepared or unprepared, the state wanted.
    prepare: z
      .strictObject({
        op: z.enum(PREPARE_OPS),
        id: z.string().regex(FOUNDRY_ID),
      })
      .optional(),
    turn: turnSchema.optional(),
    undo: z.string().regex(REQUEST_ID).optional(),
    label: z.string().min(1).max(MAX_ROLL_LABEL).optional(),
    typed: z.literal(true).optional(),
    // From module 0.42.0: the dice a typed d20 roll's effects add, typed in, and that a typed
    // roll's rerolls were made at the table.
    effectDice: z.array(effectDieSchema).max(MOST_EFFECT_DICE).optional(),
    rerolls: z.literal('kept').optional(),
  })
  .superRefine((request, context) => {
    // Each group of rules in turn, so that a request's issues always come in the same order.
    const issue = issuesTo(context)
    typedRules(request, issue)
    namingRules(request, issue)
    hitDiceRules(request, issue)
    targetRules(request, issue)
    castingRules(request, issue)
    damageRules(request, issue)
    linkRules(request, issue)
    keyRules(request, issue)
    enchantRules(request, issue)
    ownFieldRules(request, issue)
    // Then the dice, by what the kind throws.
    DICE_RULES[infoOf(request.kind).dice](request, issue)
  })

/** What a kind is, as the request-kind table has it: what it throws, names and answers. */
function infoOf(kind: RollKind): RollKindInfo {
  return ROLL_KIND_INFO[kind]
}

/** A refinement's issues, each a custom one at a field of what it checks. */
function issuesTo<T>(context: z.RefinementCtx<T>): Issue {
  return (path, message) => {
    context.addIssue({ code: 'custom', path: [path], message })
  }
}

/** Is each of these results one of a die's faces? */
function inFaces(results: number[], faces: number): boolean {
  return results.every(result => result >= 1 && result <= faces)
}

/**
 * From module 0.42.0, a typed d20 roll names the dice its effects add that its player typed in,
 * never a d20, each result one of its faces; and only a typed roll says its rerolls were made at
 * the table.
 */
function typedRules(request: RollRequestInput, issue: Issue) {
  if (request.effectDice !== undefined) {
    const effects = (EFFECT_DICE_KINDS as readonly string[]).includes(
      request.kind,
    )
    if (!effects || request.typed !== true) {
      issue(
        'effectDice',
        'Only a typed d20 roll names the dice its effects add',
      )
    } else if (
      !request.effectDice.every(
        ({ faces, results }) =>
          (EFFECT_DIE_FACES as readonly number[]).includes(faces) &&
          inFaces(results, faces),
      )
    ) {
      issue('effectDice', 'The dice are not those the roll throws')
    }
  }
  if (request.rerolls !== undefined && request.typed !== true) {
    issue('rerolls', 'Only a typed roll keeps its rerolls')
  }
}

/**
 * An attack, a use, a formula or damage on its own (from module 0.36.0) is made with an item, as a
 * check an activity asks for is, from module 0.21.0, which names both; a recharge names its item,
 * and its activity where the uses are the activity's own. Nothing else names either.
 */
function namingRules(request: RollRequestInput, issue: Issue) {
  const { kind } = request
  const named = request.item !== undefined || request.activity !== undefined
  const both = request.item !== undefined && request.activity !== undefined
  // A skill, tool or ability check, the player's own, may be one an activity asks for.
  const checked = infoOf(kind).check !== undefined
  let unnamed = named && !(checked && both)
  if (['attack', 'use', 'formula', 'itemDamage'].includes(kind)) {
    unnamed = !both
  } else if (kind === 'recharge') {
    unnamed = request.item === undefined
  }
  if (unnamed) {
    issue(
      'activity',
      'An attack, a use, a formula or damage on its own, and only those or a check an activity asks for, is made with an item; a recharge, with its item',
    )
  }
  if (
    checked &&
    named &&
    (request.text !== undefined ||
      request.link !== undefined ||
      request.prompt !== undefined)
  ) {
    issue(
      'item',
      'A check an activity asks for is made against it, not a link or what the game asks',
    )
  }
}

/** A hit die has a size, and hit dice say how many of each, each size once, and only those. */
function hitDiceRules(request: RollRequestInput, issue: Issue) {
  if ((request.kind === 'hitDie') !== (request.denomination !== undefined)) {
    issue('denomination', 'A hit die, and only a hit die, has a size')
  }
  if ((request.kind === 'hitDice') !== (request.hitDice !== undefined)) {
    issue('hitDice', 'Hit dice, and only hit dice, say how many of each size')
  }
  if (request.hitDice && !spentOnce(request.hitDice)) {
    issue(
      'hitDice',
      `Each size is spent once, and no more than ${MOST_HIT_DICE} dice in all`,
    )
  }
}

/**
 * An attack has a target; a use has its targets; an area attack, such as a breath weapon's, has
 * those in its area, and no target of its own; and a use may be made at its user too, from module
 * 0.22.0, which an attack never is. Its targets are different combatants of one combat.
 */
function targetRules(request: RollRequestInput, issue: Issue) {
  const attack = request.kind === 'attack'
  const use = request.kind === 'use'
  if (!attack && request.target !== undefined) {
    issue('target', 'Only an attack has a target')
  }
  const targeted = request.targets !== undefined
  if (use ? !targeted : targeted && !attack) {
    issue(
      'targets',
      'A use, or an area attack, and only those, has its targets',
    )
  }
  if (!use && request.self !== undefined) {
    issue('self', 'Only a use is made at its user')
  }
  if (attack && targeted && request.target !== undefined) {
    issue(
      'targets',
      'An attack is made at a target, or at those in its area, not both',
    )
  }
  const targets = request.targets ?? []
  const combats = new Set(targets.map(({ combatId }) => combatId))
  const combatants = new Set(targets.map(({ combatantId }) => combatantId))
  if (combats.size > 1 || combatants.size < targets.length) {
    issue(
      'targets',
      'A use or an attack is made at different combatants of one combat',
    )
  }
}

/**
 * From module 0.41.0, damage on its own names the slot it's rolled at, the attack mode and the
 * ammunition, and may spend what its use would; it never leaves the slot to the game, as null.
 */
function castingRules(request: RollRequestInput, issue: Issue) {
  const attack = request.kind === 'attack'
  const alone = request.kind === 'itemDamage'
  const slotted = alone
    ? request.slot !== null
    : attack || request.kind === 'use'
  if (request.slot !== undefined && !slotted) {
    issue('slot', 'Only an attack, a use or damage on its own casts at a slot')
  }
  const weapon =
    request.ammunition !== undefined || request.attackMode !== undefined
  if (!attack && !alone && weapon) {
    issue(
      'attackMode',
      'Only an attack, or damage on its own, is made with ammunition, in a mode',
    )
  }
  if (!alone && request.consume !== undefined) {
    issue('consume', 'Only damage on its own spends what it uses')
  }
}

/** Only damage has kinds to choose, and is changed; only some is a critical hit's here. */
function damageRules(request: RollRequestInput, issue: Issue) {
  const damaging = infoOf(request.kind).damage === true
  if (!damaging && request.types !== undefined) {
    issue('types', 'Only damage has kinds to choose')
  }
  if (!damaging && request.modifiers !== undefined) {
    issue('modifiers', 'Only damage is changed so')
  }
  if (
    request.kind !== 'textDamage' &&
    request.kind !== 'itemDamage' &&
    request.critical !== undefined
  ) {
    issue(
      'critical',
      "Only a description's damage, or an action's on its own, is rolled as a critical hit's here",
    )
  }
}

/**
 * What answers what the game asks: a saving throw, or from module 0.27.0, where Midi-QOL asks for
 * one, an ability or skill check. What is asked for by a link in a description, and only by one,
 * names it; and what may be, or not: a saving throw, or from module 0.18.0 a check, the player's
 * own.
 */
function linkRules(request: RollRequestInput, issue: Issue) {
  const info = infoOf(request.kind)
  if (info.answers !== true && request.prompt !== undefined) {
    issue(
      'prompt',
      'Only a saving throw, or an ability or skill check, answers what the game asks',
    )
  }
  const linked = request.text !== undefined
  if (linked !== (request.link !== undefined)) {
    issue('link', 'A link is named by its description and its number together')
  }
  const fromText = info.fromText === true
  if (fromText ? !linked : linked && info.keyed !== true) {
    issue(
      'text',
      'An ask, or damage or a roll from a description, and only those or a saving throw or check, names a link',
    )
  }
  if (linked && request.prompt !== undefined) {
    issue(
      'prompt',
      'A saving throw answers what the game asks, or what a description calls for, not both',
    )
  }
}

/** What is rolled by its key names it, initiative its combat, damage what it follows. */
function keyRules(request: RollRequestInput, issue: Issue) {
  const keyed = infoOf(request.kind).keyed === true
  if (keyed !== (request.key !== undefined)) {
    issue('key', keyed ? 'Name what is rolled' : 'Nothing to name')
  }
  if ((request.kind === 'initiative') !== (request.combatId !== undefined)) {
    issue('combatId', 'Initiative, and only initiative, is rolled in a combat')
  }
  if ((request.kind === 'damage') !== (request.use !== undefined)) {
    issue('use', 'Damage, and only damage, follows an attack or a use')
  }
}

/**
 * An enchant activity's use says how it enchants, and only it; an enchantment ended names it, and
 * nothing else, and throws no dice, as a use doesn't.
 */
function enchantRules(request: RollRequestInput, issue: Issue) {
  if (request.kind !== 'use' && request.enchant !== undefined) {
    issue('enchant', 'Only a use enchants')
  }
  const ending = request.kind === 'endEnchantment'
  if (ending !== (request.enchantment !== undefined)) {
    issue(
      'enchantment',
      'An enchantment ended, and only that, names the enchantment',
    )
  }
}

/**
 * A concentration ended, charges spent and Heroic Inspiration, from module 0.29.0, a move from
 * module 0.31.0, a removal from module 0.33.0, a turn ended or taken back from module 0.36.0, a
 * favorite from module 0.37.0, an effect changed from module 0.39.0, Wild Shape from module 0.40.0
 * and a spell slot spent or restored from module 0.42.1, each name what they're of, and nothing
 * else does; charges, how many, which nothing else says. And from module 0.42.1, a spell prepared
 * or unprepared names its spell, and nothing else does.
 */
function ownFieldRules(request: RollRequestInput, issue: Issue) {
  for (const [kind, { field, kinds, message }] of Object.entries(OWN_FIELDS)) {
    const own = (kinds ?? [kind]).includes(request.kind)
    if (own !== (request[field] !== undefined)) issue(field, message)
  }
  if ((request.kind === 'spend') !== (request.count !== undefined)) {
    issue('count', 'Charges spent, and only those, say how many')
  }
}

/** The dice each kind throws, by what the request-kind table says it throws. */
const DICE_RULES: Record<RollKindInfo['dice'], RequestRule> = {
  none: plainRules,
  hitDice: hitDiceThrownRules,
  recharge: rechargeRules,
  free: ownDiceRules,
  d20: d20Rules,
}

/** A use, an ask, an enchantment ended and each kind with a field of its own throws no dice. */
function plainRules(request: RollRequestInput, issue: Issue) {
  const plain =
    request.mode === 0 &&
    !request.explicit &&
    request.extras.length === 0 &&
    request.dice.length === 0
  if (!plain) {
    issue('dice', PLAIN_WORDS[request.kind] ?? 'An ask throws no dice')
  }
}

/** Hit dice are rolled as they are, a die each, and nothing more. */
function hitDiceThrownRules(request: RollRequestInput, issue: Issue) {
  const plain =
    request.mode === 0 && !request.explicit && request.extras.length === 0
  if (!plain || !throwsHitDice(request.dice, request.hitDice ?? [])) {
    issue(
      'dice',
      'Hit dice are rolled as they are, a die each, and nothing more',
    )
  }
}

/** A recharge throws its one d6, and nothing more. */
function rechargeRules(request: RollRequestInput, issue: Issue) {
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
    issue('dice', 'A recharge throws its one d6, and nothing more')
  }
}

/**
 * Damage, a hit die, a formula and a description's roll throw their own dice, as they are, each
 * one the dice throw; damage on its own the dice the game said, one at least; a hit die its one.
 */
function ownDiceRules(request: RollRequestInput, issue: Issue) {
  const alone = request.kind === 'itemDamage'
  const plain =
    request.mode === 0 &&
    !request.explicit &&
    request.extras.length === 0 &&
    // Damage on its own throws the dice the game said, one at least.
    (!alone || request.dice.length > 0)
  const dice = request.dice.every(
    ({ faces, results }) => isDieSides(faces) && inFaces(results, faces),
  )
  // A hit die throws its one die.
  const [die] = request.dice
  const one =
    request.kind !== 'hitDie' ||
    (request.dice.length === 1 &&
      `d${die.faces}` === request.denomination &&
      die.results.length === 1)
  if (!plain || !dice || !one) {
    issue(
      'dice',
      request.kind === 'damage'
        ? 'Damage is rolled as the attack said, and nothing more'
        : 'It is rolled as it is, and nothing more',
    )
  }
}

/** A d20 roll throws its d20s, then each added term's dice, as `expectedDice` says. */
function d20Rules(request: RollRequestInput, issue: Issue) {
  const expected = expectedDice(request.mode, request.extras, request.kind)
  const { dice } = request
  const matches =
    dice.length === expected.length &&
    dice.every(
      ({ faces, results }, index) =>
        faces === expected[index].faces &&
        expected[index].counts.includes(results.length) &&
        inFaces(results, faces),
    )
  if (!matches) {
    issue('dice', 'The dice are not those the roll throws')
  }
}

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
        inFaces(results, faces),
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
