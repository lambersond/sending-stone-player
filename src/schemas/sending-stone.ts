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

const characterSchema = z.looseObject({ id: z.string(), name: z.string() })

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
    item: z.looseObject({ name: nullableString }).nullable().catch(null),
    activity: z
      .looseObject({ name: nullableString, type: nullableString })
      .nullable()
      .catch(null),
    targets: z.array(z.looseObject({ name: z.string() })).catch([]),
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
