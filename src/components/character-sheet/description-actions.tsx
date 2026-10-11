'use client'

import { createContext, use, type ReactNode } from 'react'
import type { ShowConditions } from './conditions-panel'
import type {
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/hooks/use-sheet-roller'
import type { RollKind, TextLink } from '@/types/roll'
import type {
  CharacterSheet,
  CriticalRule,
  SheetAbility,
  SheetCastFrom,
  SheetCondition,
  SheetSkill,
  SheetTool,
} from '@/types/sending-stone'

/*
 * What the links in the sheet's descriptions do: a saving throw or check a description calls for,
 * the table asked for it or the player's own rolled; its damage or healing and its own rolls,
 * rolled with the player's dice, and in the Gamemaster's game too, where it takes them, damage as a
 * critical hit's or changed too; and a condition it names, its rules shown. The sheet gives them
 * once, for every tab, favorite and dialog in it.
 */

/** Where a description is from, as what's rolled from it is named, such as "Handaxe damage". */
export type DescriptionOrigin = {
  /** Such as "Worn Bardic Eternal Flame", or "Starry Wisp (Worn Bardic Eternal Flame)". */
  name: string
  /** The item it's an item's description of, by its id. */
  item?: string
}

/**
 * What a spell's description is from, as its rolls are named: the spell, and the item it's cast
 * from, if any, such as "Starry Wisp (Worn Bardic Eternal Flame)".
 */
export function spellOrigin({
  name,
  castFrom,
}: {
  name: string
  castFrom?: Pick<SheetCastFrom, 'name'> | null
}): string {
  return castFrom ? `${name} (${castFrom.name})` : name
}

/** What the table is asked for, from a description's link. */
export type Asking = TextLink & {
  /** Such as "DC 15 Dexterity saving throw" or "DC 15 Strength (Athletics) check". */
  label: string
}

/**
 * What the Gamemaster's game takes of a description's damage or healing from this device, besides
 * rolling it plainly.
 */
export type DescribedDamage = {
  /** Whether it takes it changed: more dice, another die, every die at its highest. */
  modifies: boolean
  /**
   * How the world's rules make a critical hit's damage, which it rolls a description's as; unset
   * where it can't say, and takes none.
   */
  critical?: CriticalRule
}

/** What a description's links do on the sheet. */
export type DescriptionActions = {
  /** Rolls a saving throw or check the player makes themselves, as the sheet rolls one. */
  roll: (roll: SheetRoll) => void
  /** Rolls damage or healing with the player's dice. */
  rollDamage: (roll: SheetDamageRoll) => void
  /** Rolls a description's own roll with the player's dice. */
  rollFormula: (roll: SheetFormulaRoll) => void
  /** Whether the Gamemaster's game takes this kind of roll from this device now. */
  takes: (kind: RollKind) => boolean
  /**
   * What the game takes of a description's damage or healing, besides rolling it plainly, where it
   * takes it from this device now; unset where it doesn't, and its damage is the player's alone.
   */
  damage?: DescribedDamage
  /**
   * Asks the table for the saving throw or check a description calls for, on the game's own card.
   */
  ask: (asking: Asking) => void
  /** Why the table can't be asked now, as the tray says why; unset while it can be. */
  askBlocked?: string
  /**
   * Has this device send the player's rolls to the table, as the tray's switch does: there only
   * where that alone keeps the table from being asked.
   */
  sendRolls?: () => void
  /** The character's abilities, with their checks and saving throws. */
  abilities: SheetAbility[]
  /** The character's skills. */
  skills: SheetSkill[]
  /** The tools the character has, as far as the sheet says: its tools, or its favorites. */
  tools: SheetTool[]
  /** The character's proficiency bonus, as a skill checked using a tool may take a tool's. */
  proficiency: number | null
  /** The conditions the character has. */
  conditions: SheetCondition[]
  /** The world's rules: the 2024 rules ("modern") or the 2014 rules ("legacy"). */
  rules?: 'modern' | 'legacy' | null
  /** Opens the conditions panel, at a condition. */
  showConditions: ShowConditions
}

/**
 * The tools the character has, as far as its sheet says: its tools, from module 0.18.0, and the
 * tools it made favorites, which named them before.
 */
export function sheetTools(
  sheet: Pick<CharacterSheet, 'tools' | 'favorites'>,
): SheetTool[] {
  const tools = [...(sheet.tools ?? [])]
  for (const favorite of sheet.favorites ?? []) {
    if (
      favorite.type === 'tool' &&
      !tools.some(tool => tool.id === favorite.id)
    ) {
      const { id, name, ability, total, passive, proficiency, mode } = favorite
      tools.push({ id, name, ability, total, passive, proficiency, mode })
    }
  }
  return tools
}

const Actions = createContext<DescriptionActions | undefined>(undefined)

/**
 * Has the links in the descriptions inside do what `actions` says. Outside, they do nothing: each
 * is only its text.
 */
export function DescriptionLinks({
  actions,
  children,
}: Readonly<{ actions?: DescriptionActions; children: ReactNode }>) {
  return <Actions value={actions}>{children}</Actions>
}

/** What a description's links do here; nothing outside a sheet that says. */
export function useDescriptionActions(): DescriptionActions | undefined {
  return use(Actions)
}

/**
 * What a description's links do, then `done`: once its dice are thrown, or the table is asked, as
 * a dialog it's in closes then, for the dice and the tray behind it to be seen.
 */
export function closingAfter(
  actions: DescriptionActions,
  done: () => void,
): DescriptionActions {
  return {
    ...actions,
    roll: roll => {
      actions.roll(roll)
      done()
    },
    rollDamage: roll => {
      actions.rollDamage(roll)
      done()
    },
    rollFormula: roll => {
      actions.rollFormula(roll)
      done()
    },
    ask: asking => {
      actions.ask(asking)
      done()
    },
  }
}
