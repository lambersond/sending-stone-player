import type { RollRequestInput } from '@/types/roll'

/**
 * A container as the sheet's schema reads it: one of the character's items, `Item` as the schema
 * reads those, with its capacity and what it holds, items and containers of their own.
 */
export type ParsedContainer<Item> = Item & {
  capacity: { value: number; max: number; units: string } | null
  contents: (Item | ParsedContainer<Item>)[] | null
}

/** Reports what a schema's rule finds wrong: at which field, and why. */
export type Issue = (path: string, message: string) => void

/** One of a roll request's rules: what it finds wrong with the request, each as an issue. */
export type RequestRule = (request: RollRequestInput, issue: Issue) => void
