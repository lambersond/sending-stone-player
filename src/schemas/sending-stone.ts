/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { z } from 'zod'
import { ABILITIES } from '@/constants/dnd5e'
import {
  DAMAGE_TYPE,
  EVENTS,
  MAX_DAMAGE_TERMS,
  MAX_USE_TARGETS,
  PROMPT_ID,
} from '@/constants/sending-stone'
import { MAX_CHECKS } from '@/utils/description-links'
import { MAX_DICE } from '@/utils/roll-modifiers'
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

const conditionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  level: nullableNumber,
  detail: nullableString,
  text: textRef,
})

/**
 * What else an action is used through in the game, and whom at, from module 0.12.0: one of the
 * kinds of activity the game uses, or none.
 */
const useSchema = z
  .looseObject({
    id: z.string().min(1),
    type: z.enum(['save', 'damage', 'heal', 'utility']),
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
    }),
  })
  .nullable()
  .optional()
  .catch(null)

const usesSchema = z
  .looseObject({
    value: z.number(),
    max: z.number(),
    recovery: nullableString,
  })
  .nullable()
  .catch(null)

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
    })
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
  consumesSlot: rollFields.consumesSlot,
  attackArea: rollFields.attackArea,
  rollFormula: rollFields.rollFormula,
  // From module 0.15.0, for a Cast, how its spell is cast; and from 0.17.0, its description.
  cast: rollFields.cast,
  spellId: rollFields.spellId,
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

const inventorySchema = z
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
  }),
])

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

const characterSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  sheet: sheetSchema,
})

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
    targets: z
      .array(
        z.looseObject({
          name: z.string(),
          ac: z.number().nullable().optional().catch(null),
        }),
      )
      .catch([]),
    originatingMessage: nullableString.optional(),
  })
  .nullable()
  .catch(null)

/** One of dnd5e's abilities, never a name any object answers to. */
const abilityId = z.string().refine(id => Object.hasOwn(ABILITIES, id))

/** A skill's or tool's key, as dnd5e's are. */
const checkKey = z.string().regex(/^[A-Za-z][\w-]{0,31}$/)

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
      })
      .nullable()
      .optional()
      .catch(null),
  })
  .nullable()
  .optional()
  .catch(null)

/**
 * A saving throw the game asks of one of a campaign's characters, from module 0.13.0. One without
 * what it asks for can't be rolled; its label is only shown.
 */
const promptSchema = z.object({
  id: z.string().regex(PROMPT_ID),
  actorId: z.string().min(1).max(64),
  messageId: z.string().min(1).max(64),
  type: z.enum(['save', 'concentration']),
  abilities: z
    .array(z.string().regex(/^[A-Za-z][\w-]{0,31}$/))
    .min(1)
    .max(10),
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
})

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
  rolls: z.array(rollSchema).max(10).catch([]),
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
  // From module 0.16.0, for a hit die.
  healed: z.int().min(0).max(1_000_000).nullable().optional().catch(null),
  damage: z
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
    // Damage throwing more dice than a player may send is rolled by the game.
    .transform(damage =>
      damage.rolls.flatMap(roll => roll.dice).length > MAX_DAMAGE_TERMS
        ? {
            ...damage,
            plannable: false,
            rolls: damage.rolls.map(roll => ({ ...roll, dice: [] })),
          }
        : damage,
    )
    .nullable()
    .optional()
    .catch(null),
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
            combats: z.array(combatSchema),
            // Sent from module 0.10.0.
            features: featuresSchema,
            // Sent from module 0.13.0; none from an older module.
            prompts: listOf(promptSchema),
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
    default: {
      return undefined
    }
  }
}
