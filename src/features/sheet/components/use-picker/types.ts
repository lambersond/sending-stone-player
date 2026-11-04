import type { AloneChoice } from '@/features/sheet/utils/types'
import type { SheetRoll, EnchantChoice, DamageModifiers } from '@/types/roll'
import type { SheetAction, SheetEnchant } from '@/types/sending-stone'
import type { TableCombatant } from '@/types/table'

/** An attack, or a use, whose choices are being made. */
export type Picking =
  | { kind: 'attack'; action: SheetAction; request: SheetRoll }
  | {
      kind: 'use'
      action: SheetAction
      /** How the player chose to change the damage that follows it. */
      modifiers?: DamageModifiers
    }
  | {
      /** Damage on its own, from module 0.41.0, whose choices the game sends. */
      kind: 'alone'
      action: SheetAction
      /** Healing rather than damage, as its chip is. */
      healing: boolean
      /** What the player chose of it already, as from its chip's menu. */
      choice: AloneChoice
    }

/** What the player chose. */
export type Picked = {
  targets: TableCombatant[]
  /**
   * At its user too, as the game makes a use at its user where it isn't among the combatants, from
   * module 0.22.0.
   */
  self?: true
  /**
   * The spell slot chosen, such as "spell3", where there's a choice; or for a spell an item casts,
   * the level, as "spell" and the level.
   */
  slot?: string
  ammunition?: string
  attackMode?: string
  /** For a use of an enchant activity, how it enchants, and which item, if one. */
  enchant?: EnchantChoice
  /** For damage on its own, from module 0.41.0: spend what its use would, as its switch says. */
  consume?: true
}

/** Combatants to pick from under a heading: the player and their allies, or everyone else. */
export type Section = {
  key: 'allies' | 'others'
  label: 'Allies' | 'Others'
  rows: TableCombatant[]
}

/**
 * Whom an attack or a use is made at, as the picker asks it (`whomOf`): those to tick, as many as
 * it takes; one to tap, or no one; for one that enchants, what it enchants; an attack with no one
 * to make it at; or a use with no one to pick, at its user where it's made there by default.
 */
export type Whom =
  | {
      kind: 'tick'
      targets: TableCombatant[]
      area: boolean
      most: number
      verb: string
      helps: boolean
    }
  | {
      kind: 'tap'
      lead: string
      sections: Section[]
      last?: string
      preset?: string
    }
  | { kind: 'enchant'; enchant: SheetEnchant; verb: string }
  | { kind: 'attack' }
  | { kind: 'use'; verb: string; at?: Pick<Picked, 'targets' | 'self'> }

/**
 * How whom at is picked, as `useChoices` keeps it: what the targets are searched by, those
 * ticked, and the pick, made at the targets given with the options chosen.
 */
export type Targeting = {
  search: { query: string; onQuery: (query: string) => void }
  ticked: string[]
  setTicked: (ticked: string[]) => void
  pick: (targets: TableCombatant[]) => void
}
