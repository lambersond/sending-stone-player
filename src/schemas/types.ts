/**
 * A container as the sheet's schema reads it: one of the character's items, `Item` as the schema
 * reads those, with its capacity and what it holds, items and containers of their own.
 */
export type ParsedContainer<Item> = Item & {
  capacity: { value: number; max: number; units: string } | null
  contents: (Item | ParsedContainer<Item>)[] | null
}
