import type { ShowConditions } from '../conditions/types'
import type {
  TextLink,
  SheetRoll,
  SheetDamageRoll,
  SheetFormulaRoll,
  RollKind,
} from '@/types/roll'
import type {
  CriticalRule,
  SheetAbility,
  SheetSkill,
  SheetTool,
  SheetCondition,
} from '@/types/sending-stone'

/** Where a description is from, as what's rolled from it is named, such as "Handaxe damage". */
export type DescriptionOrigin = {
  /** Such as "Worn Bardic Eternal Flame", or "Starry Wisp (Worn Bardic Eternal Flame)". */
  name: string
  /** The item it's an item's description of, by its id. */
  item?: string
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
   * Whether it changes only a die the damage adds (module 0.21.0); where not, a change is offered
   * only where its first die whatever its sign is one it adds.
   */
  signed?: boolean
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
   * Why a spell or feature can't be used in the game from here now, as the tray says why, for an
   * activity's check, whose table is asked by using it; unset while it can be.
   */
  useBlocked?: string
  /**
   * Has this device send the player's rolls to the table, as the switch in the sheet's settings
   * does: there only where that alone keeps the table from being asked.
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
