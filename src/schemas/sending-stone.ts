/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { z } from 'zod'
import { ABILITIES } from '@/constants/dnd5e'
import { MOST_NOTE_TEXT, MOST_NOTE_TITLE, MOST_NOTES } from '@/constants/notes'
import {
  COMPANION_INITIATIVE,
  COMPANION_KEY,
  DAMAGE_TYPE,
  EVENTS,
  HIT_DIE,
  MAX_DAMAGE_TERMS,
  MAX_USE_TARGETS,
  MOST_AMONG,
  MOST_COMPANIONS,
  MOST_HIT_DICE,
  MOST_MOVED,
  MOST_MOVED_ITEMS,
  PROMPT_ID,
  PROMPT_SOURCES,
} from '@/constants/sending-stone'
import { foundrySettingsSchema } from '@/schemas/foundry-settings'
import { MAX_CHECKS } from '@/utils/description-links'
import { NOTE_ID } from '@/utils/note-id'
import { MAX_DICE } from '@/utils/roll-modifiers'
import { expandSheet } from '@/utils/slim-sheet'
import type { GameEvent } from '@/types/sending-stone'

// Payloads may gain fields at any time, so objects are loose: unknown keys are kept, not
// rejected. Fields this app only displays fall back to a default rather than failing the event.

const nullableString = z.string().nullable().catch(null)

export const envelopeSchema = z.object({
  protocol: z.number(),
  id: z.string(),
  session: z.string(),
  sequence: z.number().nullable(),
  type: z.string(),
  time: z.string(),
  world: z.object({ id: z.string(), title: z.string() }),
  campaign: z
    .object({ id: z.string().min(1), title: z.string().trim().min(1) })
    .nullable(),
  data: z.record(z.string(), z.unknown()),
})

const nullableNumber = z.number().nullable().catch(null)
const rollMode = z.union([z.literal(-1), z.literal(0), z.literal(1)]).catch(0)

/** How the module names a description: 14 hexadecimal digits. */
export const TEXT_HASH = /^[0-9a-f]{14}$/

/** The longest description kept. The module cuts them at 100,000 characters. */
export const LONGEST_TEXT = 200_000

/** A description's hash, or null; anything else is taken as no description. */
const textRef = z.string().regex(TEXT_HASH).nullable().catch(null)

/** A list whose malformed entries are dropped, rather than failing the whole list. */
const listOf = <T extends z.ZodType>(entry: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform(entries =>
      entries.flatMap(value => {
        const parsed = entry.safeParse(value)
        return parsed.success ? [parsed.data as z.output<T>] : []
      }),
    )

/** One of dnd5e's abilities, never a name any object answers to. */
const abilityId = z.string().refine(id => Object.hasOwn(ABILITIES, id))

/** A skill's or tool's key, as dnd5e's are. */
const checkKey = z.string().regex(/^[A-Za-z][\w-]{0,31}$/)

const conditionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  level: nullableNumber,
  detail: nullableString,
  text: textRef,
})

/** The most chat messages one of the Gamemaster's rolls lists as its own. */
const MAX_GM_ROLL_MESSAGES = 20

/** A Foundry document's id, as a command names one. */
const DOCUMENT_ID = /^[\dA-Za-z]{1,64}$/

/** An actor's id as the roster keeps it: a character's, or a Group actor's. */
const ACTOR_ID = /^[\dA-Za-z]{1,64}$/

/** The most ways an enchant activity may enchant, items it may enchant, and enchantments kept. */
const MAX_PROFILES = 20
const MAX_ENCHANTABLE = 500
const MAX_ENCHANTMENTS = 50

/**
 * A way an enchant activity may enchant, from module 0.21.0: its profile's id, which the app sends
 * back, its name, and the spell levels it's offered at, from `min` to `max`, each null for no
 * limit. One that can't be read is dropped, rather than offered at any level.
 */
const enchantProfileSchema = z
  .looseObject({
    id: z.string().regex(DOCUMENT_ID),
    name: z.string().trim().min(1).max(200),
    min: z.int().min(0).max(99).nullable(),
    max: z.int().min(0).max(99).nullable(),
  })
  .refine(({ min, max }) => min === null || max === null || min <= max)

/**
 * What an enchant activity enchants, from module 0.21.0: its own item, or those of the character's
 * its rules allow, by id, each once; the ways it may enchant, each once, at least one; and the
 * enchantments it has applied. A malformed way, item or enchantment is dropped, and so is the whole
 * where no way is left, or where it can't say whether it enchants its own item, so that the
 * activity reads as used in Foundry.
 */
const enchantSchema = z
  .looseObject({
    self: z.boolean(),
    toggle: z.boolean().catch(false),
    profiles: listOf(enchantProfileSchema)
      .transform(profiles =>
        profiles
          .filter(
            (profile, index) =>
              profiles.findIndex(({ id }) => id === profile.id) === index,
          )
          .slice(0, MAX_PROFILES),
      )
      .refine(profiles => profiles.length > 0),
    items: listOf(z.string().regex(DOCUMENT_ID)).transform(ids =>
      [...new Set(ids)].slice(0, MAX_ENCHANTABLE),
    ),
    applied: listOf(
      z.looseObject({
        item: z.string().regex(DOCUMENT_ID),
        effect: z.string().regex(DOCUMENT_ID),
        profile: z.string().regex(DOCUMENT_ID),
      }),
    ).transform(applied => applied.slice(0, MAX_ENCHANTMENTS)),
  })
  // One that enchants its own item enchants no other, and is a switch only then.
  .transform(enchant =>
    enchant.self ? { ...enchant, items: [] } : { ...enchant, toggle: false },
  )
  .optional()
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  .catch(undefined)

/**
 * The enchantments on an item, a spell, a feature or an action's item, from module 0.21.0, as many
 * as fifty; a malformed one dropped. Left out, as sent, for none, and by earlier modules.
 */
const enchantmentsSchema = listOf(
  z.looseObject({
    id: z.string().regex(DOCUMENT_ID),
    name: z.string().trim().min(1).max(200),
    source: z.string().max(200).nullable().catch(null),
    concentration: z.boolean().catch(false),
    duration: z.string().max(100).nullable().catch(null),
    expired: z.boolean().catch(false),
    endable: z.boolean().catch(false),
  }),
)
  .transform(enchantments => enchantments.slice(0, MAX_ENCHANTMENTS))
  .optional()

/**
 * A counter of the character's, as the module names one from module 0.29.0: an item's own uses, one
 * of its activities', or an old-style resource. Exactly one of those shapes, with ids the app can
 * send back, or none: a counter misnamed is never spent.
 */
const counterSchema = z.union([
  z.strictObject({
    item: z.string().regex(DOCUMENT_ID),
    activity: z.string().regex(DOCUMENT_ID).optional(),
  }),
  z.strictObject({ resource: z.enum(['primary', 'secondary', 'tertiary']) }),
])

/**
 * The dice an attack's or a use's damage or healing will throw in the game, as the game will make
 * up its rolls: a result's, and from module 0.36.0 a sheet's action's on its own. Damage throwing
 * more dice than a player may send is rolled by the game.
 */
const damagePreviewSchema = z
  .object({
    critical: z.boolean().catch(false),
    plannable: z.boolean().catch(false),
    // From module 0.12.0.
    healing: z.boolean().optional().catch(false),
    rolls: z
      .array(
        z.object({
          formula: z.string().max(500),
          type: z.string().max(64).nullable().catch(null),
          // From module 0.12.0: the kinds of damage its roller chooses among.
          types: z
            .array(
              z.object({
                key: z.string().regex(DAMAGE_TYPE),
                label: z.string().max(64),
              }),
            )
            .max(20)
            .nullable()
            .optional()
            .catch(null),
          dice: z
            .array(
              z.object({
                faces: z.int().min(2).max(100),
                number: z
                  .int()
                  .min(1)
                  .max(MAX_DICE * 2),
                // From module 0.20.0: dice of a critical hit's critical damage, never its first
                // die; anything else is left out, and the preview still read.
                added: z
                  .literal(true)
                  .optional()
                  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
                  .catch(undefined),
                // From module 0.21.0: dice the damage takes away, never its first die; anything
                // else is left out, and the preview still read.
                subtracted: z
                  .literal(true)
                  .optional()
                  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
                  .catch(undefined),
              }),
            )
            .max(MAX_DAMAGE_TERMS),
          // From module 0.13.0: how many dice it throws for each die of its own; one, as
          // before, when it can't be read.
          perDie: z.int().min(1).max(10).optional().catch(1),
        }),
      )
      .max(10),
  })
  .transform(damage =>
    damage.rolls.flatMap(roll => roll.dice).length > MAX_DAMAGE_TERMS
      ? {
          ...damage,
          plannable: false,
          rolls: damage.rolls.map(roll => ({ ...roll, dice: [] })),
        }
      : damage,
  )

/** The most counters an activity is said to spend as it's used. */
const MAX_SPENDS = 20

/**
 * What using an activity spends, from module 0.29.0: each counter, and how many, null for a cost a
 * formula works out. One that can't be read is dropped; none are said before.
 */
const spendsSchema = listOf(
  z.object({
    counter: counterSchema,
    amount: z.number().nullable().catch(null),
  }),
)
  .transform(spends => spends.slice(0, MAX_SPENDS))
  .optional()

/**
 * What else an action is used through in the game, and whom at, from module 0.12.0: one of the
 * kinds of activity the game uses, or none. From module 0.21.0, an activity that asks for a check;
 * and one that enchants, with what it enchants, without which it's none.
 */
const useSchema = z
  .looseObject({
    id: z.string().min(1),
    type: z.enum(['save', 'damage', 'heal', 'utility', 'check', 'enchant']),
    targets: z.looseObject({
      self: z.boolean().catch(false),
      area: z.boolean().catch(false),
      count: z.int().positive().nullable().catch(null),
      perLevel: z
        .int()
        .positive()
        .nullable()
        .optional()
        .catch(null)
        .transform(value => value ?? null),
      affects: nullableString,
      // From module 0.22.0: its range is Self, though it may take another target.
      // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as by older modules
      fromSelf: z.boolean().optional().catch(undefined),
    }),
    // From module 0.21.0, for an enchant activity.
    enchant: enchantSchema,
    spends: spendsSchema,
  })
  .nullable()
  .optional()
  .catch(null)
  // An enchant activity that can't say what it enchants is used in Foundry.
  .transform(use => (use?.type === 'enchant' && !use.enchant ? null : use))

const usesSchema = z
  .looseObject({
    value: z.number(),
    max: z.number(),
    recovery: nullableString,
    // From module 0.29.0: which counter they are, and whether they're spent directly from here.
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    counter: counterSchema.optional().catch(undefined),
    // eslint-disable-next-line unicorn/no-useless-undefined -- as for the counter
    spendable: z.literal(true).optional().catch(undefined),
    // From module 0.36.0: the lowest d6 that recharges them, for uses that recharge.
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    recharge: z.int().min(2).max(6).optional().catch(undefined),
  })
  .nullable()
  .catch(null)

/**
 * A level a spell an item casts may be cast at, from module 0.20.0: 1 to 9, with how many of the
 * item's uses it spends there, if counted, and whether fewer are left.
 */
const castLevelSchema = z.looseObject({
  level: z.int().min(1).max(9),
  charges: z.int().min(0).nullable().catch(null),
  short: z.boolean().catch(false),
})

/**
 * One way a check an activity asks for may be made, from module 0.21.0: an ability check, or a
 * skill's or a tool's, which names its skill or tool, and only they do; and for a tool's, the
 * tool's own bonus, a whole number, where it has one.
 */
const checkOptionSchema = z
  .looseObject({
    type: z.enum(['check', 'skill', 'tool']),
    ability: abilityId,
    key: checkKey.optional(),
    // eslint-disable-next-line unicorn/no-useless-undefined -- none, where it can't be read
    bonus: z.int().min(-99).max(99).optional().catch(undefined),
  })
  .refine(option => (option.type === 'check') === (option.key === undefined))

/**
 * The check an activity asks for, from module 0.21.0: one to ten ways to make it, each skill, tool
 * or ability once, the first kept, malformed ones dropped; its DC, if it has one; and whether it's
 * the character's own to make. Left out where it can't be read, so that the activity is only used.
 */
const checkSchema = z
  .looseObject({
    checks: listOf(checkOptionSchema)
      .transform(options => {
        const seen = new Set<string>()
        return options.filter(({ type, ability, key }) => {
          const id = `${type}:${key ?? ability}`
          if (seen.has(id)) return false
          seen.add(id)
          return true
        })
      })
      .refine(options => options.length > 0 && options.length <= MAX_CHECKS),
    dc: z.int().min(1).max(99).nullable().catch(null),
    own: z.boolean().catch(false),
  })
  .optional()
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  .catch(undefined)

/**
 * What using an activity that uses another spends of its uses, from module 0.21.0, and whether
 * that many are left. Left out where it can't be read.
 */
const forwardSchema = z
  .looseObject({
    charges: z.int().min(0).nullable().catch(null),
    short: z.boolean().catch(false),
  })
  .optional()
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  .catch(undefined)

/** Are a cast's levels each above the last, the first the level it's cast at by default? */
function castLevelsFrom(levels: { level: number }[], level: number): boolean {
  return (
    levels[0]?.level === level &&
    levels.every(
      (entry, index) => index === 0 || entry.level > levels[index - 1].level,
    )
  )
}

/** What an action rolls, and what it's used through in the game. */
const rollFields = {
  toHit: nullableNumber,
  // From module 0.11.0: the attack activity the bonus to hit is for.
  attackId: z.string().nullable().optional().catch(null),
  // From module 0.12.0.
  activity: useSchema,
  attackModes: z
    .array(z.looseObject({ value: z.string().min(1), label: z.string() }))
    .nullable()
    .optional()
    .catch(null),
  ammunition: z
    .array(
      z.looseObject({
        id: z.string().min(1),
        name: z.string(),
        quantity: z.number().catch(0),
      }),
    )
    .nullable()
    .optional()
    .catch(null),
  save: z
    .object({ ability: z.string(), dc: nullableNumber })
    .nullable()
    .catch(null),
  damage: listOf(
    z.looseObject({
      formula: z.string(),
      type: nullableString,
      healing: z.boolean().catch(false),
    }),
  ),
  // From module 0.36.0: its damage on its own, as the game would roll it, and as a critical hit's
  // where one is allowed; left out where it can't be read, so that it can't go alone.
  tableDamage: z
    .object({
      normal: damagePreviewSchema,
      critical: damagePreviewSchema.nullable(),
    })
    .nullable()
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // From module 0.14.0: false for a spell's activity that spends no slot; anything else spends one.
  consumesSlot: z.boolean().optional().catch(true),
  // From module 0.15.0: how a spell an item casts is cast, for a Cast activity.
  cast: z
    .looseObject({
      level: z.number().catch(0),
      concentration: z.boolean().catch(false),
      charges: nullableNumber,
      short: z.boolean().catch(false),
      text: textRef.optional(),
      // From module 0.20.0: the levels it may be cast at, with what each spends; left out where
      // malformed, as where any isn't one, there are fewer than two or more than nine.
      levels: z
        .array(castLevelSchema)
        .min(2)
        .max(9)
        .optional()
        // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
        .catch(undefined),
    })
    // Levels out of order, or not from its own, are left out too, the rest kept.
    .transform(({ levels, ...cast }) =>
      levels && castLevelsFrom(levels, cast.level) ? { ...cast, levels } : cast,
    )
    .nullable()
    .optional()
    .catch(null),
  // From module 0.15.0: the kind of action it takes, where it takes one, such as "bonus".
  activationType: z.string().nullable().optional().catch(null),
  // From module 0.16.0: whom an area attack is made at, such as a breath weapon's.
  attackArea: z
    .looseObject({
      count: z.int().positive().nullable().catch(null),
      perLevel: z
        .int()
        .positive()
        .nullable()
        .optional()
        .catch(null)
        .transform(perLevel => perLevel ?? null),
      affects: nullableString,
    })
    .nullable()
    .optional()
    .catch(null),
  // From module 0.16.0: a utility activity's own formula, and what it's called.
  rollFormula: z
    .looseObject({
      formula: z.string().min(1).max(500),
      name: nullableString,
    })
    .nullable()
    .optional()
    .catch(null),
  // From module 0.17.0: for a Cast, the id of the Spells tab's copy of its spell.
  spellId: z.string().min(1).max(64).nullable().optional().catch(null),
  // From module 0.21.0: the check an activity asks for, and what one that uses another spends.
  check: checkSchema,
  forward: forwardSchema,
  // From module 0.32.0: dnd5e gives its attack Elven Accuracy.
  elvenAccuracy: z
    .literal(true)
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
}

/**
 * What an activity says of itself, from module 0.17.0: how long what it does lasts, what a
 * reaction is taken in answer to, and under dnd5e 6, its own description.
 */
const activityFields = {
  duration: nullableString.optional(),
  trigger: nullableString.optional(),
  text: textRef.optional(),
}

/**
 * Each of an item's activities, for an item with more than one, from module 0.14.0: what each is
 * called, its kind, and what it does, as an action does.
 */
const activitiesSchema = listOf(
  z.looseObject({
    id: z.string().min(1),
    name: z.string(),
    type: z.string().catch(''),
    activation: nullableString,
    range: nullableString,
    target: nullableString,
    ...rollFields,
    uses: usesSchema,
    ...activityFields,
  }),
).optional()

/**
 * What a spell, feature or inventory item rolls, as an action does, from module 0.13.0, for one
 * that rolls or is used through anything. Left out, as sent, for one that doesn't, and by earlier
 * modules, so that it reads as it did.
 */
const itemRollFields = {
  toHit: rollFields.toHit.optional(),
  attackId: rollFields.attackId,
  activity: rollFields.activity,
  attackModes: rollFields.attackModes,
  ammunition: rollFields.ammunition,
  save: rollFields.save.optional(),
  damage: rollFields.damage.optional(),
  // From module 0.36.0, for one whose damage may go on its own.
  tableDamage: rollFields.tableDamage,
  consumesSlot: rollFields.consumesSlot,
  attackArea: rollFields.attackArea,
  rollFormula: rollFields.rollFormula,
  // From module 0.15.0, for a Cast, how its spell is cast; and from 0.17.0, its description.
  cast: rollFields.cast,
  spellId: rollFields.spellId,
  // From module 0.21.0, for a check activity, and one that uses another.
  check: rollFields.check,
  forward: rollFields.forward,
  // From module 0.32.0, for an attack dnd5e gives Elven Accuracy.
  elvenAccuracy: rollFields.elvenAccuracy,
  activities: activitiesSchema,
}

/**
 * How a feature or inventory item that rolls is used, as an action has it, from module 0.13.0; and
 * what it rolls. Left out, as sent, for one that rolls nothing.
 */
const usageFields = {
  range: nullableString.optional(),
  target: nullableString.optional(),
  concentration: z.boolean().catch(false).optional(),
  ...itemRollFields,
}

const featureSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  kind: nullableString,
  requirements: nullableString,
  activation: nullableString,
  passive: z.boolean().catch(false),
  uses: z
    .looseObject({
      value: z.number(),
      max: z.number(),
      recovery: nullableString,
    })
    .nullable()
    .catch(null),
  ...usageFields,
  // From module 0.21.0.
  enchantments: enchantmentsSchema,
  text: textRef,
})

/**
 * The item a spell is cast from, such as a wand. Left out, as sent, by modules before 0.8.2, so
 * that a sheet from one reads as it did; null for one that can't be read.
 */
const castFromSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    // From module 0.16.0: false for a spell the item can't cast now, and whether it needs attuning.
    usable: z.boolean().optional().catch(true),
    attune: z.boolean().optional().catch(false),
  })
  .nullable()
  .optional()
  .catch(null)

const itemFields = {
  id: z.string(),
  name: z.string(),
  img: nullableString,
  type: z.string().catch(''),
  quantity: z.number().catch(1),
  weight: z
    .object({ value: z.number(), units: z.string().catch('') })
    .nullable()
    .catch(null),
  price: nullableString,
  equipped: z.boolean().nullable().catch(null),
  attunement: z.enum(['required', 'optional']).nullable().catch(null),
  attuned: z.boolean().catch(false),
  uses: usesSchema,
  rarity: nullableString,
  properties: z.array(z.string()).catch([]),
  identified: z.boolean().catch(true),
  activation: nullableString.optional(),
  ...usageFields,
  // From module 0.21.0.
  enchantments: enchantmentsSchema,
  text: textRef,
}

const itemSchema = z.looseObject(itemFields)

type ParsedContainer = z.output<typeof itemSchema> & {
  capacity: { value: number; max: number; units: string } | null
  contents: (z.output<typeof itemSchema> | ParsedContainer)[] | null
}

// A container holds items, and containers that hold their own.
const containerSchema: z.ZodType<ParsedContainer> = z.lazy(() =>
  z.looseObject({
    ...itemFields,
    capacity: z
      .object({
        value: z.number(),
        max: z.number(),
        units: z.string().catch(''),
      })
      .nullable()
      .catch(null),
    contents: z
      .array(z.unknown())
      .nullable()
      .catch(null)
      .transform(entries =>
        entries === null
          ? null
          : entries.flatMap(value => {
              const schema =
                (value as { type?: unknown } | null)?.type === 'container'
                  ? containerSchema
                  : itemSchema
              const parsed = schema.safeParse(value)
              return parsed.success ? [parsed.data] : []
            }),
      ),
  }),
)

export const inventorySchema = z
  .looseObject({
    sections: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        items: listOf(itemSchema),
      }),
    ),
    containers: listOf(containerSchema),
    currency: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string().catch(''),
        abbreviation: z.string().catch(''),
        value: z.number().catch(0),
      }),
    ),
    encumbrance: z
      .looseObject({
        value: z.number(),
        max: nullableNumber,
        units: z.string().catch(''),
        encumbered: nullableNumber,
        heavilyEncumbered: nullableNumber,
      })
      .nullable()
      .catch(null),
    attunement: z
      .looseObject({ value: z.number(), max: nullableNumber })
      .nullable()
      .catch(null),
  })
  .catch({
    sections: [],
    containers: [],
    currency: [],
    encumbrance: null,
    attunement: null,
  })

const spellSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  level: z.number().catch(0),
  school: nullableString,
  components: nullableString,
  materials: nullableString,
  concentration: z.boolean().catch(false),
  ritual: z.boolean().catch(false),
  activation: nullableString,
  range: nullableString,
  duration: nullableString,
  target: nullableString,
  prepared: z
    .union([z.literal(0), z.literal(1), z.literal(2)])
    .nullable()
    .catch(null),
  uses: usesSchema,
  // From module 0.8.2.
  castFrom: castFromSchema,
  ...itemRollFields,
  // From module 0.21.0.
  enchantments: enchantmentsSchema,
  text: textRef,
})

const detailSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  value: z.string(),
})

/** What an action does, as an action or one of an item's activities has it. */
const actionFields = {
  activation: nullableString,
  range: nullableString,
  target: nullableString,
  ...rollFields,
  uses: usesSchema,
}

const actionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  type: z.string().catch(''),
  ...actionFields,
  activities: activitiesSchema,
  // From module 0.15.0: the activity an item is listed for in a section, where it isn't its first.
  activityName: z.string().nullable().optional().catch(null),
  // From module 0.15.0: an item used up rather than kept.
  consumable: z.boolean().optional().catch(false),
  level: nullableNumber,
  // From module 0.8.2.
  castFrom: castFromSchema,
  concentration: z.boolean().catch(false),
  identified: z.boolean().catch(true),
  // From module 0.21.0: the enchantments on its item.
  enchantments: enchantmentsSchema,
  text: textRef,
})

const effectSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  source: nullableString,
  duration: nullableString,
  disabled: z.boolean().catch(false),
  text: textRef,
})

/** A tool the character has, with what rolling it takes, as a skill has. */
const toolFields = {
  id: z.string(),
  name: z.string(),
  ability: nullableString,
  total: z.number(),
  passive: nullableNumber,
  proficiency: z.number().catch(0),
  mode: rollMode,
}

/** A favorite, by its type. One of a type a later module adds is dropped, as one malformed is. */
const favoriteSchema = z.discriminatedUnion('type', [
  z.looseObject({
    type: z.literal('item'),
    id: z.string(),
    itemType: z.string().catch(''),
    name: z.string(),
    img: nullableString,
  }),
  z.looseObject({
    type: z.literal('activity'),
    id: z.string(),
    itemId: z.string(),
    itemType: z.string().catch(''),
    itemName: z.string().catch(''),
    name: z.string(),
    img: nullableString,
    ...actionFields,
    ...activityFields,
  }),
  z.looseObject({
    type: z.literal('effect'),
    id: z.string(),
    name: z.string(),
    img: nullableString,
    disabled: z.boolean().catch(false),
    suppressed: z.boolean().catch(false),
  }),
  z.looseObject({
    type: z.literal('skill'),
    id: z.string(),
    name: z.string().catch(''),
  }),
  z.looseObject({ type: z.literal('tool'), ...toolFields }),
  z.looseObject({
    type: z.literal('slots'),
    id: z.string(),
    name: z.string(),
    value: z.number(),
    max: z.number(),
    level: nullableNumber,
  }),
  z.looseObject({
    type: z.literal('resource'),
    id: z.string(),
    name: z.string(),
    uses: usesSchema,
    // From module 0.23.0, the feature it stands for. One malformed is as good as none: the app
    // finds the feature by name, and keeps the favorite.
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as by older modules
    itemId: z.string().nullable().optional().catch(undefined),
  }),
])

/** A pool of an NPC's, such as its legendary actions, as dnd5e prepares it; none if malformed. */
const poolSchema = z
  .object({ value: z.number(), max: z.number() })
  .nullable()
  .catch(null)

/**
 * What an NPC's sheet says of it as a creature, from module 0.36.0: its challenge rating, type,
 * size and alignment, whether it's important, its legendary actions and resistances, its lair and
 * its hit dice. A part that can't be read is none; the whole, where it isn't an object, is left
 * out, as for a character.
 */
const creatureSchema = z.looseObject({
  cr: nullableNumber,
  type: nullableString,
  size: nullableString,
  alignment: nullableString,
  important: z.boolean().catch(false),
  legendary: poolSchema,
  resistance: poolSchema,
  lair: z
    .object({ inside: z.boolean().catch(false), initiative: nullableNumber })
    .nullable()
    .catch(null),
  hitDice: z
    .object({
      denomination: z.string().regex(HIT_DIE),
      value: z.number(),
      max: z.number(),
    })
    .nullable()
    .catch(null),
})

// A sheet that can't be read is dropped rather than failing the event that carries it.
const sheetSchema = z
  .looseObject({
    img: nullableString,
    level: nullableNumber,
    classes: z
      .array(
        z.looseObject({
          id: nullableString.optional(),
          identifier: nullableString.optional(),
          name: z.string(),
          levels: nullableNumber,
          subclass: nullableString,
          hitDice: z
            .object({
              die: z.string(),
              value: nullableNumber,
              max: nullableNumber,
            })
            .nullable()
            .optional()
            .catch(null),
        }),
      )
      .catch([]),
    species: nullableString,
    background: nullableString,
    hp: z
      .object({
        value: z.number(),
        max: z.number().nullable(),
        temp: z.number().catch(0),
      })
      .nullable()
      .optional()
      .catch(null),
    ac: nullableNumber,
    proficiency: nullableNumber,
    initiative: nullableNumber,
    speed: z
      .looseObject({ value: z.number(), units: nullableString })
      .nullable()
      .catch(null),
    inspiration: z.boolean().catch(false),
    abilities: z.array(
      z.looseObject({
        id: z.string(),
        label: z.string().catch(''),
        abbreviation: z.string().catch(''),
        score: nullableNumber,
        mod: z.number(),
        check: z.number(),
        save: z.number(),
        saveProficient: z.boolean().catch(false),
        checkMode: rollMode,
        saveMode: rollMode,
      }),
    ),
    skills: z.array(
      z.looseObject({
        id: z.string(),
        label: z.string().catch(''),
        ability: z.string().catch(''),
        total: z.number(),
        passive: nullableNumber,
        proficiency: z.number().catch(0),
        mode: rollMode,
      }),
    ),
    // Sent from module 0.18.0, for the checks descriptions ask for; before, only favorites
    // named tools.
    tools: listOf(z.looseObject(toolFields)).optional(),
    // Sent from module 0.6.0.
    conditions: listOf(conditionSchema),
    // From module 0.29.0: each concentration, for its player to end. A malformed one is dropped.
    concentration: z
      .looseObject({
        effects: listOf(
          z.looseObject({
            id: z.string().regex(DOCUMENT_ID),
            name: z.string().trim().min(1).max(200),
            item: z.string().regex(DOCUMENT_ID).nullable().catch(null),
          }),
        ),
      })
      .optional()
      // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
      .catch(undefined),
    features: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        text: textRef,
        features: listOf(featureSchema),
      }),
    ),
    effects: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        effects: listOf(effectSchema),
      }),
    ),
    // Sent from module 0.7.0.
    inventory: inventorySchema,
    spellcasting: z
      .looseObject({
        ability: nullableString,
        dc: nullableNumber,
        attack: nullableNumber,
        classes: listOf(
          z.looseObject({
            name: z.string(),
            ability: nullableString,
            dc: nullableNumber,
            attack: nullableNumber,
          }),
        ),
      })
      .nullable()
      .catch(null),
    spells: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        slots: z
          // The level, from module 0.8.1.
          .object({
            value: z.number(),
            max: z.number(),
            level: nullableNumber.optional(),
          })
          .nullable()
          .catch(null),
        spells: listOf(spellSchema),
      }),
    ),
    traits: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        values: z.array(z.string()).catch([]),
      }),
    ),
    // From module 0.16.0: the world's rules, which say how much a hit die gives back at least.
    rules: z.enum(['modern', 'legacy']).nullable().optional().catch(null),
    // From module 0.19.0: how the world rolls a critical hit's damage, for a description's, which
    // that module takes changed too; null where it can't say.
    critical: z
      .object({
        perDie: z.int().min(1).max(4),
        multiplyNumeric: z.boolean(),
        powerfulCritical: z.boolean(),
        altered: z.boolean(),
        // From module 0.20.0: how it throws the dice a critical hit adds; null where it can't say,
        // or where it says what this app doesn't know, the rule itself still read.
        bonusDice: z
          .enum(['rolled', 'maximized', 'ignored'])
          .nullable()
          .optional()
          .catch(null),
      })
      .nullable()
      .optional()
      .catch(null),
    deathSaves: z
      .object({ success: z.number(), failure: z.number() })
      .nullable()
      .catch(null),
    details: z
      .looseObject({
        about: listOf(detailSchema),
        personality: listOf(detailSchema),
        appearance: nullableString,
        xp: z
          .object({ value: z.number(), max: nullableNumber })
          .nullable()
          .catch(null),
        biography: textRef,
      })
      .catch({
        about: [],
        personality: [],
        appearance: null,
        xp: null,
        biography: null,
      }),
    // From module 0.36.0, for an NPC: what it is as a creature.
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    creature: creatureSchema.optional().catch(undefined),
    // Sent from module 0.8.0.
    actions: listOf(
      z.looseObject({
        id: z.string(),
        label: z.string(),
        actions: listOf(actionSchema),
      }),
    ),
    // Sent from module 0.9.0.
    favorites: listOf(favoriteSchema),
  })
  .nullable()
  .optional()
  .catch(null)

/** A size in bytes, as the module counts one; null where it can't be read. */
const byteCount = z.int().min(0).nullable().catch(null)

/** Why the module held a sheet back, such as for its size; left out where it can't be read. */
const sheetWithheldSchema = z
  .looseObject({
    reason: z.string().max(32),
    bytes: byteCount,
    limit: byteCount,
  })
  .optional()
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  .catch(undefined)

const characterSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  // From module 0.22.0, a sheet may come slim, which is made whole before it's read, so that it's
  // read, and kept, as the module built it. Absent from that module's hello, and kept absent.
  sheet: z.preprocess(expandSheet, sheetSchema),
  // From module 0.22.0: why its sheet is null, where the module held it back, such as for its
  // size. Left out where it can't be read.
  sheetWithheld: sheetWithheldSchema,
  // From module 0.26.0, in a hello's roster, and from 0.32.0 in an update too: whether its player
  // may enter its dice results here, as the module says from 0.32.0; always false before. Left
  // out, as sent, by an older module; false where it can't be read.
  manualDice: z.boolean().optional().catch(false),
})

/**
 * One of a campaign's Group actors, such as its party, from module 0.30.0: who may see it, by
 * campaign character, each with Observer or Owner on it in Foundry. Access that can't be read is
 * taken as no one's, never as more.
 */
const groupEntrySchema = z.looseObject({
  id: z.string().regex(DOCUMENT_ID),
  uuid: z.string().max(200),
  name: z.string().max(500),
  img: nullableString,
  type: z.literal('group'),
  primary: z.boolean().catch(false),
  access: z
    .record(z.string().regex(DOCUMENT_ID), z.enum(['observer', 'owner']))
    .catch({}),
})

/**
 * One of a group's members: its name and portrait, and nothing else. Anything more is dropped, so
 * that nothing a later module sends of it, such as its hit points, is ever kept.
 */
const groupMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  type: z.enum(['character', 'npc', 'vehicle']),
  character: z.boolean().catch(false),
})

/**
 * A group's sheet, made whole first where it comes slim, as a character's is: its members, its
 * descriptions by hash, and its stash, as a character's inventory is sent.
 */
const groupSheetSchema = z.preprocess(
  expandSheet,
  z
    .looseObject({
      members: listOf(groupMemberSchema),
      description: z
        .looseObject({ full: textRef, summary: textRef })
        .catch({ full: null, summary: null }),
      inventory: inventorySchema,
    })
    .nullable(),
)

/** A name or label kept to this many characters: cut, never refused for its length. */
const cutTo = (most: number) =>
  z.string().transform(text => text.slice(0, most))

/**
 * One of a campaign's characters' companions, from module 0.36.0: its key, the campaign characters
 * it's a companion of, at least one, its kind, its actor, token and scene, its name, cut, and its
 * portrait, which costs the entry nothing where it can't be read, as what summoned it doesn't.
 */
const companionEntrySchema = z.looseObject({
  key: z.string().regex(COMPANION_KEY),
  of: z.array(z.string().regex(ACTOR_ID)).min(1).max(20),
  kind: z.enum(['owned', 'summoned']),
  actorId: z.string().regex(ACTOR_ID),
  tokenId: z.string().regex(DOCUMENT_ID).nullable(),
  sceneId: z.string().regex(DOCUMENT_ID).nullable(),
  uuid: z.string().max(200),
  name: cutTo(200),
  img: z.string().max(2000).nullable().catch(null),
  summon: z
    .looseObject({
      itemId: z.string().regex(DOCUMENT_ID),
      item: cutTo(200),
      activityId: z.string().regex(DOCUMENT_ID).nullable().catch(null),
    })
    .nullable()
    .catch(null),
  sheetWithheld: sheetWithheldSchema,
})

/**
 * A campaign's companions, as the module lists them: one that can't be read is dropped, as is one
 * listed again under the same key, and no more than the most a list holds are kept.
 */
const companionsSchema = listOf(companionEntrySchema).transform(entries =>
  entries
    .filter(
      (entry, index) =>
        entries.findIndex(({ key }) => key === entry.key) === index,
    )
    .slice(0, MOST_COMPANIONS),
)

export const rollSchema = z.looseObject({
  formula: z.string().catch(''),
  total: z.number().nullable().catch(null),
  dice: z
    .array(
      z.looseObject({
        faces: z.number().nullable().catch(null),
        results: z
          .array(z.object({ result: z.number(), active: z.boolean() }))
          .catch([]),
      }),
    )
    .catch([]),
  // What marks a roll, each left out where it doesn't apply, or can't be read: the class it has
  // always had, and from module 0.28.0, what it says of damage and attacks.
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  class: z.string().max(100).optional().catch(undefined),
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  damage: z.literal(true).optional().catch(undefined),
  damageLabel: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  section: z
    .enum(['damage', 'bonus', 'other'])
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  flavor: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  attack: z.literal(true).optional().catch(undefined),
})

/** The most characters a save's outcome is said to be seen by: more than any campaign has. */
const MAX_READERS = 200

/** Someone a message was aimed at: their name, and what came of it, where players see it. */
const targetSchema = z.looseObject({
  name: z.string(),
  ac: z.number().nullable().optional().catch(null),
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  uuid: z.string().min(1).max(500).optional().catch(undefined),
  // From module 0.29.0, where players see them in Foundry.
  outcome: z
    .enum(['hit', 'miss'])
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- as for the uuid
    .catch(undefined),
  save: z
    .enum(['success', 'failure'])
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- as for the uuid
    .catch(undefined),
})

/**
 * A save or check a message is the roll of: whose, and whether it succeeded, where players see it.
 * A readers list that can't be read drops it all, rather than show its outcome to everyone.
 */
const rollOutcomeSchema = z.looseObject({
  target: z.string().min(1).max(500),
  outcome: z
    .enum(['success', 'failure'])
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  readers: z.array(z.string()).max(MAX_READERS).optional(),
})

const dnd5eSchema = z
  .looseObject({
    messageType: nullableString,
    roll: z.looseObject({}).nullable().catch(null),
    item: z
      .looseObject({ name: nullableString, type: nullableString.optional() })
      .nullable()
      .catch(null),
    activity: z
      .looseObject({ name: nullableString, type: nullableString })
      .nullable()
      .catch(null),
    // From module 0.30.0, one that can't be read drops only itself, not the others with it.
    targets: listOf(targetSchema),
    originatingMessage: nullableString.optional(),
    // From module 0.29.0, on a save rolled from dnd5e's card: whose, and whether it succeeded; and
    // from module 0.30.0, on a save from anywhere.
    // eslint-disable-next-line unicorn/no-useless-undefined -- as for its outcome
    save: rollOutcomeSchema.optional().catch(undefined),
    // From module 0.30.0, the same of an ability, skill or tool check.
    // eslint-disable-next-line unicorn/no-useless-undefined -- as for its outcome
    check: rollOutcomeSchema.optional().catch(undefined),
  })
  .nullable()
  .catch(null)

/** What an ask says besides what it asks for: its DC, and what asks for it. */
const askFields = {
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out where it can't be read
  dc: z.int().min(1).max(99).optional().catch(undefined),
  label: z
    .string()
    .trim()
    .max(200)
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- as for the DC
    .catch(undefined)
    .transform(label => label || undefined),
}

/**
 * One way a check the table is asked for may be made: an ability check, or a skill's or a tool's,
 * each with the ability it's made with; a skill's names its skill, a tool's its tool, and only
 * they do. A tool's name is the game's, where it says.
 */
const askedCheckSchema = z
  .object({
    type: z.enum(['check', 'skill', 'tool']),
    ability: abilityId,
    skill: checkKey.optional(),
    tool: checkKey.optional(),
    name: z
      .string()
      .trim()
      .max(100)
      .optional()
      // eslint-disable-next-line unicorn/no-useless-undefined -- as an ask's DC
      .catch(undefined)
      .transform(name => name || undefined),
  })
  .refine(
    check =>
      (check.type === 'skill') === (check.skill !== undefined) &&
      (check.type === 'tool') === (check.tool !== undefined),
  )

/**
 * The saving throw a roll request card asks the table for, from module 0.17.0: one the Gamemaster
 * posted from a description, or one a player asked for from the app; or from module 0.18.0, the
 * check. Its abilities are dnd5e's own, never a name any object answers to, as are its skills' and
 * tools' keys; its DC is there only where players may see it, and what asks for it, such as an
 * item, is a name. Null for any other message, and for one that can't be read, which then shows as
 * its text, as one of a kind a later module adds does; absent from an older module, whose cards are
 * read from their buttons instead.
 */
const askSchema = z
  .discriminatedUnion('type', [
    z
      .object({
        type: z.enum(['save', 'concentration']),
        abilities: z
          .array(abilityId)
          .max(6)
          .transform(ids => [...new Set(ids)]),
        ...askFields,
      })
      .refine(ask => ask.type === 'concentration' || ask.abilities.length > 0),
    z.object({
      type: z.literal('check'),
      checks: z.array(askedCheckSchema).min(1).max(MAX_CHECKS),
      ...askFields,
    }),
  ])
  .nullable()
  .optional()
  .catch(null)

const messageSchema = z.looseObject({
  id: z.string(),
  type: z.string().catch('base'),
  timestamp: z.number(),
  speaker: z
    .looseObject({ alias: nullableString, actorId: nullableString })
    .catch({ alias: null, actorId: null }),
  author: z
    .looseObject({ id: z.string(), name: z.string() })
    .nullable()
    .catch(null),
  character: nullableString,
  title: nullableString,
  flavor: z.string().catch(''),
  text: z.string().catch(''),
  audience: z.looseObject({
    public: z.boolean(),
    characters: z.array(z.string()),
  }),
  rolls: z.array(rollSchema).catch([]),
  dnd5e: dnd5eSchema,
  // From module 0.17.0.
  ask: askSchema,
  // From module 0.23.0: the roll a message says the campaign's Gamemaster made here as a character.
  // Its author may write it, so it's only a claim, checked against the rolls handed over.
  gmRoll: z
    .string()
    .regex(/^[\w-]{1,64}$/)
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- no claim, where it can't be read
    .catch(undefined),
  // From module 0.36.0, to an app that reads companions: the listed companion that spoke it.
  companion: z.string().regex(COMPANION_KEY).nullable().optional().catch(null),
})

/**
 * What the module does for a campaign beyond sending its events. Features it can't describe are
 * taken as missing, as from a module before 0.10.0.
 */
const featuresSchema = z
  .looseObject({
    rolls: z
      .looseObject({
        enabled: z.boolean().catch(false),
        kinds: z.array(z.string()).catch([]),
        reason: nullableString.optional().transform(reason => reason ?? null),
        // From module 0.13.0: whether players may change their damage, and whether they're
        // asked for the saves their game asks of them.
        modifiers: z.boolean().optional().catch(false),
        prompts: z.boolean().optional().catch(false),
        // From module 0.16.0: whether an area attack is made at the combatants its player picks.
        areaAttacks: z.boolean().optional().catch(false),
        // From module 0.21.0: whether a check an activity asks for, the player's own, is made
        // against it.
        activityChecks: z.boolean().optional().catch(false),
        // From module 0.21.0: whether more dice and another die change only a die damage adds,
        // never one it takes away, which its previews mark.
        signedDice: z.boolean().optional().catch(false),
        // From module 0.22.0: whether a use may be made at its user.
        selfTargets: z.boolean().optional().catch(false),
        // From module 0.23.0: whether a roll may say it's the Gamemaster's, made as the character
        // and marked as theirs.
        gmRolls: z.boolean().optional().catch(false),
        // From module 0.25.0: whether each of those rolls' results lists the messages it made.
        gmRollMessages: z.boolean().optional().catch(false),
        // From module 0.26.0: whether players may enter their own dice's results, where the
        // Manual Dice module is on.
        manualDice: z.boolean().optional().catch(false),
        // From module 0.27.0: whether what Midi-QOL asks of characters is asked here too.
        midiPrompts: z.boolean().optional().catch(false),
      })
      .nullable()
      .optional()
      .catch(null),
    // From module 0.31.0: whether its players may move items and coins from here, apart from the
    // rolls.
    transfers: z
      .looseObject({
        enabled: z.boolean().catch(false),
        kinds: z.array(z.string()).catch([]),
        reason: nullableString.optional().transform(reason => reason ?? null),
        // From module 0.32.0: a party's things may be sent elsewhere by its Owner, and its coin
        // distributed.
        partySends: z.boolean().optional().catch(false),
        distribute: z.boolean().optional().catch(false),
      })
      .nullable()
      .optional()
      .catch(null),
    // From module 0.33.0: whether an item may be removed from a character here, under dnd5e, with
    // no switch of its own.
    removals: z
      .looseObject({
        enabled: z.boolean().catch(false),
        kinds: z.array(z.string()).catch([]),
        reason: nullableString.optional().transform(reason => reason ?? null),
      })
      .nullable()
      .optional()
      .catch(null),
    // From module 0.34.0: whether journal notes are kept here, under any system, with no switch,
    // and which of the campaign's characters and parties have a journal of them in Foundry.
    notes: z
      .looseObject({
        enabled: z.boolean().catch(false),
        kinds: z.array(z.string()).catch([]),
        reason: nullableString.optional().transform(reason => reason ?? null),
        journals: z
          .array(
            z.object({
              kind: z.enum(['personal', 'party']),
              actorId: z.string().regex(ACTOR_ID),
            }),
          )
          .max(2000)
          .catch([]),
        // From module 0.35.0: it takes the app's orders of a group's notes, and says who changed a
        // journal in Foundry. Anything but a boolean is read as unsaid.
        // eslint-disable-next-line unicorn/no-useless-undefined -- unsaid, as junk
        orders: z.boolean().optional().catch(undefined),
        // eslint-disable-next-line unicorn/no-useless-undefined -- unsaid, as junk
        changes: z.boolean().optional().catch(undefined),
      })
      .nullable()
      .optional()
      .catch(null),
    // From module 0.36.0: the kinds a companion's rolls may be, and how companions enter
    // initiative, where anything but "after" is each its own roll.
    companions: z
      .looseObject({
        kinds: z.array(z.string()).catch([]),
        initiative: z.enum(COMPANION_INITIATIVE).catch('own'),
      })
      .optional()
      // eslint-disable-next-line unicorn/no-useless-undefined -- unsaid, as junk
      .catch(undefined),
  })
  .nullable()
  .optional()
  .catch(null)

/** A journal page's revision, as the module computes one: 14 hexadecimal digits. */
const NOTE_REV = /^[\da-f]{14}$/

/**
 * One of a journal's notes as Foundry holds it, from module 0.34.0. The module sends only what
 * this takes (round 0.34.0 §2.8), as one that can't be read fails the whole event.
 */
const journalPageSchema = z
  .object({
    id: z.string().regex(NOTE_ID),
    role: z.enum(['chapter', 'entry']),
    chapter: z.string().regex(NOTE_ID).nullable(),
    title: z.string().min(1).max(MOST_NOTE_TITLE),
    format: z.union([z.literal(1), z.literal(2)]),
    markdown: z.string().max(MOST_NOTE_TEXT).optional(),
    html: z.string().max(MOST_NOTE_TEXT).optional(),
    cut: z.literal(true).optional(),
    secret: z.literal(true).optional(),
    createdAt: z.int().min(0),
    modifiedAt: z.int().min(0),
    modifiedBy: z.string().max(200),
    modifiedIn: z.enum(['app', 'foundry']),
    author: z
      .object({
        actorId: z.string().regex(ACTOR_ID).nullable(),
        gm: z.boolean(),
        name: z.string().max(200),
      })
      .nullable(),
    rev: z.string().regex(NOTE_REV),
  })
  // Its text in the form it's in, and a secret only on a page sent as HTML.
  .refine(page =>
    page.format === 2
      ? page.markdown !== undefined && page.secret === undefined
      : page.html !== undefined,
  )

/** A character's or a party's journal of notes as Foundry holds it, from module 0.34.0. */
const journalUpdatedSchema = z.looseObject({
  kind: z.enum(['personal', 'party']),
  actorId: z.string().regex(ACTOR_ID),
  journal: z
    .object({
      id: z.string().regex(DOCUMENT_ID),
      name: z.string().max(200),
      notes: z.array(journalPageSchema).max(MOST_NOTES),
      // From module 0.35.0, to an app that answers `notes: 2`: who last deleted or reordered a
      // page the app is sent, in Foundry, and when. An odd one is dropped, never the book.
      changed: z
        .object({
          what: z.enum(['delete', 'order']),
          by: z.string().max(200),
          at: z.int().min(0),
        })
        .optional()
        // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
        .catch(undefined),
    })
    .nullable(),
  withheld: z
    .discriminatedUnion('reason', [
      z.object({ reason: z.literal('private') }),
      z.object({
        reason: z.literal('tooLarge'),
        bytes: z.int().min(0),
        limit: z.int().min(0),
      }),
    ])
    .optional(),
})

/** What a prompt may be rolled with: an ability's key, such as "dex", or a skill's, as "ath". */
const promptKey = z.string().regex(/^[A-Za-z][\w-]{0,31}$/)

/** What every prompt says, whatever asks it. Its label is only shown. */
const promptFields = {
  id: z.string().regex(PROMPT_ID),
  actorId: z.string().min(1).max(64),
  messageId: z.string().min(1).max(64),
  dc: z.int().min(0).max(100).nullable().catch(null),
  label: z
    .string()
    .max(200)
    .nullable()
    .optional()
    .catch(null)
    .transform(label => label || null),
  openedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
}

/**
 * A saving throw a chat card asks of one of a campaign's characters, from module 0.13.0, read as it
 * was before Midi-QOL's: one without what it asks for can't be rolled, and anything else it says
 * is dropped. It says nothing of where it comes from.
 */
const cardPromptSchema = z.object({
  ...promptFields,
  type: z.enum(['save', 'concentration']),
  abilities: z.array(promptKey).min(1).max(10),
  source: z.never().optional(),
})

/**
 * What Midi-QOL asks of one of a campaign's characters, from module 0.27.0, which says where it
 * comes from: a save or concentration check by its abilities, an ability check by its abilities,
 * or a skill check by its skills, and how Midi-QOL has each rolled. Advantage for one it doesn't
 * offer is dropped; anything else amiss fails it, as this app couldn't answer it as asked.
 */
const midiPromptSchema = z
  .object({
    ...promptFields,
    type: z.enum(['save', 'concentration', 'check', 'skill']),
    abilities: z.array(promptKey).max(10),
    skills: z.array(promptKey).min(1).max(10).optional(),
    source: z.enum(PROMPT_SOURCES),
    advantage: z.record(z.string(), z.enum(['adv', 'dis'])).optional(),
    askedInFoundry: z.boolean().optional(),
  })
  .superRefine((prompt, context) => {
    const skill = prompt.type === 'skill'
    if (skill !== (prompt.skills !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['skills'],
        message: 'A skill check, and only one, offers skills',
      })
    }
    if (!skill && prompt.abilities.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['abilities'],
        message: 'A save or ability check offers an ability',
      })
    }
  })
  .transform(prompt => {
    const offered = new Set(
      prompt.type === 'skill' ? prompt.skills : prompt.abilities,
    )
    return {
      ...prompt,
      advantage: Object.fromEntries(
        Object.entries(prompt.advantage ?? {}).filter(([key]) =>
          offered.has(key),
        ),
      ),
      askedInFoundry: prompt.askedInFoundry ?? false,
    }
  })

/**
 * What the game asks of one of a campaign's characters: what a chat card asks, as before, or what
 * Midi-QOL asks, which says where it comes from. One that says so is only ever read as Midi-QOL's.
 */
const promptSchema = z.union([midiPromptSchema, cardPromptSchema])

/**
 * What became of a command; one without its id, or an outcome, can't be recorded. It's kept as
 * read, so only what the app shows is kept.
 */
const commandResultSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(['done', 'failed']),
  reason: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .catch(null)
    .transform(value => value ?? null),
  error: z
    .string()
    .max(1000)
    .nullable()
    .optional()
    .catch(null)
    .transform(value => value ?? null),
  messageId: z
    .string()
    .max(64)
    .nullable()
    .optional()
    .catch(null)
    .transform(value => value ?? null),
  visible: z.boolean().catch(false),
  // For hit dice, every roll of every card they made, as many as a module adds to each.
  rolls: z.array(rollSchema).max(40).catch([]),
  // From module 0.11.0, for an attack.
  attack: z
    .object({
      critical: z.boolean().catch(false),
      fumble: z.boolean().catch(false),
      outcome: z.enum(['hit', 'miss']).nullable().catch(null),
      // From module 0.16.0, for an area attack: whether it hit each combatant picked.
      targets: z
        .array(
          z.object({
            combatId: z.string().max(64),
            combatantId: z.string().max(64),
            outcome: z.enum(['hit', 'miss']).nullable().catch(null),
          }),
        )
        .max(MAX_USE_TARGETS)
        .optional()
        // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as by older modules
        .catch(undefined),
    })
    .nullable()
    .optional()
    .catch(null),
  // From module 0.12.0, for a use.
  use: z
    .object({ type: z.string().max(32) })
    .nullable()
    .optional()
    .catch(null),
  // From module 0.13.0, for a save the game asked for.
  outcome: z.enum(['success', 'failure']).nullable().optional().catch(null),
  // From module 0.16.0, for a hit die; from 0.20.0, for hit dice.
  healed: z.int().min(0).max(1_000_000).nullable().optional().catch(null),
  // From module 0.20.0, for hit dice.
  spent: z
    .object({
      count: z.int().min(1).max(MOST_HIT_DICE),
      made: z.int().min(0).max(MOST_HIT_DICE),
    })
    .nullable()
    .optional()
    .catch(null),
  // From module 0.21.0, for a use of an enchant activity, or an enchantment ended: the enchantment
  // applied and the one ended, each null where none was, or it can't be read.
  enchantment: z
    .object({
      enchanted: z
        .object({
          item: z.string().max(64),
          itemName: z.string().max(200),
          effect: z.string().max(64),
          profile: z.string().max(64),
          name: z.string().max(200),
        })
        .nullable()
        .catch(null),
      ended: z
        .object({
          item: z.string().max(64),
          itemName: z.string().max(200),
          effect: z.string().max(64),
          name: z.string().max(200),
        })
        .nullable()
        .catch(null),
    })
    .nullable()
    .optional()
    .catch(null),
  damage: damagePreviewSchema.nullable().optional().catch(null),
  // From module 0.25.0, for the Gamemaster's roll as a character: the ids of the chat messages it
  // made, which alone are marked as theirs. Anything else is ignored, as from an older module.
  messages: z
    .array(z.string().min(1).max(64))
    .max(MAX_GM_ROLL_MESSAGES)
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // From module 0.31.0, for a move of items and coins: what moved, by ids and counts alone, never
  // a name. Anything else is left out, and the rest still read.
  transfer: z
    .object({
      from: z.string().min(1).max(64),
      // None for a distribution, from module 0.32.0, which lists who was given a share in `among`.
      to: z.string().min(1).max(64).nullable(),
      items: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            quantity: z.int().min(1).max(MOST_MOVED),
            created: z.string().min(1).max(64).nullable(),
            stacked: z.string().min(1).max(64).nullable(),
          }),
        )
        .max(MOST_MOVED_ITEMS),
      currency: z
        .record(z.string().min(1).max(64), z.int().min(1).max(MOST_MOVED))
        // As many kinds of coin as a move may name.
        .refine(coins => Object.keys(coins).length <= 10)
        .nullable(),
      // A distribution's characters that were given their share, in order (module 0.32.0).
      among: z.array(z.string().min(1).max(64)).max(MOST_AMONG).optional(),
    })
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // From module 0.33.0, for an item removed: it, and how many of its stack, where it changed.
  removed: z
    .object({
      item: z.string().min(1).max(64),
      quantity: z.int().min(0).max(MOST_MOVED),
    })
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // From module 0.34.0, for a note command: the note, and its page's revision now, never its text.
  note: z
    .object({
      id: z.string().regex(NOTE_ID),
      rev: z.string().regex(NOTE_REV).nullable(),
      deleted: z.literal(true).optional(),
    })
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // From module 0.35.0, for an order of a group's notes: the group's order in Foundry after it, or
  // on a refusal its order then, by the notes' ids alone.
  order: z
    .object({
      chapter: z.string().regex(NOTE_ID).nullable(),
      ids: z.array(z.string().regex(NOTE_ID)).max(MOST_NOTES),
    })
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
})

const hitPointsSchema = z
  .object({
    value: z.number(),
    max: z.number().nullable(),
    temp: z.number().catch(0),
  })
  .nullable()
  .optional()
  .catch(null)

export const combatantSchema = z.looseObject({
  id: z.string(),
  name: z.string().catch(''),
  initiative: z.number().nullable().catch(null),
  defeated: z.boolean().catch(false),
  character: nullableString,
  playerOwned: z.boolean().catch(false),
  hp: hitPointsSchema,
  hidden: z.boolean().optional(),
  // Module 0.29.0. Anything else, such as a number, is dropped, so a secret one is never kept.
  disposition: z
    .enum(['friendly', 'neutral', 'hostile'])
    .nullable()
    .optional()
    // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
    .catch(undefined),
  // From module 0.36.0, to an app that reads companions: the listed companion it is.
  companion: z.string().regex(COMPANION_KEY).nullable().optional().catch(null),
})

const combatSchema = z.looseObject({
  id: z.string(),
  name: nullableString,
  active: z.boolean(),
  started: z.boolean(),
  round: z.number(),
  combatantId: nullableString,
  combatants: z.array(combatantSchema),
})

const withCombat = z.looseObject({ combat: combatSchema })
const withCombatant = z.looseObject({
  combatId: z.string(),
  combatant: combatantSchema,
})

/**
 * Check the payload of an event this app acts on.
 * @param type - The envelope's type.
 * @param data - The envelope's data.
 * @returns The event, or undefined for a type this app does not act on.
 * @throws {z.ZodError} When the payload is missing something the app relies on.
 */
export function parseGameEvent(
  type: string,
  data: unknown,
): GameEvent | undefined {
  switch (type) {
    case EVENTS.HELLO: {
      return {
        type,
        data: z
          .looseObject({
            characters: z.array(characterSchema),
            // From module 0.30.0; none from an older module. One that can't be read is dropped.
            groups: listOf(groupEntrySchema),
            // From module 0.36.0, as `groups` are: none from an older module, which clears them.
            companions: companionsSchema,
            combats: z.array(combatSchema),
            // Sent from module 0.10.0.
            features: featuresSchema,
            // Sent from module 0.13.0; none from an older module.
            prompts: listOf(promptSchema),
            // From module 0.22.0: its characters carry no sheets, which follow it.
            sheetsApart: z.boolean().optional().catch(false),
            // What Foundry says of itself, for the Gamemaster's card alone: its versions, from
            // every module; and from module 0.30.0, its settings. None that can't be read ever
            // refuses the hello.
            module: z
              .looseObject({
                id: z.string().max(100),
                version: z.string().max(50).nullable(),
              })
              .optional()
              // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
              .catch(undefined),
            foundry: z
              .looseObject({
                version: z.string().max(50),
                generation: z.number().nullable().optional(),
              })
              .optional()
              // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
              .catch(undefined),
            system: z
              .looseObject({
                id: z.string().max(100),
                title: z.string().max(200),
                version: z.string().max(50),
              })
              .optional()
              // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
              .catch(undefined),
            // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
            settings: foundrySettingsSchema.optional().catch(undefined),
          })
          .parse(data),
      }
    }
    case EVENTS.CHARACTER_UPDATED: {
      return {
        type,
        data: z.looseObject({ character: characterSchema }).parse(data),
      }
    }
    case EVENTS.CHARACTER_TEXTS: {
      const { texts } = z
        .looseObject({ texts: z.record(z.string(), z.unknown()) })
        .parse(data)
      // A malformed description is dropped. If a sheet needs it, the app asks for it again.
      return {
        type,
        data: {
          texts: Object.fromEntries(
            Object.entries(texts).filter(
              (entry): entry is [string, string] =>
                TEXT_HASH.test(entry[0]) &&
                typeof entry[1] === 'string' &&
                entry[1].length <= LONGEST_TEXT,
            ),
          ),
        },
      }
    }
    case EVENTS.CHAT_CREATED:
    case EVENTS.CHAT_UPDATED: {
      return {
        type,
        data: z.looseObject({ message: messageSchema }).parse(data),
      }
    }
    case EVENTS.CHAT_DELETED: {
      return { type, data: z.looseObject({ id: z.string() }).parse(data) }
    }
    case EVENTS.CHAT_CLEARED: {
      return { type, data: {} }
    }
    case EVENTS.COMBAT_CREATED:
    case EVENTS.COMBAT_STARTED:
    case EVENTS.COMBAT_TURN:
    case EVENTS.COMBAT_UPDATED:
    case EVENTS.COMBAT_ENDED: {
      return { type, data: withCombat.parse(data) }
    }
    case EVENTS.COMBATANT_ADDED:
    case EVENTS.COMBATANT_UPDATED: {
      return { type, data: withCombatant.parse(data) }
    }
    case EVENTS.COMBATANT_REMOVED: {
      return {
        type,
        data: z
          .looseObject({ combatId: z.string(), combatantId: z.string() })
          .parse(data),
      }
    }
    case EVENTS.COMMAND_RESULT: {
      return { type, data: commandResultSchema.parse(data) }
    }
    case EVENTS.PROMPT_OPENED: {
      return {
        type,
        data: z.looseObject({ prompt: promptSchema }).parse(data),
      }
    }
    case EVENTS.PROMPT_CLOSED: {
      return {
        type,
        data: z
          .looseObject({
            id: z.string().regex(PROMPT_ID),
            reason: z.string().max(32).catch('gone'),
          })
          .parse(data),
      }
    }
    case EVENTS.GROUP_UPDATED: {
      return {
        type,
        data: z
          .looseObject({
            group: groupEntrySchema.extend({
              sheet: groupSheetSchema,
              sheetWithheld: sheetWithheldSchema,
            }),
          })
          .parse(data),
      }
    }
    case EVENTS.GROUP_REMOVED: {
      return {
        type,
        data: z.looseObject({ id: z.string().regex(DOCUMENT_ID) }).parse(data),
      }
    }
    case EVENTS.BRIDGE_SETTINGS: {
      return {
        type,
        data: z
          .looseObject({
            // eslint-disable-next-line unicorn/no-useless-undefined -- as in the hello
            settings: foundrySettingsSchema.optional().catch(undefined),
          })
          .parse(data),
      }
    }
    case EVENTS.JOURNAL_UPDATED: {
      return { type, data: journalUpdatedSchema.parse(data) }
    }
    case EVENTS.COMPANIONS_LISTED: {
      return {
        type,
        data: z.looseObject({ companions: companionsSchema }).parse(data),
      }
    }
    case EVENTS.COMPANION_UPDATED: {
      return {
        type,
        data: z
          .looseObject({
            companion: companionEntrySchema,
            // Made whole first where it comes slim, as a character's is; none where it can't be
            // read.
            sheet: z
              .preprocess(expandSheet, sheetSchema)
              .transform(sheet => sheet ?? null),
          })
          .parse(data),
      }
    }
    default: {
      return undefined
    }
  }
}
