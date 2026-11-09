import { z } from 'zod'

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

/**
 * A list read entry by entry: the entries `entry` can't read dropped, never failing the whole, then
 * cut to its first `most`, so one it can't read never pushes out one it can; anything but a list
 * reads as none.
 * @param entry - What each entry holds when it can be read.
 * @param most - The most entries kept; every one read, where none is given.
 */
export function listOf<T extends z.ZodType>(entry: T, most?: number) {
  return z
    .array(z.unknown())
    .catch([])
    .transform(entries => {
      const read = entries.flatMap(value => {
        const parsed = entry.safeParse(value)
        return parsed.success ? [parsed.data as z.output<T>] : []
      })
      return most === undefined ? read : read.slice(0, most)
    })
}
