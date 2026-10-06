/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { z } from 'zod'
import { EVENTS } from '@/constants/sending-stone'
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
  text: textRef,
})

/**
 * The item a spell is cast from, such as a wand. Left out, as sent, by modules before 0.8.2, so
 * that a sheet from one reads as it did; null for one that can't be read.
 */
const castFromSchema = z
  .object({ id: z.string(), name: z.string() })
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
  text: textRef,
})

const detailSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  value: z.string(),
})

const actionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  img: nullableString,
  type: z.string().catch(''),
  activation: nullableString,
  range: nullableString,
  target: nullableString,
  toHit: nullableNumber,
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
  uses: usesSchema,
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
  })
  .nullable()
  .optional()
  .catch(null)

const characterSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  sheet: sheetSchema,
})

const rollSchema = z.looseObject({
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
    default: {
      return undefined
    }
  }
}
