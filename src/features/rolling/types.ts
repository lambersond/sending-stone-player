import type {
  SheetDamageRoll,
  RollSource,
  EffectAsk,
  TableRollState,
  RollKind,
  DamageModifiers,
  CriticalAdds,
} from '@/types/roll'
import type {
  CriticalRule,
  RollMode,
  BeastEntry,
  DamagePreview,
} from '@/types/sending-stone'
import type { LucideIcon } from 'lucide-react'

/** What a part of the sheet that rolls a d20 does when tapped, or held for its menu. */
export type RollActions = {
  onRoll: (target: RollTarget) => void
  onMenu: (anchor: HTMLElement, target: RollTarget, point?: MenuPoint) => void
}

/** How damage or healing is to be rolled, as chosen from its menu. */
export type DamageChoice = { critical?: boolean; modifiers?: DamageModifiers }

/** What a damage menu opens for: damage or healing, and the ways it may be rolled. */
export type DamageSubject = {
  /** Such as "Warhammer damage". */
  label: string
  /** As the sheet or the game puts it, such as "1d8 + 4". */
  formula: string
  /** Its parts, as they'd be thrown unchanged: a critical hit's dice as the game doubled them. */
  parts: SheetDamageRoll['parts']
  healing: boolean
  /** The ways offered: a critical hit's, at its highest, or changed first. */
  choices: RollChoice[]
  /** How many dice are thrown for each die added, as a critical hit's doubled dice take two. */
  perDie?: number
  /** For a spell or feature used with it, what using it is called, such as "Cast". */
  verb?: string
  /**
   * For damage the game rolls too, how the world's rules make a critical hit's, which the dialog's
   * critical hit then is, rather than every die twice.
   */
  criticalRule?: CriticalRule
  /**
   * For a description's damage, what a critical hit adds to each of its parts, such as a weapon's
   * extra dice and critical damage, which the dialog's critical hit throws too.
   */
  criticalAdds?: CriticalAdds
  onChoose: (choice: DamageChoice) => void
}

/** Something on the sheet that rolls: a check or save, its modifier, and the character's mode. */
export type RollTarget = {
  /** Such as "Perception check". */
  label: string
  modifier: number
  /** Advantage or disadvantage from the character's conditions and features. */
  mode: RollMode
  /** What it is, for the Gamemaster's game to make it too; unset for a roll it can't make. */
  source?: RollSource
  /**
   * For a saving throw a description's link calls for, what the link asks, such as a concentration
   * check, for the dice effects add to it (module 0.42.0).
   */
  ask?: EffectAsk
}

/**
 * What the player chose: a roll with advantage or disadvantage, or to modify the roll first; or,
 * for damage or healing, a critical hit's, every die at its highest, or to change its dice first.
 */
export type RollChoice =
  'adv' | 'dis' | 'modify' | 'critical' | 'maximize' | 'modify-damage'

/** Where the player clicked or pressed for the menu, from the top-left corner of what they hit. */
export type MenuPoint = {
  x: number
  y: number
  /** A finger or pen, whose hand would hide a menu below it. */
  touch: boolean
}

/** One of a menu's items: what it says, its icon and the icon's colour, as a class. */
export type MenuItem<T extends string> = {
  id: T
  label: string
  icon: LucideIcon
  tint?: string
  /** Why it can't be chosen now, said under it; unset where it can be. */
  disabled?: string
  /** What else to know of it, said under it where it can be chosen, such as what it spends. */
  hint?: string
}

/** The player's rolls' way to the Gamemaster's game. */
export type TableRolls = {
  /** Each roll sent, by its id. */
  states: ReadonlyMap<string, TableRollState>
  /** Whether the game takes any of the player's rolls now. */
  available: boolean
  /** Whether the player sends them from this device, as the sheet's settings say. */
  sending: boolean
  /** Whether the game takes this kind of roll from this device now. */
  takes?: (kind: RollKind) => boolean
  /**
   * Roll the damage of an attack or use the game made, as the game said it will, as the kind of
   * damage chosen, if any, and changed as the player chose, if they did.
   */
  rollDamage?: RollDue
  /** Whether the game takes damage the player changed. */
  modifies?: boolean
}

/** Roll the damage the game waits for, as the kind chosen, changed as chosen. */
export type RollDue = (
  name: string,
  due: DueDamage,
  type?: string,
  modifiers?: DamageModifiers,
) => void

/**
 * The Beasts the druid may learn, as the game lists them (module 0.40.0): those it sent, whether
 * there are more than it sent, and the rules they were chosen by; or why it didn't list them.
 */
export type WildShapeForms =
  | {
      forms: BeastEntry[]
      more: boolean
      limits: { count: number; cr: number; fly: boolean }
    }
  | { reason: string }

/** An attack or a use made at the table whose damage is still to roll there. */
export type DueDamage = {
  /** The attack's or use's id at the table. */
  use: string
  damage: DamagePreview
  /** How the player chose to change it as they used it, if they did. */
  modifiers?: DamageModifiers
}
