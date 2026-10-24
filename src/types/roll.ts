import type { ROLL_FEATURES, ROLL_KINDS } from '@/constants/sending-stone'
import type {
  AttackOutcome,
  DamagePreview,
  EnchantmentOutcome,
  SaveOutcome,
  SheetCounter,
  UseOutcome,
} from '@/types/sending-stone'
import type { TableRoll } from '@/types/table'
import type { DamageModifiers } from '@/utils/damage-modifiers'
import type { ExtraTerm } from '@/utils/roll-modifiers'

/**
 * Rolls a player makes here and has made in the Gamemaster's game, with the same dice, when the
 * Gamemaster lets them.
 */

/** A roll a player can have made in the game. */
export type RollKind = (typeof ROLL_KINDS)[number]

/** What else the game can do with players' rolls, such as take damage they changed. */
export type RollFeature = (typeof ROLL_FEATURES)[number]

/**
 * What a roll on the sheet is, for the game to make it: a skill or tool check by the skill's or
 * tool's key, an ability check or saving throw by the ability's, and for one a description calls
 * for, its link; for a check an activity asks for, the player's own, from module 0.21.0, the item
 * and activity; for a saving throw the game asked for, the prompt it answers, as for an ability or
 * skill check Midi-QOL asked for, from module 0.27.0; a death saving throw, initiative in a
 * combat, or an attack with an item's attack activity, at a combatant, or none, or for an area
 * attack at those in its area, with the spell slot, ammunition and attack mode chosen.
 */
export type RollSource =
  | ({
      kind: 'skill' | 'tool' | 'ability'
      key: string
      prompt?: string
    } & Partial<TextLink> &
      Partial<ActivityRef>)
  | ({ kind: 'save'; key: string; prompt?: string } & Partial<TextLink>)
  | { kind: 'death' }
  | { kind: 'initiative'; combatId: string }
  | ({
      kind: 'attack'
      item: string
      activity: string
      target?: AttackTarget | null
      /** For an area attack, those in its area, in place of a target. */
      targets?: AttackTarget[]
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
 * the combatants picked, and from module 0.22.0 at its user too, with the spell slot chosen; and
 * for an enchant activity, from module 0.21.0, the way it enchants and the item it enchants, if one
 * of the character's.
 */
export type UseSource = {
  kind: 'use'
  item: string
  activity: string
  targets: AttackTarget[]
  /** At its user, besides those picked, where its user isn't among them. Module 0.22.0. */
  self?: true
  slot?: string | null
  enchant?: EnchantChoice
}

/**
 * How an enchant activity is used: the way it enchants, its profile's id; and the character's item
 * it enchants, by its id, for one that enchants another of their items; none for one that enchants
 * its own, or to leave on its card in the game, for whoever the Gamemaster says.
 */
export type EnchantChoice = { profile: string; item?: string }

/**
 * An enchantment on one of the character's items ended, as dnd5e's chat card lets its caster end
 * it, from module 0.21.0: the item's id, and the enchantment's effect's.
 */
export type EndEnchantmentSource = {
  kind: 'endEnchantment'
  item: string
  effect: string
}

/**
 * A concentration of the character's ended, as dnd5e's Break Concentration ends it, with what
 * depends on it, from module 0.29.0: its effect's id.
 */
export type EndConcentrationSource = {
  kind: 'endConcentration'
  effect: string
}

/**
 * Charges of one of the character's counters spent directly, as on dnd5e's sheet, from module
 * 0.29.0: the counter, as the sheet names it, and how many.
 */
export type SpendSource = {
  kind: 'spend'
  counter: SheetCounter
  count: number
}

/** Heroic Inspiration used, or gained, from module 0.29.0. */
export type InspirationSource = {
  kind: 'inspiration'
  inspiration: 'use' | 'gain'
}

/**
 * Items and coins moved, from module 0.31.0: the two ends by their Foundry actor ids, one of them
 * the character's, and what moves, each item by its id and how many of it, and each coin by its
 * key, such as "gp", and how many.
 */
export type TransferInput = {
  from: string
  /** The receiving end; never with `among`. */
  to?: string
  /**
   * From module 0.32.0, a distribution: the party's characters its coin is shared among, never
   * with `to`.
   */
  among?: string[]
  items?: { id: string; quantity: number }[]
  currency?: Record<string, number>
}

/**
 * What a move moved, as the game reports it, from module 0.31.0: each of the command's own items
 * that moved, and the item it made at the other end or the stack it joined there, and the coins.
 * Never a name, nor what a container held.
 */
export type TransferMoved = {
  from: string
  /** null for a distribution. */
  to: string | null
  items: {
    id: string
    quantity: number
    created: string | null
    stacked: string | null
  }[]
  currency: Record<string, number> | null
  /** A distribution's characters that were given their share, in order. */
  among?: string[]
}

/** An item removed from the character, from module 0.33.0. */
export type RemoveInput = {
  /** Its Foundry id: at the top of the inventory, or in a container. */
  item: string
  /** How many of its stack: from 1 to all of it, which deletes it; 0 only for a stack of none. */
  quantity: number
  /**
   * How many of it the sheet showed as it was chosen: the game removes it only while it still
   * holds that many, so that part of it is never taken for all of it.
   */
  held: number
}

/** What a removal removed, as the game says it: by id and count alone. Module 0.33.0. */
export type RemovedItem = { item: string; quantity: number }

/**
 * A roll with no d20 that the game makes too: a hit die spent, by its size, such as "d10", or
 * several spent at once, how many of each size, the largest first; an item's activity's own
 * formula, such as a light's radius; or a description's own roll, by its link.
 */
export type FormulaSource =
  | { kind: 'hitDie'; denomination: string }
  | { kind: 'hitDice'; hitDice: HitDiceSpent[] }
  | { kind: 'formula'; item: string; activity: string }
  | ({ kind: 'textRoll' } & TextLink)

/** Hit dice of one size spent at once: the size, such as "d10", and how many. */
export type HitDiceSpent = { denomination: string; count: number }

/**
 * A link in one of the character's descriptions the game acts on, by which the game finds what it
 * asks for in its own copy: the description's hash, and the link's number in it.
 */
export type TextLink = { text: string; link: number }

/** One of the character's items' activities, by the item's id and its own. */
export type ActivityRef = { item: string; activity: string }

/** The combatant an attack, or a use, is made at, in the combat its player sees. */
export type AttackTarget = { combatId: string; combatantId: string }

/**
 * A turn as the page was shown it, for ending it (module 0.36.0): its combat, its round and its
 * current combatant. Never a turn index, which the app isn't sent.
 */
export type EndedTurn = { combatId: string; round: number; combatantId: string }

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
  /**
   * For an attack, a use or a formula, the item and its activity; and from module 0.21.0, for a
   * check an activity asks for, the player's own.
   */
  item?: string
  activity?: string
  /** For an attack, the combatant it's made at, if any. */
  target?: AttackTarget | null
  /** For a use, the combatants it's used at; for an area attack, those in its area. */
  targets?: AttackTarget[]
  /**
   * For a use, from module 0.22.0: at its user too, besides its targets, such as a potion drunk out
   * of a combat the character isn't in; its token, where the game finds one.
   */
  self?: true
  /** For an attack or a use of a spell, the spell slot chosen. */
  slot?: string | null
  /** For a use of an enchant activity, from module 0.21.0, how it enchants, and what. */
  enchant?: EnchantChoice
  /** For an enchantment ended, from module 0.21.0, the item it's on, and its effect. */
  enchantment?: { item: string; effect: string }
  /** For a concentration ended, from module 0.29.0, its effect. */
  concentration?: { effect: string }
  /** For charges spent directly, from module 0.29.0, the counter they're spent of, and how many. */
  counter?: SheetCounter
  count?: number
  /** For Heroic Inspiration, from module 0.29.0, whether it's used or gained. */
  inspiration?: 'use' | 'gain'
  /** For a move of items and coins, from module 0.31.0, its ends and what moves. */
  transfer?: TransferInput
  /** For a removal, from module 0.33.0, what it removes. */
  remove?: RemoveInput
  /**
   * For a turn ended, from module 0.36.0: which; and for one taken back, the turn that End Turn
   * left, as the page shows it now.
   */
  turn?: EndedTurn
  /** For a turn taken back, from module 0.36.0: the End Turn it takes back, by its id. */
  undo?: string
  /** For an attack, the ammunition and attack mode chosen. */
  ammunition?: string
  attackMode?: string
  /** For damage, the attack or use it follows. */
  use?: string
  /** For damage, the kind chosen for each of its rolls that offers a choice, by place. */
  types?: (string | null)[]
  /**
   * For damage, or a description's from module 0.19.0, how the player changed it: more dice,
   * another die, every die at its highest.
   */
  modifiers?: DamageModifiers
  /**
   * For a description's damage, a critical hit's, as the world's rules make it, from module 0.19.0;
   * from module 0.20.0, with what a critical hit adds to it, its dice after each part's own. Never
   * healing.
   */
  critical?: true
  /** For a saving throw the game asked for, the prompt it answers. */
  prompt?: string
  /** For a hit die, its size, such as "d10". */
  denomination?: string
  /**
   * For several hit dice spent at once, from module 0.20.0, how many of each size, each size once,
   * the largest first; its dice, a roll of each size's in the same order, are spent in that order.
   */
  hitDice?: HitDiceSpent[]
  /**
   * From a link in a description: the description's hash, for an ask, a description's damage or
   * roll, or a saving throw or check it calls for, the player's own.
   */
  text?: string
  /** The link's number in that description. */
  link?: number
  /**
   * What the page that sent it calls it, such as "Perception check", as the Gamemaster's page says
   * (#156), for the character's player to be shown it by; only ever shown as text.
   */
  label?: string
  /** Its player typed its dice in from their own, from module 0.32.0: the game marks it so. */
  typed?: true
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
  /** For a saving throw the game asked for, whether it succeeded, where its player may know. */
  outcome?: SaveOutcome
  /**
   * For a hit die or hit dice, the hit points they gave back in the game, when its player may see
   * them.
   */
  healed?: number
  /**
   * For hit dice spent at once, how many were asked for and how many the game made, from module
   * 0.20.0, where it made some: all of them, where their player may see them; or where it stopped
   * part way, as at full hit points, how many it made before, even of those they can't see.
   */
  spent?: { count: number; made: number }
  /**
   * For a use of an enchant activity, or an enchantment ended, from module 0.21.0, the enchantment
   * it applied and the one it ended, if any.
   */
  enchantment?: EnchantmentOutcome
  /**
   * For a use of an enchant activity that wasn't made, or whose enchantment wasn't applied, from
   * module 0.21.0: false where the game names no card of it, so that the Gamemaster can't apply
   * the enchantment from one: none was posted, it was deleted, or dnd5e lets no one apply it from
   * the card, as one naming a concentration that has since ended.
   */
  card?: false
  /**
   * For a move of items and coins, from module 0.31.0, what moved: everything, when it was made,
   * or the parts made before it failed.
   */
  transfer?: TransferMoved
  /**
   * For a removal, from module 0.33.0, what it removed: when it was made, or where it failed after
   * the item itself changed.
   */
  removed?: RemovedItem
}

/**
 * A roll the campaign's Gamemaster made as the player's character from their page (#156), as its
 * player is shown it, beside their own: what it was, what it's called, when it was sent, and where
 * it stands, with the game's result as the player's own rolls have it, but none of its dice, and
 * never the damage that follows it, which the Gamemaster rolls.
 */
export type GmRollView = Pick<
  RollRequestView,
  | 'id'
  | 'status'
  | 'reason'
  | 'visible'
  | 'total'
  | 'attack'
  | 'outcome'
  | 'healed'
  | 'spent'
  | 'enchantment'
> & {
  kind: RollKind
  /** As the Gamemaster's page called it; or for one sent before it said, its kind, as "A check". */
  label: string
  /** When it was sent, as an ISO timestamp. */
  at: string
  /**
   * For a roll of a d20, where the game made it and its player may see it: whether the game says
   * the d20 came up a critical or a fumble.
   */
  d20?: 'critical' | 'fumble'
  /**
   * For damage, where the game made it and its player may see it: that the game says it's a
   * critical hit's, as dnd5e marks its rolls, for it to show in a critical's gold, and say so, as
   * the player's own does.
   */
  critical?: true
  /**
   * For damage, that it's healing, as the game said: of an attack's or a use's, as the game said of
   * what follows it, as the player's own healing is told; else of every roll the game made of it,
   * as the chat tells healing.
   */
  healing?: true
}
