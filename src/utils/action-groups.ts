/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import type { SheetAction, SheetSpellSection } from '@/types/sending-stone'

/**
 * Actions of one kind within a section of the Actions tab, as Tidy 5e groups a sheet by where
 * things come from: weapons, equipment and the like, spells cast one way, such as those of a spell
 * level or pact magic, spells cast from an item, or features.
 */
export type ActionGroup = {
  /**
   * Such as "weapons", "consumables" or "features"; a spellbook section's id after "spells-"; or
   * the id of the item spells are cast from, after "from-".
   */
  id: string
  label: string
  /** The slots its spells are cast with, for a spell level or pact magic that has any. */
  slots: { value: number; max: number } | null
  actions: SheetAction[]
}

/** Slots a spell can be cast with: one spell level's, or pact magic's. */
export type SlotPool = {
  /** The spellbook section's id, such as "spell3" or "pact". */
  id: string
  /** As dnd5e labels it, such as "3rd Level" or "Pact Magic — 3rd Level". */
  label: string
  /** The level a spell is cast at with one; unknown for pact magic from an older module. */
  level: number | null
  value: number
  max: number
}

/** The kinds of things a character carries, as dnd5e's inventory names and orders them. */
const ITEM_KINDS: Record<string, { id: string; label: string }> = {
  weapon: { id: 'weapons', label: 'Weapons' },
  equipment: { id: 'equipment', label: 'Equipment' },
  consumable: { id: 'consumables', label: 'Consumables' },
  tool: { id: 'tools', label: 'Tools' },
  container: { id: 'containers', label: 'Containers' },
  loot: { id: 'loot', label: 'Loot' },
}
const ITEM_ORDER = Object.keys(ITEM_KINDS)

/**
 * Where groups come within a section: what's carried, then spells in the spellbook's order, then
 * spells cast from items, then features.
 */
const ORDER = { items: 0, spells: 100, castFrom: 200, features: 300 }

/**
 * A section's actions in groups of a kind, so that an item's kind and a spell's level show, as
 * Tidy 5e groups a sheet by where things come from. First what the character carries, by kind:
 * weapons, equipment, consumables and so on. Then spells, as the spellbook groups them, such as
 * Cantrips, Pact Magic or each level, with their slots; then spells cast from an item, under its
 * name; then features. Each keeps its actions in the player's order.
 */
export function groupActions(
  actions: SheetAction[],
  spellbook: SheetSpellSection[],
): ActionGroup[] {
  const groups = new Map<string, { group: ActionGroup; order: number }>()
  for (const action of actions) {
    const { order, ...kind } = groupOf(action, spellbook)
    const entry = groups.get(kind.id) ?? {
      group: { ...kind, actions: [] },
      order,
    }
    entry.group.actions.push(action)
    groups.set(kind.id, entry)
  }
  // Groups that come in the same place, such as spells from several items, keep their order.
  return [...groups.values()]
    .toSorted((a, b) => a.order - b.order)
    .map(({ group }) => group)
}

/** The group an action goes in, and where that group comes. */
function groupOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
): Omit<ActionGroup, 'actions'> & { order: number } {
  if (action.type === 'spell') return spellGroupOf(action, spellbook)
  if (action.type === 'feat') {
    return {
      id: 'features',
      label: 'Features',
      slots: null,
      order: ORDER.features,
    }
  }
  const kind = ITEM_KINDS[action.type]
  return kind
    ? {
        ...kind,
        slots: null,
        order: ORDER.items + ITEM_ORDER.indexOf(action.type),
      }
    : {
        id: 'items',
        label: 'Items',
        slots: null,
        order: ORDER.items + ITEM_ORDER.length,
      }
}

/**
 * A spell's group: the item it's cast from, if it's cast from one; otherwise its section of the
 * spellbook, such as 1st Level or Pact Magic, with its slots.
 */
function spellGroupOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
): Omit<ActionGroup, 'actions'> & { order: number } {
  if (action.castFrom) {
    return {
      id: `from-${action.castFrom.id}`,
      label: action.castFrom.name,
      slots: null,
      order: ORDER.castFrom,
    }
  }
  const index = spellbook.findIndex(section =>
    section.spells.some(spell => spell.id === action.id),
  )
  if (index !== -1) {
    const { id, label, slots } = spellbook[index]
    return {
      id: `spells-${id}`,
      label,
      slots:
        slots && slots.max > 0 ? { value: slots.value, max: slots.max } : null,
      order: ORDER.spells + index,
    }
  }
  // A spell the spellbook doesn't show is one cast from an item, from a module before 0.8.2,
  // which doesn't say which. It goes with the spells from items the spellbook does show, as
  // dnd5e names them.
  const items = spellbook.findIndex(section => section.id === 'item')
  return {
    id: 'spells-item',
    label: items === -1 ? 'Additional Spells' : spellbook[items].label,
    slots: null,
    order: items === -1 ? ORDER.castFrom : ORDER.spells + items,
  }
}

/**
 * The slots a spell can be cast with, as dnd5e offers them when it's cast: every spell level's
 * and pact magic's at the spell's level or higher, of which the character has any, lowest first.
 * Null for a spell cast without slots: a cantrip, or one cast at will, innately, as a ritual or
 * from an item.
 */
export function slotPools(
  action: SheetAction,
  spellbook: SheetSpellSection[],
): SlotPool[] | null {
  if (action.type !== 'spell' || !action.level) return null
  const own = spellbook.find(section =>
    section.spells.some(spell => spell.id === action.id),
  )
  if (!own?.slots) return null
  const spellLevel = action.level
  return spellbook
    .flatMap(({ id, label, slots }) => {
      if (!slots || slots.max <= 0) return []
      const level = slots.level ?? spellLevelOf(id)
      // A pool whose level an older module didn't send may serve, so it's offered.
      if (level !== null && level < spellLevel) return []
      return [{ id, label, level, value: slots.value, max: slots.max }]
    })
    .toSorted((a, b) => (a.level ?? 10) - (b.level ?? 10))
}

/**
 * Has a spell no slot left to be cast with, and no use of its own left? Then it can't be cast
 * until the character rests.
 */
export function outOfSlots(
  action: SheetAction,
  pools: SlotPool[] | null,
): boolean {
  if (!pools) return false
  if (action.uses && action.uses.value > 0) return false
  return pools.every(pool => pool.value === 0)
}

/** A pool's short name, such as "3rd" for a spell level's or "Pact 3rd" for pact magic's. */
export function poolName(pool: SlotPool): string {
  if (spellLevelOf(pool.id) !== null && pool.level !== null) {
    return ordinal(pool.level)
  }
  if (pool.id === 'pact') {
    return pool.level === null ? 'Pact' : `Pact ${ordinal(pool.level)}`
  }
  return pool.label
}

/** Such as 1st, 2nd, 3rd or 4th, for a spell level, 1 to 9. */
export function ordinal(level: number): string {
  return `${level}${['th', 'st', 'nd', 'rd'][level] ?? 'th'}`
}

/** The level of a spell level's spellbook section, such as 3 for "spell3"; null for any other. */
function spellLevelOf(id: string): number | null {
  const match = /^spell([1-9])$/.exec(id)
  return match ? Number(match[1]) : null
}
