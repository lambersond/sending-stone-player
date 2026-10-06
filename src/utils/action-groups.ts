/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import type { SheetAction, SheetSpellSection } from '@/types/sending-stone'

/**
 * Actions of one kind within a section of the Actions tab: weapons, spells cast one way, such as
 * those of a spell level or pact magic, features, or items.
 */
export type ActionGroup = {
  /** "weapons", "features" or "items", or a spellbook section's id after "spells-". */
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

/** Where groups come within a section: weapons, spells in the spellbook's order, then the rest. */
const ORDER = {
  weapons: 0,
  spells: 100,
  spellsByLevel: 200,
  features: 300,
  items: 400,
}

/**
 * A section's actions in groups of a kind, so that a spell's level and an item's kind show: first
 * weapons, then spells, grouped as the spellbook groups them, such as Cantrips, 1st Level or Pact
 * Magic, with their slots, then features, then everything else a character carries. Each keeps its
 * actions in the player's order.
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
  return [...groups.values()]
    .toSorted((a, b) => a.order - b.order)
    .map(({ group }) => group)
}

/** The group an action goes in, and where that group comes. */
function groupOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
): Omit<ActionGroup, 'actions'> & { order: number } {
  if (action.type === 'weapon') {
    return {
      id: 'weapons',
      label: 'Weapons',
      slots: null,
      order: ORDER.weapons,
    }
  }
  if (action.type === 'spell') {
    const index = spellbook.findIndex(section =>
      section.spells.some(spell => spell.id === action.id),
    )
    if (index !== -1) {
      const { id, label, slots } = spellbook[index]
      return {
        id: `spells-${id}`,
        label,
        slots:
          slots && slots.max > 0
            ? { value: slots.value, max: slots.max }
            : null,
        order: ORDER.spells + index,
      }
    }
    // A spell the spellbook doesn't show, such as one cast from an item, goes by its level.
    const level = action.level ?? 0
    return {
      id: `spells-level${level}`,
      label: levelLabel(level),
      slots: null,
      order: ORDER.spellsByLevel + level,
    }
  }
  if (action.type === 'feat') {
    return {
      id: 'features',
      label: 'Features',
      slots: null,
      order: ORDER.features,
    }
  }
  return { id: 'items', label: 'Items', slots: null, order: ORDER.items }
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

/** A spell level as dnd5e names it, such as "Cantrips" or "3rd Level". */
export function levelLabel(level: number): string {
  return level === 0 ? 'Cantrips' : `${ordinal(level)} Level`
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
