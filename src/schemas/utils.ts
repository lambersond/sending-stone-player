import type { z } from 'zod'

/**
 * A field left out where it can't be read: what `schema` reads, or undefined for anything else,
 * never a failure of the whole.
 * @param schema - What the field holds when it can be read.
 * @returns The lenient schema, as `schema.optional().catch(undefined)`.
 */
export function leftOut<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined)
}

/**
 * A field that is null where it can't be read: what `schema` reads, or null for anything else.
 * @param schema - What the field holds when it can be read.
 * @returns The lenient schema, as `schema.nullable().catch(null)`.
 */
export function orNull<T extends z.ZodType>(schema: T) {
  return schema.nullable().catch(null)
}
