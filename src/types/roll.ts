import type { DIE_SIZES } from '@/constants/dice'
import type { ROLL_FEATURES, ROLL_KINDS } from '@/constants/sending-stone'
import type {
  AloneOutcome,
  AttackOutcome,
  DamagePreview,
  EffectChange,
  EnchantmentOutcome,
  SaveOutcome,
  SheetCounter,
  UseOutcome,
  WildShapeOutcome,
  CriticalRule,
  TableDamagePlan,
  SheetEffectDie,
  SheetAction,
  SheetSpellSection,
  AloneSpend,
  EffectOp,
  PrepareOp,
  SpellSlotOp,
  WildShapeOp,
  TransferMoved,
  RemovedItem,
  FavoriteEntry,
} from '@/types/sending-stone'
import type { DieSides, Advantage } from '@lambersond/3d-dice-core'

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
 * One of the character's spell slots spent, or one restored, from module 0.42.1: which, its pool,
 * such as `spell1` or `pact`, and the count the app showed, made only where it still is.
 */
export type SpellSlotInput = { op: SpellSlotOp; id: string; from: number }

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

/**
 * What a favorite is, as the sheet names it, from module 0.37.0: an item by its id, one of an
 * item's activities by its own id and its item's, an effect by the sheet's id ("<id>", or
 * "<itemId>.<id>" for an item's), and a skill, tool or pool of spell slots by its key. Written out
 * in FavoriteEntry's `target` and read from there, so src/types/sending-stone.ts needs nothing from
 * this file (no import cycle).
 */
export type FavoriteTarget = NonNullable<FavoriteEntry['target']>

/** A favorite added to or removed from the character's, from module 0.37.0. */
export type FavoriteInput = FavoriteTarget & { op: 'add' | 'remove' }

/**
 * One of the character's own effects turned off, turned on or deleted, from module 0.39.0: the
 * state wanted, never a toggle, and the effect as the sheet names it, "<id>" or "<itemId>.<id>".
 */
export type EffectInput = { op: EffectOp; id: string }

/**
 * Wild Shape from the app, from module 0.40.0: a change into one of the druid's known forms, by its
 * profile's id; a return to herself; a Beast learned from the campaign's compendiums, by its uuid,
 * into an empty place or in place of a known form after a Long Rest; or the Beasts she may learn
 * listed, which writes nothing.
 */
export type WildShapeInput =
  | { op: 'transform'; form: string }
  | { op: 'revert' }
  | { op: 'learn'; uuid: string; replace: string | null }
  | { op: 'forms' }

/**
 * One of the character's spells prepared or unprepared, from module 0.42.1: the state wanted, and
 * the spell, by its id on the sheet.
 */
export type PrepareInput = { op: PrepareOp; id: string }

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
  /**
   * For an attack or a use of a spell, the spell slot chosen; and from module 0.41.0, for damage on
   * its own, the slot it's rolled at, and spends where asked, never null.
   */
  slot?: string | null
  /**
   * For damage on its own, from module 0.41.0: spend what using it would, after the roll, as the
   * game would spend it.
   */
  consume?: true
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
  /**
   * For a spell slot, from module 0.42.1: whether one is spent or restored, of which pool, and the
   * count of it the app showed.
   */
  spellSlot?: SpellSlotInput
  /** For a move of items and coins, from module 0.31.0, its ends and what moves. */
  transfer?: TransferInput
  /** For a removal, from module 0.33.0, what it removes. */
  remove?: RemoveInput
  /** For a favorite, from module 0.37.0: what, and whether it's added or removed. */
  favorite?: FavoriteInput
  /**
   * For one of the character's own effects, from module 0.39.0: which, as the sheet names it, and
   * whether it's turned off, turned on or deleted.
   */
  effect?: EffectInput
  /** For Wild Shape, from module 0.40.0: which op, and of which form or Beast. */
  wildShape?: WildShapeInput
  /**
   * For a spell prepared or unprepared, from module 0.42.1: the state wanted, and which spell, by
   * its id on the sheet.
   */
  prepare?: PrepareInput
  /**
   * For a turn ended, from module 0.36.0: which; and for one taken back, the turn that End Turn
   * left, as the page shows it now.
   */
  turn?: EndedTurn
  /** For a turn taken back, from module 0.36.0: the End Turn it takes back, by its id. */
  undo?: string
  /**
   * For an attack, and from module 0.41.0 for damage on its own, the ammunition and attack mode
   * chosen.
   */
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
  /**
   * For a typed d20 roll, from module 0.42.0: the dice its effects add, or take away, that its
   * player typed in, each by its faces and sign, never a d20, and never one they skipped, which
   * the game rolls.
   */
  effectDice?: { faces: DieSides; sign: 1 | -1; results: number[] }[]
  /**
   * For a typed roll, from module 0.42.0: its player rerolled at the table, as their feature says,
   * and typed the dice they kept, which the game then rerolls none of.
   */
  rerolls?: 'kept'
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
  /**
   * For a favorite, from module 0.37.0, once made: whether it's one of the character's favorites
   * now, as the game says.
   */
  favorited?: boolean
  /**
   * For one of the character's own effects turned off, on or deleted, from module 0.39.0, once
   * made: whether it's off now, null once deleted, and whether it was deleted, as the game says.
   */
  effect?: EffectChange
  /**
   * For Wild Shape, from module 0.40.0, once made: the form taken or left, the form learned, or the
   * Beasts to learn, as the game says.
   */
  wildShape?: WildShapeOutcome
  /**
   * For damage on its own that asked to spend what its use would, from module 0.41.0, once made:
   * what the game spent, and whether concentration began.
   */
  alone?: AloneOutcome
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
  /** For a spell slot of the Gamemaster's, from module 0.42.1: spent or restored. */
  slotOp?: SpellSlotOp
}

/**
 * What the app knows of a kind of roll request, in one place (src/constants/roll-kinds.ts)
 * rather than in a list of kinds beside each reader: what a Gamemaster's roll of it is called
 * where their page didn't say; the dice it throws; whether it's damage or healing, and whether
 * its rolls add up; the kind of check it makes; whether it names what is rolled by a key, comes
 * only from a link in a description, or may answer what the game asks; whether the Gamemaster or
 * a companion may send it; the campaign's switch it has of its own, past the rolls'; and whether
 * it waits while the character is transformed.
 */
export type RollKindInfo = {
  /** A Gamemaster's roll of it as a character, as its player's page calls it by its kind (#156). */
  gmLabel: string
  /**
   * The dice it throws: a d20 roll's, hit dice spent as they are, a recharge's one d6, a formula's
   * or damage's own dice (`free`), or none.
   */
  dice: 'd20' | 'hitDice' | 'recharge' | 'free' | 'none'
  /** Damage or healing: from module 0.36.0, an action's on its own too. */
  damage?: true
  /** Its total is all of its rolls' added up, as dnd5e's card adds damage up, or hit dice's. */
  summed?: true
  /** The kind of option a check a description or an activity calls for has. */
  check?: 'skill' | 'tool' | 'check'
  /** It names what is rolled by its key: a skill's, a tool's or an ability's. */
  keyed?: true
  /** It is asked for by a link in a description, and only by one. */
  fromText?: true
  /** It may answer what the game asks: a saving throw, or where Midi-QOL asks, a check. */
  answers?: true
  /** The Gamemaster never sends it: it would leave no mark of theirs. */
  gm?: false
  /** A companion's roll is never of it. */
  companion?: false
  /** The campaign's switch it has of its own: it is never one of the rolls. */
  own?:
    | 'transfersEnabled'
    | 'removalsEnabled'
    | 'favoritesEnabled'
    | 'effectsEnabled'
    | 'wildShapeEnabled'
  /** It waits while the character is transformed: it would change its own actor's things. */
  shaped?: true
}

/** A d20 roll from the character's sheet, such as a skill check or a saving throw. */
export type SheetRoll = {
  /** What is rolled, such as "Perception check". */
  label: string
  modifier: number
  advantage?: Advantage
  /** What the player adds, such as +1d4 for Bless. */
  extras?: ExtraTerm[]
  /** What it is, for the Gamemaster's game to make it too. */
  source?: RollSource
  /**
   * Whether the player chose how to roll it, as in dnd5e's roll dialog, rather than tapping it to
   * roll as the sheet has it.
   */
  explicit?: boolean
  /** For an area attack, the names of the combatants it's made at, by their ids. */
  targetNames?: Record<string, string>
  /**
   * For a saving throw or check a description calls for, the DC it names, which it's made against;
   * or for a check an activity asks for, the activity's.
   */
  dc?: number
  /**
   * For an attack a spell an item casts makes, such as a staff's Guiding Bolt: cast at a level the
   * item offers, rather than with a spell slot.
   */
  itemCast?: boolean
  /**
   * dnd5e gives this attack Elven Accuracy, as its sheet says: a third d20 with advantage, typed
   * in, from 0.42.1 on its own line, which may be skipped for the game to roll where the roll goes
   * to the game.
   */
  elvenAccuracy?: true
  /** For an answer to what the game asks, when it stops waiting, as an ISO time. */
  until?: string
  /** For an answer to what the game asks, aborted once it's answered or closed elsewhere. */
  signal?: AbortSignal
  /**
   * For a saving throw a description's link calls for, what the link asks: a concentration check,
   * which dnd5e adds concentration's bonuses to, and so the dice effects add to one (module
   * 0.42.0).
   */
  ask?: EffectAsk
}

/** Damage or healing from the character's sheet, such as a weapon's. */
export type SheetDamageRoll = {
  /** What is rolled, such as "Longsword damage". */
  label: string
  /** Each part of the formula, with its kind of damage, such as "Slashing". */
  parts: { terms: ExtraTerm[]; type: string | null }[]
  /** A critical hit, which rolls every die twice, unless the game's or its rules say otherwise. */
  critical?: boolean
  /** Healing, or temporary hit points, rather than damage. */
  healing?: boolean
  /** The attack it's the damage of: its item and attack activity. */
  source?: { item: string; activity: string }
  /**
   * The attack or use made in the Gamemaster's game whose damage this is, to be rolled there too.
   */
  use?: string
  /** For the game, the kind of damage chosen for each of its rolls that offers a choice. */
  types?: (string | null)[]
  /** Its dice are the game's, a critical hit's already doubled. */
  exact?: boolean
  /** How the player changed it: more of its first die, another size of it, its highest. */
  modifiers?: DamageModifiers
  /**
   * For dice that are the game's, how many it throws for each die added, as a critical hit's
   * doubled dice take two.
   */
  perDie?: number
  /**
   * Its dice can't be changed: the game's preview has no first die to change, or one a module
   * before 0.21.0 would change otherwise.
   */
  fixed?: true
  /** For damage or healing a description deals, its link, for the game to roll it too. */
  text?: TextLink
  /**
   * For a description's damage the game rolls too, how the world's rules make a critical hit's, for
   * one to be thrown so here, once changed as the player chose, rather than every die twice.
   */
  criticalRule?: CriticalRule
  /**
   * For a description's damage, what a critical hit adds to each of its parts, where one is
   * offered, such as a weapon's extra dice and critical damage: thrown with it, as the world's
   * rules make one, or as dnd5e does by default where none are given.
   */
  criticalAdds?: CriticalAdds
  /** The game's total counts, once it says, as where its formula couldn't be read. */
  gameTotal?: true
  /**
   * Damage or healing on its own (module 0.36.0): its item and activity, the game's plan of its
   * dice, and whether this is a critical hit's; and from module 0.41.0, where the game sends its
   * choices, the slot, attack mode and ammunition it's rolled with, and whether it spends what its
   * use would.
   */
  alone?: {
    item: string
    activity: string
    plan?: TableDamagePlan
    critical?: boolean
    slot?: string
    attackMode?: string
    ammunition?: string
    consume?: true
  }
}

/**
 * Dice and numbers with no d20, from the character's sheet: a hit die spent, or several at once, or
 * an item's activity's own formula, such as a light's radius.
 */
export type SheetFormulaRoll = {
  /** What is rolled, such as "Hit die (d10)". */
  label: string
  /** Its terms, in order, such as 1d10 and +2; none where it's thrown in sets. */
  terms: ExtraTerm[]
  /**
   * Thrown in sets, all at once, each set's terms so many times, each time coming to its own total,
   * at least its least: as hit dice spent at once are, a set of each size, the largest first, each
   * die with the character's Constitution modifier.
   */
  sets?: { terms: ExtraTerm[]; times: number }[]
  /** Hit points given back, as a hit die's are. */
  healing?: boolean
  /** The least it comes to, as a hit die spent gives back at least 1; thrown in sets, each time. */
  minimum?: number
  /** What it is, for the Gamemaster's game to make it too. */
  source?: FormulaSource
  /** A recharge's d6 (module 0.36.0): the uses it recharges. */
  recharge?: { item: string; activity?: string }
}

/** Something the player added to a roll, or a term of a damage roll, and what it came to. */
export type LocalExtra = {
  /** As written, with its sign: +1d4, −1d6, +5, or a sheet's +2d6r<=2. */
  text: string
  /**
   * Each die's result, as first thrown, which is what the game is sent; empty for a flat number.
   * Foundry throws again itself any die it rerolls or explodes.
   */
  values: number[]
  /** What it adds to the total: negative for a term taken away. */
  value: number
  /**
   * For a term whose dice Foundry works out once thrown, such as 2d6r<=2's: every die thrown, the
   * first throw and then any rerolled or exploded, and what became of each.
   */
  thrown?: ThrownDie[]
}

/** A d20 roll as this page keeps it. */
export type LocalCheck = {
  kind: 'check'
  id: string
  label: string
  total: number
  modifier: number
  advantage?: Advantage
  /**
   * Every d20 thrown: two with advantage or disadvantage, three with Elven Accuracy's, or two where
   * its third was skipped for the game to roll.
   */
  d20s: number[]
  /** The d20 that counts. */
  natural: number
  extras: LocalExtra[]
  /** For a saving throw or check a description calls for, the DC it names; or an activity's. */
  dc?: number
  /**
   * For a saving throw or check a description or an activity calls for, what it's said to do when
   * it reaches its DC: a saving throw is saved, as one is unless it says, and a check passed.
   */
  verdict?: 'save' | 'check'
  /** Rolled from a link in a description. */
  described?: boolean
  /** The player typed its dice in. */
  typed?: true
  /**
   * The dice its effects add, or take away, that the player typed in, from module 0.42.0, each by
   * its faces and sign, as the game is sent them; none skipped. Each is among `extras` too, after
   * the player's own.
   */
  effectDice?: RollRequestInput['effectDice']
  /**
   * A die its effects add was skipped, for the game to roll it, from module 0.42.0, or from 0.42.1
   * Elven Accuracy's third d20: its total here leaves that out, so it says neither saved nor failed
   * by itself. Never for a die offered, added or not.
   */
  skipped?: true
  /**
   * What each die offered that the player added spent, from module 0.42.1, such as Bardic
   * Inspiration's Inspired: its die is among `extras`, after the player's own, as the game is sent
   * it, and once the game has made the roll, its effect is removed where the player may remove it.
   */
  spends?: OfferSpend[]
  /** Typed in, its rerolls made at the table, as the game keeps them, from module 0.42.0. */
  rerolls?: 'kept'
  at: number
}

/** A damage or healing roll as this page keeps it. */
export type LocalDamage = {
  kind: 'damage'
  id: string
  label: string
  /**
   * As dnd5e's card adds damage up: each kind's parts together, each kind at least 0, then every
   * kind.
   */
  total: number
  critical: boolean
  healing: boolean
  /** Every die at its highest, as the player chose. */
  maximized?: boolean
  /** Each part of the formula, with what it came to, below 0 where it took more away. */
  parts: { type: string | null; total: number; terms: LocalExtra[] }[]
  /** Rolled from a link in a description. */
  described?: boolean
  /**
   * A critical hit's whose dice the world's rules change as only the game can add them up, such as
   * Midi-QOL's at their highest; or one with a die rerolled or exploded, which Foundry throws again
   * itself: its total is the game's, once it says.
   */
  gameTotal?: boolean
  /** The player typed its dice in. */
  typed?: true
  /** Typed in, its rerolls made at the table, as the game keeps them, from module 0.42.0. */
  rerolls?: 'kept'
  at: number
}

/**
 * A spell or feature used in the Gamemaster's game, as this page keeps it: it throws no dice of
 * its own, but follows its way to the game.
 */
export type LocalUse = {
  kind: 'use'
  id: string
  /** What was used, such as "Fireball". */
  label: string
  /** A spell, which is cast, rather than used. */
  spell: boolean
  /**
   * A spell an item casts, or one of its activities, such as a wand's Magic Missile: cast at a
   * level the item offers, rather than with a spell slot.
   */
  itemCast?: boolean
  /**
   * An enchantment ended, such as Magic Weapon's on a longsword, rather than anything used, from
   * module 0.21.0: what it's called is the label; or from module 0.29.0, a concentration ended.
   */
  ending?: boolean
  /**
   * Charges spent directly, rather than anything used, from module 0.29.0: how many; what they're
   * of, such as "Sorcery Points", is the label.
   */
  spent?: number
  /** Heroic Inspiration used, or gained, rather than anything used, from module 0.29.0. */
  inspiration?: 'use' | 'gain'
  /**
   * A spell slot spent or restored from the dots, from module 0.42.1, rather than anything used:
   * which; the pool's slot, such as "1st-level spell slot", is the label.
   */
  slot?: SpellSlotOp
  /**
   * Items or coins moved, rather than anything used, from module 0.31.0: what moved, as the chat
   * line says it, is the label.
   */
  move?: LocalMove
  /**
   * A favorite added or removed, rather than anything used, from module 0.37.0: what it's of is the
   * label.
   */
  favorite?: 'add' | 'remove'
  /**
   * A spell prepared or unprepared, rather than anything used, from module 0.42.1: what it's of is
   * the label.
   */
  prepare?: PrepareOp
  /**
   * One of the character's own effects turned off, on or deleted, rather than anything used, from
   * module 0.39.0: which; the effect is the label.
   */
  effect?: EffectOp
  /**
   * Wild Shape used from here, rather than anything used, from module 0.40.0: a change into a
   * known form, a return, or a Beast learned, and of which; "Wild Shape" is the label.
   */
  wildShape?: WildShapeLogged
  at: number
}

/**
 * Items or coins moved, as a page keeps the move: given, taken, or from module 0.32.0 sent from a
 * party or distributed among its characters, and between whom; or from module 0.33.0 removed from
 * the character.
 */
export type LocalMove = {
  verb: 'give' | 'take' | 'send' | 'distribute' | 'remove'
  /**
   * As the chat line says it, such as "2 Potion of Healing", or for a distribution, all it shares,
   * "100 gp".
   */
  things: string
  /**
   * The other end's name: who it's given or sent to, or the party it's taken or distributed from;
   * for a removal, the character it's removed from.
   */
  other: string
  /** Who moved it, for the Gamemaster's words: the character's name. Unset for a player. */
  mover?: string
  /** The item moved, if one, to disable its control while pending. */
  item?: string
  /** A send's: the party it's sent from, from module 0.32.0. */
  source?: string
  /**
   * A distribution's: who shares it, as the line lists them, such as "Bram, Lia, Thorin, and Vex".
   */
  among?: string
  /** A distribution's: each one's share, such as "25 gp". */
  each?: string
}

/** A hit die spent, or a formula rolled, as this page keeps it. */
export type LocalFormula = {
  kind: 'formula'
  id: string
  label: string
  total: number
  healing: boolean
  /**
   * Each term, with what it came to; thrown in sets, as hit dice spent at once, each set's dice as
   * one term, in order, then all of their numbers as one.
   */
  terms: LocalExtra[]
  /**
   * The least it comes to, when its dice and numbers came to less; for several thrown together,
   * the least each does, when one of them came to less.
   */
  minimum?: number
  /** How many dice were thrown together, each to its own total, as hit dice spent at once. */
  times?: number
  /** Rolled from a link in a description. */
  described?: boolean
  /**
   * A die of it was rerolled or exploded, which Foundry throws again itself: its total is the
   * game's, once it says.
   */
  gameTotal?: boolean
  /** The player typed its dice in. */
  typed?: true
  /** Typed in, its rerolls made at the table, as the game keeps them, from module 0.42.0. */
  rerolls?: 'kept'
  /** A recharge's d6 (module 0.36.0): what it recharges, for its titles. */
  recharge?: { name: string }
  at: number
}

/**
 * The table asked for a saving throw or check a description calls for, as this page keeps it: it
 * throws no dice, but follows its way to the game.
 */
export type LocalAsk = {
  kind: 'ask'
  id: string
  /** What was asked for, such as "DC 15 Dexterity saving throw" or "Strength (Athletics) check". */
  label: string
  at: number
}

/**
 * A roll the campaign's Gamemaster made as the player's character from their page (#156), shown on
 * the player's beside their own: it throws no dice here, but follows its way to the game, as the
 * player's table view tells it.
 */
export type LocalGmRoll = {
  kind: 'gm'
  /** Apart from this page's own: `gm:` and its id at the table. */
  id: string
  /** As the Gamemaster's page called it, such as "Perception check". */
  label: string
  /** What it is, such as "skill" or "attack". */
  rolled: RollKind
  /** Of damage, healing, as the game said it is. */
  healing?: true
  /** Of a spell slot, from module 0.42.1: spent or restored, as the Gamemaster's page asked. */
  slotOp?: SpellSlotOp
  /**
   * When this page first heard of it, by this device's clock, as its own rolls are made by
   * (`useGmRolls`).
   */
  at: number
}

/**
 * A roll as this page keeps it, or a use, or an ask; or one of the Gamemaster's as the character.
 */
export type LocalRoll =
  LocalCheck | LocalDamage | LocalUse | LocalFormula | LocalAsk | LocalGmRoll

/**
 * What the game takes of a roll typed in, from module 0.42.0: the dice the character's effects add
 * to it, or take from it, each asked for, or skipped for the game to roll; and whether the dice
 * typed are kept as the player rerolled them at the table. From 0.42.1, whether the roll goes to
 * the game at all, for Elven Accuracy's third d20 to be skipped for it to roll; and from module
 * 0.42.1, the dice the sheet offers it, for the player to add once it fails.
 */
export type TypedRolls = {
  /** The dice effects add to this roll, to type in: none where the game takes none. */
  effectsFor: (request: SheetRoll) => SheetEffectDie[]
  keptRerolls: boolean
  /**
   * Whether this roll goes to the game from this device now, from 0.42.1: only then may Elven
   * Accuracy's third d20 be skipped, for the game to roll. Left out, it doesn't.
   */
  sends?: (request: SheetRoll) => boolean
  /**
   * The dice the sheet offers this roll, from module 0.42.1, such as Bardic Inspiration's, which
   * the player may add once the roll fails: none where the game takes none, or each is spent.
   * Left out, none.
   */
  offersFor?: (request: SheetRoll) => SheetOffer[]
}

/** What the player chose for damage on its own: the slot, the attack mode and the ammunition. */
export type AloneSelection = {
  slot?: string | null
  attackMode?: string
  ammunition?: string
}

/** The picks that change damage on its own's dice, by which its plan is looked up. */
export type AlonePicks = {
  level?: number
  attackMode?: string
  ammunition?: string
}

/** The row damage on its own is of, and the spellbook its slots are in. */
export type AloneRow = { action: SheetAction; spells: SheetSpellSection[] }

/** The dice damage on its own throws as picked, and a critical hit's where one is allowed. */
export type AlonePlan = {
  normal: DamagePreview
  critical: DamagePreview | null
}

/** A character's hit dice of one size: how many are left, of how many, where the sheet says. */
export type HitDicePool = {
  /** Such as "d10". */
  die: string
  value: number | null
  max: number | null
}

/** Hit dice of one size chosen to spend at once: the size, such as "d10", and how many. */
export type HitDiceCount = { die: string; count: number }

/**
 * Dice added to or taken from a roll, such as +1d4 for Bless or −1d6. Of damage, those a critical
 * hit's critical damage adds, such as a weapon's, are marked `added`: never its first die.
 */
export type ExtraDice = {
  sign: 1 | -1
  count: number
  sides: DieSides
  added?: true
  /**
   * What Foundry does with the dice once thrown, each as written, in order, such as "r<=2" or
   * "kh3"; none for none. Only a formula of the sheet's has them, never what a player adds.
   */
  modifiers?: string[]
}

/** A flat number added to or taken from a roll. */
export type ExtraFlat = { sign: 1 | -1; flat: number }

export type ExtraTerm = ExtraDice | ExtraFlat

export type ParseExtrasResult =
  { ok: true; terms: ExtraTerm[] } | { ok: false; error: string }

/** What a Wild Shape command logged here asked: its op, and of which form or Beast. */
export type WildShapeLogged = {
  op: Exclude<WildShapeOp, 'forms'>
  /** The form taken or left, or the Beast learned, by name. */
  form?: string
  /** The known form a Beast learned replaces, by name. */
  old?: string
  /** The character's name, which its toast names. */
  character: string
  /** For a return, the temporary hit points the character has, which stay. */
  temp?: number
}

/** How a result is compared with a modifier's target, as Foundry compares them. */
export type Comparison = '=' | '<' | '<=' | '>' | '>='

/** One of a term's modifiers, read. */
export type DieModifier =
  | {
      /** Rerolled (`r`, once; `rr`, until it no longer matches) or exploded (`x`; `xo`, once). */
      kind: 'reroll' | 'explode'
      recursive: boolean
      /** The most results rerolled or exploded; none for no limit. */
      most?: number
      comparison: Comparison
      target: number
    }
  | {
      /** Kept (`k`, `kh`, `kl`) or dropped (`d`, `dh`, `dl`) among the active results. */
      kind: 'keep' | 'drop'
      highest: boolean
      count: number
    }
  | {
      /** Each result counts at least (`min`) or at most (`max`) so much. */
      kind: 'min' | 'max'
      value: number
    }
  | {
      /** Each result counts 1 where it matches, else 0: a success (`cs`) or a failure (`cf`). */
      kind: 'count'
      success: boolean
      comparison: Comparison
      target: number
    }

/** A die of a term as thrown, and what became of it. */
export type ThrownDie = {
  /** The face it landed on. */
  value: number
  /** It counts toward the total. */
  active: boolean
  /** What it counts as, where a modifier says, such as 1 for a success; else its value. */
  counts?: number
  /** It was rerolled: a die thrown after it took its place. */
  rerolled?: true
  /** It exploded: another die was thrown for it. */
  exploded?: true
  /** It was dropped, or not kept. */
  discarded?: true
}

/** A term's dice as thrown and worked out, and what they came to. */
export type ThrownTerm = {
  /** Every die thrown, in the order Foundry throws them: the first throw, then the rest. */
  dice: ThrownDie[]
  /** What the active dice count for, added up, the term's sign left out. */
  total: number
  /** A die was rerolled or exploded, which at the table Foundry throws, not the player. */
  rethrown: boolean
}

/** A part of a move, as it's told: an item and how many of it, or a coin and how many. */
export type MovedPart =
  { quantity: number; name: string } | { coins: number; abbreviation: string }

/** An attack's or a use's item and activity, by which its damage is found. */
export type AttackSource = { item: string; activity: string }

/**
 * A roll's way to the Gamemaster's game, as its player is told: as the app has it, or refused,
 * when the app didn't take it for the game at all, saying why. An attack's or a use's also keeps
 * its id at the table and what it was made with, so that its damage can be rolled there too, once.
 */
export type TableRollState = Omit<
  RollRequestView,
  'id' | 'status' | 'effect' | 'wildShape' | 'alone'
> & {
  status: RollStatus | 'refused'
  /** Its id at the table, once the app has taken it. */
  requestId?: string
  /** For an attack or a use, its item and activity. */
  source?: AttackSource
  /** For a use, what was used, such as "Fireball", which its damage is named after. */
  name?: string
  /** For a use, how the player chose to change the damage that follows it. */
  modifiers?: DamageModifiers
  /** For an attack or a use, whether its damage has been sent. */
  damaged?: boolean
  /** For a saving throw the game asked for, the prompt it answers. */
  prompt?: string
  /** For an area attack, the names of the combatants it was made at, by their ids. */
  targetNames?: Record<string, string>
  /**
   * For an attack or a use of a spell an item casts, which is cast at a level the item offers,
   * rather than with a spell slot: a level it doesn't offer is refused as a slot is.
   */
  itemCast?: boolean
  /**
   * For hit dice spent at once sent as one, as from module 0.20.0, which are refused for want of
   * dice where there aren't as many of a size left as are spent, not only where there are none.
   */
  hitDice?: boolean
  /**
   * For rolls sent one after another as one, as hit dice spent at once are to a game before module
   * 0.20.0, a request a die: how many there are, and how many of them the game has made. From
   * 0.20.0, sent as one, the same, once the game stopped part way through them.
   */
  together?: { count: number; made: number }
  /**
   * For a roll of a d20 the Gamemaster made as the character (#156), whether the game says it came
   * up a critical or a fumble, as there are no dice of it here to say.
   */
  d20?: GmRollView['d20']
  /**
   * For damage the Gamemaster rolled as the character (#156), that the game says it's a critical
   * hit's, as there are no dice of it here to say.
   */
  critical?: GmRollView['critical']
  /**
   * For a move of items and coins, from module 0.31.0, what moved and between whom; and for a
   * removal, from module 0.33.0, what was removed and from whom.
   */
  move?: LocalMove
  /**
   * For a use, its damage waits for the player to roll it, as one with a choice of kinds does,
   * while they type in their own dice.
   */
  offer?: true
  /** Damage or healing sent on its own (module 0.36.0). */
  alone?: true
  /**
   * Damage on its own that asked to spend what its use would, from module 0.41.0 (round 0.41.0
   * §2.10): its tray says what was spent, once the game says.
   */
  consumes?: true
  /**
   * What the game spent of it, once made (the view's `alone.spent`), none where it spent nothing;
   * kept apart from the hit dice a request spent, `spent`.
   */
  aloneSpent?: AloneSpend[]
  /** That concentration began as it was spent (the view's `alone.concentrating`). */
  concentrating?: true
  /** A recharge rolled (module 0.36.0). */
  recharge?: true
  /** A favorite added or removed (module 0.37.0). */
  favorite?: 'add' | 'remove'
  /** One of the character's own effects turned off, on or deleted (module 0.39.0): which. */
  effect?: EffectOp
  /** A spell prepared or unprepared (module 0.42.1): which. */
  prepare?: PrepareOp
  /** A spell slot spent or restored (module 0.42.1): which. */
  spellSlot?: SpellSlotOp
  /**
   * What became of that effect, once made, as the game says (the view's `effect`): kept apart from
   * what was asked, which the line is worded by.
   */
  changed?: EffectChange
  /** Wild Shape from here (module 0.40.0): which op was asked. */
  wildShape?: WildShapeOp
  /**
   * What the game made of it, once made (the view's `wildShape`): the form taken or left, or the
   * Beast learned, kept apart from what was asked, as an effect's is.
   */
  wildShaped?: WildShapeOutcome
}

/**
 * What a description's link a saving throw is made from asks: a save, or a concentration check, by
 * the types a table's ask (src/types/table.ts's TableAsk) has, written out so that this file needs
 * nothing from that one (no import cycle).
 */
export type EffectAsk = { type: 'save' | 'concentration' | 'check' }

/**
 * What adding a die the sheet offers spends: the effect it uses up, by the sheet's id for it; that
 * effect's own name, such as "Inspired"; and the offer's, such as "Bardic Inspiration", or "Bardic
 * Inspiration (Vex)" beside another bard's.
 */
export type OfferSpend = { effect: string; name: string; offer: string }

/**
 * A die the sheet offers a roll, from module 0.42.1, which the game doesn't add, for its player to
 * add once the roll fails, as the 2024 Bardic Inspiration's: the die, and what adding it spends.
 */
export type SheetOffer = { die: SheetEffectDie; spends: OfferSpend }

export type TableRoll = {
  formula: string
  total: number | null
  dice: { faces: number | null; value: number; active: boolean }[]
  advantage: boolean
  disadvantage: boolean
  critical: boolean
  fumble: boolean
  damageType?: string
}

/** How a player changes damage or healing as they roll it. Each changes nothing unless set. */
export type DamageModifiers = {
  /** How many more of its first die. */
  extra?: number
  /** The size its first die is made instead, such as 12 for a d12. */
  faces?: DieSize
  /** Every die at its highest. */
  maximize?: boolean
}

export type DieSize = (typeof DIE_SIZES)[number]

/**
 * What a critical hit adds to each of damage's parts, in order: the extra dice its first die
 * throws, such as Savage Attacks' or Brutal Critical's, and the terms of its critical damage, such
 * as a weapon's 1d6; none, each, where it adds nothing.
 */
export type CriticalAdds = { dice: number[]; damage: ExtraTerm[][] }

/** How damage may be changed as it's rolled: at its highest, or with its dice changed first. */
export type DamageChange = 'maximize' | 'modify-damage'
