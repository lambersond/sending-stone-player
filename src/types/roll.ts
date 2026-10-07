import type { ROLL_KINDS } from '@/constants/sending-stone'
import type { AttackOutcome, DamagePreview } from '@/types/sending-stone'
import type { TableRoll } from '@/types/table'
import type { ExtraTerm } from '@/utils/roll-modifiers'

/**
 * Rolls a player makes here and has made in the Gamemaster's game, with the same dice, when the
 * Gamemaster lets them.
 */

/** A roll a player can have made in the game. */
export type RollKind = (typeof ROLL_KINDS)[number]

/**
 * What a roll on the sheet is, for the game to make it: a skill or tool check by the skill's or
 * tool's key, an ability check or saving throw by the ability's, a death saving throw, initiative
 * in a combat, or an attack with an item's attack activity, at a combatant, or none.
 */
export type RollSource =
  | { kind: 'skill' | 'tool' | 'ability' | 'save'; key: string }
  | { kind: 'death' }
  | { kind: 'initiative'; combatId: string }
  | {
      kind: 'attack'
      item: string
      activity: string
      target?: AttackTarget | null
    }

/** The combatant an attack is made at, in the combat its player sees. */
export type AttackTarget = { combatId: string; combatantId: string }

/** The dice of one roll of a kind of die, in the order they were thrown. */
export type RolledDice = { faces: number; results: number[] }

/** A roll, as its player asks for it to be made in the game. */
export type RollRequestInput = {
  kind: RollKind
  /** The skill's, tool's or ability's key, for a roll of one. */
  key?: string
  /** How it was rolled: with disadvantage, normally, or with advantage. */
  mode: -1 | 0 | 1
  /** Whether the player chose how, as in dnd5e's roll dialog, rather than as the sheet has it. */
  explicit: boolean
  /** What the player added, such as +1d4. */
  extras: ExtraTerm[]
  /** Every die thrown: the d20s first, then each added term's dice, in order. */
  dice: RolledDice[]
  /** For initiative, the combat it's rolled in. */
  combatId?: string
  /** For an attack, the item and its attack activity. */
  item?: string
  activity?: string
  /** For an attack, the combatant it's made at, if any. */
  target?: AttackTarget | null
  /** For damage, the attack it follows. */
  use?: string
}

/**
 * Where a roll stands, as its player is told: on its way to the game, being made there, made, or
 * not made; or no longer going, because the game didn't fetch it in time, or never answered.
 */
export type RollStatus =
  'sending' | 'rolling' | 'done' | 'failed' | 'expired' | 'lost'

/** A roll's way to the game, and what the game made of it. */
export type RollRequestView = {
  id: string
  status: RollStatus
  /** Why the game didn't make it, such as "off" or "not-dying". */
  reason?: string
  /** Whether its player may see the game's roll: not one the game made blind. */
  visible?: boolean
  /** The game's total, when its player may see it. */
  total?: number
  rolls?: TableRoll[]
  /** For an attack, what came of it, when its player may see it. */
  attack?: AttackOutcome
  /** For an attack, the dice its damage will throw; null when no damage follows. */
  damage?: DamagePreview | null
}
