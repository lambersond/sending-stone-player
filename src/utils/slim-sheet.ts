/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { MAX_ENVELOPE_BYTES } from '@/constants/sending-stone'

/*
 * The smaller sheet the module sends from 0.22.0, to a listener that says it reads one, made whole
 * again: the sheet the module built, exactly, so that everything reading a held sheet reads what
 * it always has. It leaves two things out (PROTOCOL.md, "Slim sheets"):
 * - an action listed in Spells, Inventory or Features too is sent by reference to that row, with
 *   only what differs from it, and the keys the row has that the action lacks named in `drop`;
 * - in those rows, their activities, whom they're used at and their damage, a key whose value is
 *   its default, as the tables below have them.
 */

type Json = Record<string, unknown>

/** The keys a kind of object leaves out at their defaults, with each default. */
const DEFAULTS = {
  spell: {
    img: null,
    level: 0,
    school: null,
    components: null,
    materials: null,
    concentration: false,
    ritual: false,
    activation: null,
    range: null,
    duration: null,
    target: null,
    prepared: null,
    uses: null,
    castFrom: null,
    text: null,
  },
  item: {
    img: null,
    quantity: 1,
    weight: null,
    price: null,
    equipped: null,
    attunement: null,
    attuned: false,
    uses: null,
    rarity: null,
    properties: [],
    identified: true,
    text: null,
  },
  // A container's, besides an item's. Contents held but none are kept, as []: it isn't hidden.
  container: { capacity: null, contents: null },
  feature: {
    img: null,
    kind: null,
    requirements: null,
    activation: null,
    passive: false,
    uses: null,
    text: null,
  },
  // Each of an item's activities, as a row, an action or an activity favorite lists them.
  entry: {
    activation: null,
    activationType: null,
    range: null,
    target: null,
    uses: null,
    toHit: null,
    attackId: null,
    activity: null,
    attackModes: null,
    ammunition: null,
    save: null,
    damage: [],
  },
  // Whom an activity is used at.
  targets: {
    self: false,
    area: false,
    count: null,
    perLevel: null,
    affects: null,
  },
  // A part of damage or healing.
  part: { type: null, healing: false },
} as const

type Kind = keyof typeof DEFAULTS
type RowKind = 'spell' | 'item' | 'feature'

/** What a row rolls, besides its damage, which is there only in a row that rolls. */
const ROLLS = [
  'toHit',
  'attackId',
  'activity',
  'attackModes',
  'ammunition',
  'save',
]

/**
 * A row that rolls keeps its damage, even none, and leaves out the rest of what it rolls at its
 * defaults: false for concentration, null for the others. A row that rolls nothing has none of it.
 */
const ROLL_GROUPS: Record<RowKind, string[]> = {
  spell: ROLLS,
  item: ['activation', 'range', 'target', 'concentration', ...ROLLS],
  feature: ['range', 'target', 'concentration', ...ROLLS],
}

/**
 * What an action by reference takes from its row, unless it has its own, or drops it: since module
 * 0.36.0 its damage on its own too, which goes once, with its row, not again with each action.
 */
const ACTION_KEYS = [
  'name',
  'img',
  'type',
  'activityName',
  'activation',
  'activationType',
  'range',
  'target',
  ...ROLLS,
  'damage',
  'tableDamage',
  'attackArea',
  'rollFormula',
  'check',
  'consumesSlot',
  'cast',
  'spellId',
  'forward',
  'activities',
  'uses',
  'level',
  'castFrom',
  'concentration',
  'identified',
  'consumable',
  'enchantments',
  'text',
]
const ACTION_KEY_SET = new Set(['id', 'ref', 'drop', ...ACTION_KEYS])

/**
 * The most a sheet is let grow, in characters of JSON: a post of empty rows, or of references to
 * one wide row, stops here, rather than growing a hundredfold. The module's own add a third.
 */
const MOST_ADDED = 3 * MAX_ENVELOPE_BYTES

/**
 * How deep in containers an item may be, a container in the inventory being 1 deep and what each
 * holds one deeper. The module sends 6 at most.
 */
const DEEPEST = 8

/** What adding a key at its default costs: `"key":value,`. */
const cost = (key: string, value: unknown) =>
  JSON.stringify(key).length + JSON.stringify(value).length + 2

/** Each kind's defaults, with what adding each costs. */
const FILLS = Object.fromEntries(
  Object.entries(DEFAULTS).map(([kind, defaults]) => [
    kind,
    Object.entries(defaults).map(
      ([key, value]) => [key, value, cost(key, value)] as const,
    ),
  ]),
) as Record<Kind, (readonly [string, unknown, number])[]>

const GROUP_FILLS = Object.fromEntries(
  Object.entries(ROLL_GROUPS).map(([kind, keys]) => [
    kind,
    keys.map(key => {
      const value = key === 'concentration' ? false : null
      return [key, value, cost(key, value)] as const
    }),
  ]),
) as Record<RowKind, (readonly [string, unknown, number])[]>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The objects in a list, skipping anything else, as the sheet's schema drops it. */
const objectsIn = (value: unknown): Json[] =>
  Array.isArray(value) ? value.filter(entry => isObject(entry)) : []

/** The objects listed under a key of each of a list's objects, such as each section's spells. */
const listedIn = (sections: unknown, key: string): Json[] =>
  objectsIn(sections).flatMap(section => objectsIn(section[key]))

/**
 * A sheet as the module built it, from the smaller shape it sends a listener that reads it.
 * @param raw - A sheet as it came, of any shape.
 * @returns The same, untouched, unless it says it's slim format 1 (`slim: 1`); then a new sheet,
 *   made whole. Null for one in a format this app doesn't read, or that grows too large or too
 *   deep in the making: never the slim sheet, which nothing here reads.
 */
export function expandSheet(raw: unknown): unknown {
  try {
    if (!isObject(raw) || raw.slim === undefined) return raw
    return raw.slim === 1 ? expand(raw) : null
  } catch {
    return null
  }
}

function expand(raw: Json): Json {
  // A copy by JSON, as a sheet is JSON: what isn't, such as a cycle, fails here, as it would where
  // it's kept. structuredClone isn't in every runtime this runs in, such as its tests'.
  // eslint-disable-next-line unicorn/prefer-structured-clone -- as above
  const sheet = JSON.parse(JSON.stringify(raw)) as Json
  delete sheet.slim

  let added = 0
  const grow = (by: number) => {
    added += by
    if (added > MOST_ADDED) throw new Error('A slim sheet grew too large')
  }
  /** Add each key a kind leaves out at its default. */
  const fill = (object: Json, fills: (typeof FILLS)[Kind]) => {
    for (const [key, value, size] of fills) {
      if (Object.hasOwn(object, key)) continue
      object[key] = Array.isArray(value) ? [] : value
      grow(size)
    }
  }
  /** Whom a row's, an action's or an activity's use is at, and its damage's parts. */
  const fillUse = (object: Json) => {
    const use = object.activity
    if (isObject(use) && isObject(use.targets)) fill(use.targets, FILLS.targets)
    for (const part of objectsIn(object.damage)) fill(part, FILLS.part)
  }
  /** Those, and each of its activities, with theirs. */
  const fillUses = (object: Json) => {
    fillUse(object)
    for (const entry of objectsIn(object.activities)) {
      fillUse(entry)
      fill(entry, FILLS.entry)
    }
  }

  // S2: the defaults, first, so that an action by reference copies its row whole.
  const { rows, containers } = rowsOf(sheet)
  for (const [row, kind] of rows) {
    fill(row, FILLS[kind])
    if (Object.hasOwn(row, 'damage')) fill(row, GROUP_FILLS[kind])
    fillUses(row)
  }
  for (const container of containers) fill(container, FILLS.container)
  for (const action of listedIn(sheet.actions, 'actions')) fillUses(action)
  for (const favorite of objectsIn(sheet.favorites)) {
    if (favorite.type === 'activity') fillUses(favorite)
  }

  // S1: actions by reference, each the first row of its id, Spells', then Inventory's, then
  // Features'.
  const byId = new Map<unknown, Json>()
  for (const [row] of rows) if (!byId.has(row.id)) byId.set(row.id, row)
  const copies = new WeakMap<Json, Map<string, string>>()
  /** A copy of a row's value, its JSON kept for the next action that takes it. */
  const copyOf = (row: Json, key: string) => {
    const held = copies.get(row) ?? new Map<string, string>()
    copies.set(row, held)
    const json = held.get(key) ?? JSON.stringify(row[key])
    held.set(key, json)
    grow(JSON.stringify(key).length + json.length + 2)
    return JSON.parse(json) as unknown
  }
  for (const section of objectsIn(sheet.actions)) {
    if (!Array.isArray(section.actions)) continue
    section.actions = section.actions.flatMap((action: unknown) => {
      if (!isObject(action) || action.ref !== true) return [action]
      const row =
        typeof action.id === 'string' ? byId.get(action.id) : undefined
      // One whose row isn't found can't be made whole, and is left out.
      if (!row) return []
      const dropped = new Set(Array.isArray(action.drop) ? action.drop : [])
      const entries: [string, unknown][] = [['id', action.id]]
      for (const key of ACTION_KEYS) {
        if (Object.hasOwn(action, key)) entries.push([key, action[key]])
        else if (Object.hasOwn(row, key) && !dropped.has(key)) {
          entries.push([key, copyOf(row, key)])
        }
      }
      for (const [key, value] of Object.entries(action)) {
        if (!ACTION_KEY_SET.has(key)) entries.push([key, value])
      }
      return [Object.fromEntries(entries)]
    })
  }
  return sheet
}

/**
 * The rows a slim sheet leaves defaults out of, with their kinds, in the order an action's row is
 * looked for: Spells', Inventory's sections', its containers' and what they hold, at any depth,
 * then Features'; and the containers among them, each an item too.
 * @throws {Error} For contents deeper than the module sends.
 */
function rowsOf(sheet: Json): { rows: [Json, RowKind][]; containers: Json[] } {
  const rows: [Json, RowKind][] = listedIn(sheet.spells, 'spells').map(row => [
    row,
    'spell',
  ])
  const containers: Json[] = []
  const inventory = isObject(sheet.inventory) ? sheet.inventory : {}
  for (const item of listedIn(inventory.sections, 'items')) {
    rows.push([item, 'item'])
  }
  const holding = (container: Json, depth: number) => {
    rows.push([container, 'item'])
    containers.push(container)
    for (const item of objectsIn(container.contents)) {
      if (depth >= DEEPEST) throw new Error('Containers nested too deep')
      if (item.type === 'container') holding(item, depth + 1)
      else rows.push([item, 'item'])
    }
  }
  for (const container of objectsIn(inventory.containers)) holding(container, 1)
  for (const feature of listedIn(sheet.features, 'features')) {
    rows.push([feature, 'feature'])
  }
  return { rows, containers }
}
