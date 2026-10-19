/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { z } from 'zod'
import type { FoundrySettings } from '@/types/foundry-settings'

// The Foundry settings a module from 0.30.0 sends with each hello, and in bridge.settings when one
// changes. Only the Gamemaster's campaign card shows them, so nothing here gates what anyone else
// sees. Each list keeps the entries it can read, up to a cap, and only the keys this app shows, so
// what is stored for a campaign stays small whatever a later module sends.

/** The longest string kept: a label, a choice as Foundry names it, a note or a line of results. */
const LONGEST = 300

/** The longest value kept as a string: a setting's raw value, which the card doesn't show. */
const LONGEST_VALUE = 100

const text = z.string().max(LONGEST)

/** A list whose malformed entries are dropped, rather than failing the whole list, up to `most`. */
const listOf = <T extends z.ZodType>(entry: T, most: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform(entries =>
      entries.slice(0, most).flatMap(value => {
        const parsed = entry.safeParse(value)
        return parsed.success ? [parsed.data as z.output<T>] : []
      }),
    )

const moduleSchema = z.object({
  id: text,
  title: text,
  version: z.string().max(LONGEST).nullable().catch(null),
  active: z.boolean().catch(false),
})

const rowSchema = z.object({
  id: text,
  label: text,
  value: z
    .union([z.boolean(), z.string().max(LONGEST_VALUE), z.number(), z.null()])
    .catch(null),
  text,
  // eslint-disable-next-line unicorn/no-useless-undefined -- left out, as junk
  note: z.string().max(LONGEST).optional().catch(undefined),
})

const sectionSchema = z.object({
  id: text,
  title: text,
  rows: listOf(rowSchema, 40),
})

const resultSchema = z.object({
  id: text,
  state: z.enum(['shown', 'partial', 'hidden']),
  text,
})

/**
 * Foundry's settings for a campaign, format 1. It throws on anything that isn't one at all, such
 * as another format; where it's read, that is taken as no settings, never as a refusal.
 */
export const foundrySettingsSchema: z.ZodType<FoundrySettings> = z.object({
  format: z.literal(1),
  modules: listOf(moduleSchema, 20),
  sections: listOf(sectionSchema, 8),
  results: listOf(resultSchema, 8),
})
