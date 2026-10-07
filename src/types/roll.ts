import type { ROLL_KINDS } from '@/constants/sending-stone'
import type {
  AttackOutcome,
  DamagePreview,
  UseOutcome,
} from '@/types/sending-stone'
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
 * in a combat, or an attack with an item's attack activity, at a combatant, or none, with the spell
 * slot, ammunition and attack mode chosen.
 */
export type RollSource =
  | { kind: 'skill' | 'tool' | 'ability' | 'save'; key: string }
  | { kind: 'death' }
  | { kind: 'initiative'; combatId: string }
  | ({
      kind: 'attack'
      item: string
      activity: string
      target?: AttackTarget | null
    } & AttackChoices)

/** What a player chooses an attack is made with; the game's own choice for what they leave out. */
export type AttackChoices = {
  /** The spell slot a spell is cast with, such as "spell3" or "pact". */
  slot?: string | null
  /** The ammunition's item id. */
  ammunition?: string
  /** Such as "twoHanded" or "thrown". */
  attackMode?: string
}

/**
 * A spell or feature a player has used in the game, with no roll of its own: an item's activity, at
 * the combatants picked, with the spell slot chosen.
 */
export type UseSource = {
  kind: 'use'
  item: string
  activity: string
  targets: AttackTarget[]
  slot?: string | null
}

/** The combatant an attack, or a use, is made at, in the combat its player sees. */
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
  /** For an attack or a use, the item and its activity. */
  item?: string
  activity?: string
  /** For an attack, the combatant it's made at, if any. */
  target?: AttackTarget | null
  /** For a use, the combatants it's used at. */
  targets?: AttackTarget[]
  /** For an attack or a use of a spell, the spell slot chosen. */
  slot?: string | null
  /** For an attack, the ammunition and attack mode chosen. */
  ammunition?: string
  attackMode?: string
  /** For damage, the attack or use it follows. */
  use?: string
  /** For damage, the kind chosen for each of its rolls that offers a choice, by place. */
  types?: (string | null)[]
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
  /** For a use, the kind of activity used. */
  use?: UseOutcome
  /** For an attack or a use, the dice its damage or healing will throw; null when none follows. */
  damage?: DamagePreview | null
}
