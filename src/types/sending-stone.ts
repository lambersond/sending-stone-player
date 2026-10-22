import type { PROMPT_SOURCES } from '@/constants/sending-stone'
import type { FoundrySettings } from '@/types/foundry-settings'
import type { NoteBookKind, NoteRole } from '@/types/notes'
import type { GroupEntry, GroupSheet } from '@/types/party'
import type { RemovedItem, TransferMoved } from '@/types/roll'

/**
 * What the fvtt-sending-stone module sends, as far as this app reads it. Payloads may carry more
 * fields than these; they are kept when stored.
 */

/** A campaign as each envelope names it. */
export type CampaignRef = {
  /** The module's id for the campaign, which never changes. */
  id: string
  /** The title the Gamemaster gave it, which players use to find it. */
  title: string
}

export type Envelope = {
  protocol: number
  id: string
  session: string
  sequence: number | null
  type: string
  time: string
  world: { id: string; title: string }
  /** The campaign the event is for. Null only on bridge.ping. */
  campaign: CampaignRef | null
  data: Record<string, unknown>
}

export type ConnectedCharacter = {
  id: string
  name: string
  /** The portrait's path: relative to the game's address, or a full URL. */
  img?: string | null
  /**
   * The character's sheet under dnd5e; null under another system, or from modules before 0.5.0.
   * Absent from a hello from module 0.22.0, after which each sheet comes in a post of its own.
   */
  sheet?: CharacterSheet | null
  /** Why its sheet is null, where the module held it back. Module 0.22.0. */
  sheetWithheld?: SheetWithheld
  /**
   * Whether its player may enter its dice results here, as the module says from 0.32.0; always
   * false before. Module 0.26.0.
   */
  manualDice?: boolean
}

/**
 * Why the module held a character's sheet back: such as "tooLarge", for one that came to more than
 * this app takes, with its size and that limit, in bytes, each null where it can't be read.
 */
export type SheetWithheld = {
  reason: string
  bytes: number | null
  limit: number | null
}

/** Whether a roll is made with advantage (1), disadvantage (-1), or neither (0). */
export type RollMode = -1 | 0 | 1

/** An ability, with the modifiers dnd5e shows for its check and its saving throw. */
export type SheetAbility = {
  id: string
  label: string
  abbreviation: string
  score: number | null
  mod: number
  check: number
  save: number
  saveProficient: boolean
  checkMode: RollMode
  saveMode: RollMode
}

export type SheetSkill = {
  id: string
  label: string
  /** The ability it is checked with, such as "wis". */
  ability: string
  total: number
  passive: number | null
  /** 0, 0.5 (half), 1 (proficient) or 2 (expertise). */
  proficiency: number
  mode: RollMode
}

/** A character's sheet as the module sends it. Every modifier is the one dnd5e shows. */
export type SheetClass = {
  id?: string | null
  /** dnd5e's, such as "fighter": the id of the class's section of features. */
  identifier?: string | null
  name: string
  levels: number | null
  subclass: string | null
  /** The size of its hit dice, and how many are left of how many. */
  hitDice?: { die: string; value: number | null; max: number | null } | null
}

/** A status the game names, such as Poisoned or Concentrating. */
export type SheetCondition = {
  id: string
  name: string
  /** Relative to the game's address, or a full URL. */
  img: string | null
  /** Exhaustion's level. */
  level: number | null
  /** What the character is concentrating on. */
  detail: string | null
  /** Its rules: a description's hash. */
  text: string | null
}

/** What the character concentrates on, from module 0.29.0: each of dnd5e's concentrations. */
export type SheetConcentration = { effects: SheetConcentrationEffect[] }

/**
 * A concentration of the character's: its effect's id, which ends it; what it's on, named as its
 * player knows it, an unidentified scroll's as unidentified; and that item's id, while it's the
 * character's, as a scroll spent to cast it isn't.
 */
export type SheetConcentrationEffect = {
  id: string
  name: string
  item: string | null
}

export type SheetUses = {
  /** Uses left. */
  value: number
  max: number
  /** When they come back, such as "Short Rest, Long Rest". */
  recovery: string | null
  /**
   * Which counter they are, from module 0.29.0: an item's own uses, one of its activities', or an
   * old-style resource. Absent before, and for what a Cast or another activity it uses spends of
   * another counter.
   */
  counter?: SheetCounter
  /**
   * That its player may spend them directly here, from module 0.29.0: not a spell's own, which
   * casting it spends, nor those of an item used up as they run out, such as a potion's, which
   * only using it should spend, nor an unidentified item's.
   */
  spendable?: true
}

/**
 * A counter of the character's, as the module names one, from module 0.29.0: an item's own uses,
 * by its id; one of its activities' own, by both; or one of dnd5e's old-style resources.
 */
export type SheetCounter =
  | { item: string; activity?: string }
  | { resource: 'primary' | 'secondary' | 'tertiary' }

export type SheetFeature = {
  id: string
  name: string
  img: string | null
  /** Such as "Class Feature". */
  kind: string | null
  /** Such as "Fighter 1". */
  requirements: string | null
  /** Such as "1 Bonus Action". */
  activation: string | null
  passive: boolean
  uses: SheetUses | null
  /** The enchantments on it, such as a spell's. Module 0.21.0; absent before, and for none. */
  enchantments?: SheetEnchantment[]
  text: string | null
} & SheetUsage

/**
 * How a feature or inventory item that rolls, or is used through anything, is used, as an action
 * is, and what it rolls. Module 0.13.0; absent from one that rolls nothing, and before.
 */
export type SheetUsage = Partial<
  Pick<SheetAction, 'range' | 'target' | 'concentration'> & SheetRolls
>

/** Features from one class, the species, the background, or anything else. */
export type SheetFeatureSection = {
  id: string
  label: string
  /** The class's, species' or background's own description. */
  text: string | null
  features: SheetFeature[]
}

export type SheetEffect = {
  id: string
  name: string
  img: string | null
  /** What it comes from, such as an item or another character's spell. */
  source: string | null
  /** The time it has left, such as "9 Rounds". */
  duration: string | null
  disabled: boolean
  text: string | null
}

/** dnd5e's categories: temporary, passive, inactive and suppressed (unavailable). */
export type SheetEffectSection = {
  id: string
  label: string
  effects: SheetEffect[]
}

export type SheetItem = {
  id: string
  name: string
  img: string | null
  /** Such as "weapon" or "container". */
  type: string
  quantity: number
  /** The item's and its quantity's weight together, or null for none. */
  weight: { value: number; units: string } | null
  /** dnd5e's label, such as "15 GP". */
  price: string | null
  /** Null for a type that is never equipped. */
  equipped: boolean | null
  attunement: 'required' | 'optional' | null
  attuned: boolean
  uses: SheetUses | null
  rarity: string | null
  properties: string[]
  /** False for an item not identified yet, which keeps its secrets. */
  identified: boolean
  /** Such as "1 Action", for an item that rolls. Module 0.13.0. */
  activation?: string | null
  /**
   * The enchantments on it, such as Magic Weapon's on a longsword, or a Flame Tongue's own. Module
   * 0.21.0; absent before, and for none.
   */
  enchantments?: SheetEnchantment[]
  text: string | null
} & SheetUsage

export type SheetContainer = SheetItem & {
  /** How full it is, by count or weight; null without a limit, or when its contents are secret. */
  capacity: { value: number; max: number; units: string } | null
  /** Null when its contents are secret. */
  contents: (SheetItem | SheetContainer)[] | null
}

/**
 * A coin as the sheet lists it: its dnd5e key, such as "gp", its name and abbreviation, and how
 * many, which dnd5e 6 may hold in part, as 10.5.
 */
export type SheetCurrency = {
  id: string
  label: string
  abbreviation: string
  value: number
}

export type SheetInventory = {
  /** Items by type, in dnd5e's order, leaving out those in containers. */
  sections: { id: string; label: string; items: SheetItem[] }[]
  containers: SheetContainer[]
  currency: SheetCurrency[]
  /** Where being encumbered begins is set only under the variant rule. */
  encumbrance: {
    value: number
    max: number | null
    units: string
    encumbered: number | null
    heavilyEncumbered: number | null
  } | null
  attunement: { value: number; max: number | null } | null
}

export type SheetSpellcasting = {
  ability: string | null
  /** Spell save DC. */
  dc: number | null
  /** Spell attack bonus. */
  attack: number | null
  classes: {
    name: string
    ability: string | null
    dc: number | null
    attack: number | null
  }[]
}

/** The item a spell is cast from, with one of its Cast activities, such as a wand. Module 0.8.2. */
/**
 * The item a spell is cast from. From module 0.16.0, one the item can't cast now says so, and
 * whether it's for want of attuning to the item.
 */
export type SheetCastFrom = {
  id: string
  name: string
  usable?: boolean
  attune?: boolean
}

export type SheetSpell = {
  id: string
  name: string
  img: string | null
  level: number
  school: string | null
  /** Such as "V, S, M". */
  components: string | null
  materials: string | null
  concentration: boolean
  ritual: boolean
  activation: string | null
  range: string | null
  duration: string | null
  target: string | null
  /** 0 unprepared, 1 prepared, 2 always prepared; null for one that isn't prepared. */
  prepared: 0 | 1 | 2 | null
  uses: SheetUses | null
  /** The item it's cast from, such as a wand; null or absent for the character's own. */
  castFrom?: SheetCastFrom | null
  /** The enchantments on it. Module 0.21.0; absent before, and for none. */
  enchantments?: SheetEnchantment[]
  text: string | null
} & Partial<SheetRolls>

/** Cantrips, a spell level, pact magic, or a casting method such as at will. */
export type SheetSpellSection = {
  id: string
  label: string
  /**
   * Slots left of how many, for a section that uses them, and the level a spell is cast at with
   * one, which for pact magic is its slots' level. The level is null for pact magic without
   * slots, and from module 0.8.0 and earlier.
   */
  slots: { value: number; max: number; level?: number | null } | null
  spells: SheetSpell[]
}

/** Such as Senses: Darkvision 60 ft. */
export type SheetTrait = { id: string; label: string; values: string[] }

export type SheetDetail = { id: string; label: string; value: string }

export type SheetDetails = {
  /** Alignment, age and the like. */
  about: SheetDetail[]
  /** Personality traits, ideals, bonds and flaws. */
  personality: SheetDetail[]
  appearance: string | null
  xp: { value: number; max: number | null } | null
  /** Its description's hash. */
  biography: string | null
}

/** A part of an action's damage or healing, such as 1d8 + 4 slashing. */
export type SheetDamage = {
  /** As dnd5e shows it, such as "1d8 + 4". */
  formula: string
  /** Such as "Slashing" or "Healing"; null for none. */
  type: string | null
  /** Healing or temporary hit points, rather than damage. */
  healing: boolean
}

/** Something the character can do in a fight, as Tidy 5e's Actions tab lists it. */
export type SheetAction = {
  /** The item's id. */
  id: string
  name: string
  img: string | null
  /** The item's type, such as "weapon", "spell" or "feat". */
  type: string
  /** Such as "1 Action" or "1 Bonus Action". */
  activation: string | null
  /**
   * The kind of action it's activated with, as a section's id names it, such as "action", "bonus"
   * or "reaction", where it takes just one; null for any other, such as two actions or a minute.
   * Module 0.15.0.
   */
  activationType?: string | null
  range: string | null
  target: string | null
  /** The bonus to hit, for an action that attacks. */
  toHit: number | null
  /**
   * The attack activity the bonus to hit is for, by which the attack is made in the Gamemaster's
   * game. Module 0.11.0; absent before, and null for an action that doesn't attack.
   */
  attackId?: string | null
  /** dnd5e gives its attack Elven Accuracy: a third d20 with advantage. Module 0.32.0. */
  elvenAccuracy?: true
  /**
   * What else it's used through in the Gamemaster's game, such as a saving throw or healing, and
   * whom at. Module 0.12.0; absent before, and null for an action with none.
   */
  activity?: SheetUse | null
  /** The ways its attack is made, when there's more than one, such as thrown. Module 0.12.0. */
  attackModes?: SheetAttackMode[] | null
  /** The ammunition its attack fires, for a weapon that fires it. Module 0.12.0. */
  ammunition?: SheetAmmunition[] | null
  /** The saving throw it calls for: the ability's abbreviation, such as "DEX", and the DC. */
  save: { ability: string; dc: number | null } | null
  damage: SheetDamage[]
  /**
   * False for a spell's activity used after it's cast without spending a spell slot, such as Hex's
   * Bonus Hex Damage: it's used at the level chosen, whether any slot is left or not. Module
   * 0.14.0; absent otherwise. From module 0.20.0, the same of the copy of a spell an item casts,
   * cantrips' too: it spends none of the item's uses either. From module 0.21.0, false too for a
   * spell's activity that uses another, such as its free casting, which spends no slot and is cast
   * at its own level whatever slot is chosen; and for a leveled spell's check with no activation of
   * its own, such as the 2014 Entangle's Escape Plants, which is used at the level chosen.
   */
  consumesSlot?: boolean
  /**
   * Each of its activities, for an item with more than one: its first, which the rest of the action
   * is, such as Hex's curse, then the others, such as its Bonus Hex Damage. Module 0.14.0; absent
   * otherwise.
   */
  activities?: SheetActivity[]
  /**
   * The activity an item is listed for in a section of the Actions tab, where it isn't the item's
   * first, such as a staff's Silvery Barbs under Reactions. Module 0.15.0; absent otherwise.
   */
  activityName?: string | null
  /** For a spell an item casts, with a Cast activity, how it's cast. Module 0.15.0. */
  cast?: SheetCast | null
  /**
   * For a Cast, the id of the copy of its spell the Spells tab lists under the item. Module
   * 0.17.0; absent before, and for a Cast whose spell dnd5e keeps no copy of.
   */
  spellId?: string | null
  /**
   * Its activity's own formula, rolled any time, apart from using it, such as a light's radius.
   * Module 0.16.0.
   */
  rollFormula?: SheetFormula | null
  /**
   * For an area attack, such as a breath weapon's, whom it's made at: as many as it takes. Module
   * 0.16.0; absent for any other.
   */
  attackArea?: SheetAttackArea | null
  /** An item used up rather than kept: a consumable, or one whose uses never come back. */
  consumable?: boolean
  /**
   * For an activity that asks for a check, such as Fast Hands' Sleight of Hand or a tool's, the
   * ways it may be made, against what DC, and whether the character makes it. Module 0.21.0, under
   * dnd5e 5; absent otherwise.
   */
  check?: SheetCheck
  /**
   * For an activity that uses another, as dnd5e's forward activities do, such as a spell cast once
   * a day without a slot: what using it spends of its uses. Its rolls and `activity` are the other
   * activity's, under its own id. Module 0.21.0; absent otherwise.
   */
  forward?: SheetForward
  uses: SheetUses | null
  /** A spell's level, 0 for a cantrip; null for anything else. */
  level: number | null
  /** For a spell, the item it's cast from, such as a wand; null or absent for anything else. */
  castFrom?: SheetCastFrom | null
  concentration: boolean
  /** False for an item not identified yet, which keeps its secrets. */
  identified: boolean
  /**
   * The enchantments on its item, such as Magic Weapon's on a longsword. Module 0.21.0; absent
   * before, and for none.
   */
  enchantments?: SheetEnchantment[]
  text: string | null
}

/**
 * An enchantment on one of the character's items, as dnd5e's enchant activities apply them, such
 * as Magic Weapon's on a longsword, or a Flame Tongue's own: what it's called, what put it there,
 * whether it lasts while its caster concentrates, how long it has left, whether its time has run
 * out, and whether the player may end it from here, as dnd5e's chat card lets its caster. Module
 * 0.21.0.
 */
export type SheetEnchantment = {
  /** Its effect's id. */
  id: string
  /** Such as "Magic Weapon, +1". */
  name: string
  /** The item whose activity applied it, such as "Magic Weapon"; null where it can't be found. */
  source: string | null
  /** It ends when its caster stops concentrating. */
  concentration: boolean
  /** The time it has left, such as "1 Hour"; null for none. */
  duration: string | null
  /** Its time has run out, which dnd5e 5 never removes it for. */
  expired: boolean
  /** One of the character's own the player may end from here. */
  endable: boolean
}

/**
 * How a spell an item casts is cast, such as a staff's Silvery Barbs: at what level, whether it
 * takes concentration, how many of the item's uses it spends, if any, and whether that many are
 * left; and, where the item is listed for it, the spell's description.
 */
export type SheetCast = {
  /** The level it's cast at when none is chosen: the Cast's, or the spell's own if higher. */
  level: number
  concentration: boolean
  /** How many of the item's uses, or the activity's own, it spends; null for none, or a formula. */
  charges: number | null
  /** Fewer are left than it spends. */
  short: boolean
  /** The spell's description's hash. */
  text?: string | null
  /**
   * For one the item lets be cast higher, such as a wand's Magic Missile, each level it may be cast
   * at, from `level` up, as dnd5e offers them; but those whose cost is more than the item ever has.
   * At least two, in order, the first at `level`, as it spends there. Module 0.20.0; absent before,
   * and for one cast at its level alone.
   */
  levels?: SheetCastLevel[]
}

/**
 * A level a spell an item casts may be cast at, with how many of the item's uses it spends there,
 * as `charges` and `short` say of the cast.
 */
export type SheetCastLevel = {
  /** 1 to 9. */
  level: number
  /** How many of the item's uses it spends; null for none, or a formula. */
  charges: number | null
  /** Fewer are left than it spends. */
  short: boolean
}

/**
 * Whom an area attack is made at: as many as it affects, or any number, more for each level a
 * spell is cast above its own where it says so, and of what kind, such as "creature".
 */
export type SheetAttackArea = Pick<
  SheetUseTargets,
  'count' | 'perLevel' | 'affects'
>

/**
 * A utility activity's own formula, with the character's numbers in it, such as "1d4 + 3", and
 * what dnd5e calls it, such as "Light radius", if anything.
 */
export type SheetFormula = { formula: string; name: string | null }

/**
 * An activity a player can have used in the Gamemaster's game other than an attack: one calling for
 * a saving throw, dealing damage, healing, or anything else, such as Bless.
 */
export type SheetUse = {
  /** The activity's id. */
  id: string
  /**
   * From module 0.21.0, "check" too, for one that asks for a check, such as Maze; and "enchant",
   * for one that enchants an item, such as Magic Weapon.
   */
  type: 'save' | 'damage' | 'heal' | 'utility' | 'check' | 'enchant'
  /** Whom it's used at; for an enchant activity, never anyone: what it enchants is in `enchant`. */
  targets: SheetUseTargets
  /** For an enchant activity, what it enchants and how. Module 0.21.0; absent for any other. */
  enchant?: SheetEnchant
  /**
   * What using it spends, from module 0.29.0: each counter, and how many of it, null for a cost
   * worked out by a formula. Absent before, and where it spends none of the character's counters.
   */
  spends?: SheetSpend[]
}

/** A counter an activity spends as it's used, and how many of it; null where it's a formula's. */
export type SheetSpend = { counter: SheetCounter; amount: number | null }

/**
 * What an enchant activity enchants, as dnd5e applies it, such as Magic Weapon on a weapon of the
 * character's, or a Flame Tongue set alight: its item itself, or one of the character's items its
 * rules allow; the ways it may enchant it; and the enchantments it has applied. Module 0.21.0.
 */
export type SheetEnchant = {
  /** It enchants its own item, as a Flame Tongue's Engulf in Flames does. */
  self: boolean
  /**
   * It enchants its own item and spends nothing, no slot nor use, nor takes concentration, so that
   * it's turned on and off as a switch is, as Engulf in Flames is.
   */
  toggle: boolean
  /** The ways it may enchant, such as "Magic Weapon, +1", one to twenty, in dnd5e's order. */
  profiles: SheetEnchantProfile[]
  /**
   * The ids of the character's items it may enchant, as dnd5e's rules for it allow, in the order
   * the character has them; none for one that enchants its own item.
   */
  items: string[]
  /** The enchantments it has applied to the character's items; at most one of its own item. */
  applied: SheetEnchantApplied[]
}

/**
 * A way an enchant activity may enchant, such as "Magic Weapon, +2", with the spell levels it's
 * offered at, from `min` to `max`, as dnd5e offers it; null for no limit, as anything but a spell
 * with levels, or one an item casts, always has.
 */
export type SheetEnchantProfile = {
  id: string
  name: string
  min: number | null
  max: number | null
}

/** An enchantment an enchant activity applied: on which item, its effect's id, and which way. */
export type SheetEnchantApplied = {
  item: string
  effect: string
  profile: string
}

/**
 * The check an activity asks for, such as Fast Hands' Sleight of Hand, Manacles' Bind or Maze's
 * Investigation: each way it may be made, in the order dnd5e's card offers them, its DC, and
 * whether it's the character's own to make. Module 0.21.0.
 */
export type SheetCheck = {
  /** One to ten, each skill, tool or ability once. */
  checks: SheetCheckOption[]
  /** Its DC, as dnd5e works it out; null for none. */
  dc: number | null
  /**
   * Whether the character makes it, and may roll it from here; false for a spell's, which another
   * creature makes, such as Maze's.
   */
  own: boolean
}

/**
 * One way a check an activity asks for may be made: an ability check, or a skill's or a tool's,
 * each with the ability it's made with, as dnd5e's card's button has it.
 */
export type SheetCheckOption = {
  type: 'check' | 'skill' | 'tool'
  /** dnd5e's id, such as "dex". */
  ability: string
  /** The skill's or tool's key, such as "slt" or "thief"; none for an ability check. */
  key?: string
  /**
   * For a tool check made with the tool the activity is of, the tool's own bonus, such as 1, which
   * dnd5e adds to it; absent for none.
   */
  bonus?: number
}

/**
 * What using an activity that uses another spends, as dnd5e's forward activity spends it, such as
 * a spell cast once a day without a slot. Module 0.21.0.
 */
export type SheetForward = {
  /**
   * How many uses it spends: 0 for none, as where it has nothing to spend, or the spell's activity
   * it's used through spends no slot; null for what the sheet can't count, such as a formula.
   */
  charges: number | null
  /** Fewer are left than it spends. */
  short: boolean
}

/**
 * One of an item's activities, for an item with more than one, such as Hex's Bonus Hex Damage or an
 * unarmed strike's Grapple/Shove: what it's called, its kind, and what it does, as an action does.
 * Module 0.14.0.
 */
export type SheetActivity = Pick<
  SheetAction,
  | 'activation'
  | 'activationType'
  | 'range'
  | 'target'
  | 'toHit'
  | 'attackId'
  | 'activity'
  | 'attackModes'
  | 'ammunition'
  | 'save'
  | 'damage'
  | 'consumesSlot'
  | 'cast'
  | 'rollFormula'
  | 'attackArea'
  | 'check'
  | 'forward'
  | 'uses'
  | 'elvenAccuracy'
> & {
  /** The activity's id. */
  id: string
  /** Such as "Bonus Hex Damage", or its kind's, such as "Attack". */
  name: string
  /** Such as "attack", "save", "cast" or "summon", which the app can't use. */
  type: string
  /**
   * For a Cast, the id of the copy of its spell the Spells tab lists under the item. Module
   * 0.17.0; absent before, and for a Cast whose spell dnd5e keeps no copy of.
   */
  spellId?: string | null
  /** How long what it does lasts, such as "1 Minute"; none for an instant. Module 0.17.0. */
  duration?: string | null
  /** For a reaction, what it's taken in answer to. Module 0.17.0. */
  trigger?: string | null
  /** Its own description's hash, which dnd5e 6 gives an activity. Module 0.17.0. */
  text?: string | null
}

/** Whom an activity is used at. */
export type SheetUseTargets = {
  /** Its user alone, as Second Wind or Shield. */
  self: boolean
  /** Everyone in an area, as Fireball. */
  area: boolean
  /** The most targets it takes, at its own level; null for no limit. */
  count: number | null
  /**
   * How many more it takes for each level it's cast above its own, as Bless; null for none. For a
   * spell an item casts, above the level it's cast at by default, its `cast.level`, from module
   * 0.20.0. Before, a Cast's own `activity` and `attackArea` always had null, and its copy's was
   * counted from the spell's own level: the same where the Cast is at that level, null above it.
   */
  perLevel: number | null
  /** dnd5e's kind of target, such as "ally", "enemy", "creature" or "willing"; null for none. */
  affects: string | null
  /**
   * Its range is Self, as a potion's or Wild Shape's, though it may take another target. Module
   * 0.22.0; absent before, when the action's `range` says so.
   */
  fromSelf?: boolean
}

/** A way a weapon attacks, such as "twoHanded", as dnd5e labels it, such as "Two-Handed". */
export type SheetAttackMode = { value: string; label: string }

/** Ammunition a weapon fires, by its item's id, with how much is left. */
export type SheetAmmunition = { id: string; name: string; quantity: number }

/**
 * What an action rolls, and what it's used through in the Gamemaster's game. Module 0.13.0 sends
 * them for the spells, features and inventory items that roll or are used through anything too.
 */
export type SheetRolls = Pick<
  SheetAction,
  | 'toHit'
  | 'attackId'
  | 'activity'
  | 'attackModes'
  | 'ammunition'
  | 'save'
  | 'damage'
  | 'consumesSlot'
  | 'cast'
  | 'spellId'
  | 'rollFormula'
  | 'attackArea'
  | 'check'
  | 'forward'
  | 'activities'
  | 'elvenAccuracy'
>

/** Actions taken with one kind of activation, such as Bonus Action. */
export type SheetActionSection = {
  id: string
  label: string
  actions: SheetAction[]
}

/** An item made a favorite. */
export type SheetItemFavorite = {
  type: 'item'
  /** The item's, as in inventory, spells, features and actions. */
  id: string
  /** Such as "weapon" or "spell". */
  itemType: string
  name: string
  img: string | null
}

/**
 * One of an item's activities made a favorite, such as a staff's Cast Fireball, with what it does
 * as an action has it, for that activity alone.
 */
export type SheetActivityFavorite = Pick<
  SheetAction,
  | 'activation'
  | 'activationType'
  | 'range'
  | 'target'
  | 'toHit'
  | 'attackId'
  | 'activity'
  | 'attackModes'
  | 'ammunition'
  | 'save'
  | 'damage'
  | 'consumesSlot'
  | 'cast'
  | 'spellId'
  | 'rollFormula'
  | 'attackArea'
  | 'check'
  | 'forward'
  | 'uses'
  | 'elvenAccuracy'
> & {
  type: 'activity'
  /** The activity's. */
  id: string
  /** The item's, as in inventory, spells, features and actions. */
  itemId: string
  itemType: string
  itemName: string
  name: string
  img: string | null
  /** How long what it does lasts, as an activity has it. Module 0.17.0. */
  duration?: SheetActivity['duration']
  /** For a reaction, what it's taken in answer to. Module 0.17.0. */
  trigger?: SheetActivity['trigger']
  /** Its own description's hash, under dnd5e 6. Module 0.17.0. */
  text?: SheetActivity['text']
}

/** An effect made a favorite. */
export type SheetEffectFavorite = {
  type: 'effect'
  /** As in effects. */
  id: string
  name: string
  img: string | null
  disabled: boolean
  /** Unavailable for now, as an unequipped item's effect is. */
  suppressed: boolean
}

/** A skill made a favorite. */
export type SheetSkillFavorite = {
  type: 'skill'
  /** As in skills, such as "prc". */
  id: string
  name: string
}

/** A tool made a favorite, with what rolling it takes, as a skill has, since it's nowhere else. */
export type SheetToolFavorite = {
  type: 'tool'
  /** Such as "thief". */
  id: string
  name: string
  /** The ability it's checked with, such as "dex". */
  ability: string | null
  total: number
  passive: number | null
  /** As a skill's: 0, 0.5, 1 or 2. */
  proficiency: number
  mode: RollMode
}

/**
 * A tool the character has, with what rolling it takes, as a skill has, for a check a description
 * asks for to be made with it. Module 0.18.0.
 */
export type SheetTool = Omit<SheetToolFavorite, 'type'>

/** A pool of spell slots made a favorite, with how many are left and the level they cast at. */
export type SheetSlotsFavorite = {
  type: 'slots'
  /** As in spells, such as "spell3" or "pact". */
  id: string
  name: string
  value: number
  max: number
  level: number | null
}

/** An old-style resource, which dnd5e lists first among the favorites, with its uses. */
export type SheetResourceFavorite = {
  type: 'resource'
  /** Such as "primary". */
  id: string
  name: string
  uses: SheetUses | null
  /**
   * The feature it stands for, by its id in `features` and `actions`, or null for none, as the
   * module finds it. Module 0.23.0; absent before, where the app finds it by name.
   */
  itemId?: string | null
}

/**
 * Something the player made a favorite, as dnd5e's sheet lists it under Favorites, and Tidy 5e in
 * its own; or an old-style resource, which they list there too. Each refers to what the sheet
 * lists elsewhere by the id it lists it by. Module 0.9.0.
 */
export type SheetFavorite =
  | SheetItemFavorite
  | SheetActivityFavorite
  | SheetEffectFavorite
  | SheetSkillFavorite
  | SheetToolFavorite
  | SheetSlotsFavorite
  | SheetResourceFavorite

/**
 * How a world rolls a critical hit's damage, as dnd5e's settings and any module that changes them,
 * such as Midi-QOL, make it, as the game finds it by building one: every die thrown `perDie` times,
 * such as twice, or once under Powerful Critical; the numbers added twice, where its rules double
 * them; under Powerful Critical, the most the dice could roll added too; and whether its rules
 * change the dice further, which only the game can then add up. Module 0.19.0.
 */
export type CriticalRule = {
  /** How many of each die it throws, such as 2, or 1 under Powerful Critical. */
  perDie: number
  /** As dnd5e's "Multiply Numeric Critical Damage": every number added twice. */
  multiplyNumeric: boolean
  /** As dnd5e's "Powerful Critical": the most its dice could roll added to them. */
  powerfulCritical: boolean
  /**
   * Its dice changed beyond being thrown `perDie` times, as Midi-QOL's rules that roll them at
   * their highest, double them or keep the highest of them do: what they come to is the game's to
   * say.
   */
  altered: boolean
  /**
   * How it throws the dice a critical hit adds to a part's first die, such as Savage Attacks' or
   * Brutal Critical's: thrown with it, after its dice are multiplied ("rolled"); not thrown, but
   * the most they could roll added as a number ("maximized"); or left out ("ignored"). Null, or
   * absent before module 0.20.0, where it can't say, and no additions with dice are taken.
   */
  bonusDice?: 'rolled' | 'maximized' | 'ignored' | null
}

export type CharacterSheet = {
  /** Relative to the game's address, or a full URL. */
  img: string | null
  level: number | null
  classes: SheetClass[]
  /**
   * The world's rules: the 2024 rules ("modern") or the 2014 rules ("legacy"). Module 0.16.0;
   * absent before.
   */
  rules?: 'modern' | 'legacy' | null
  /**
   * How the world rolls a critical hit's damage, for a description's: null where its rules add dice
   * of their own, such as Midi-QOL's that explode, or the game can't say. Module 0.19.0, which
   * takes a description's damage changed, and as a critical hit's; absent before, when it takes
   * neither.
   */
  critical?: CriticalRule | null
  species: string | null
  background: string | null
  /**
   * Its maximum is the one dnd5e shows and heals up to, with any temporary change to it, such as
   * Aid's, from module 0.17.0; before, the maximum without it.
   */
  hp?: { value: number; max: number | null; temp: number } | null
  ac: number | null
  proficiency: number | null
  initiative: number | null
  speed: { value: number; units: string | null } | null
  inspiration: boolean
  abilities: SheetAbility[]
  skills: SheetSkill[]
  /** The tools the character has. Module 0.18.0; absent before, when only favorites name them. */
  tools?: SheetTool[]
  conditions: SheetCondition[]
  /**
   * What the character concentrates on, each concentration dnd5e keeps, in its order, for its
   * player to end. Module 0.29.0; absent before.
   */
  concentration?: SheetConcentration
  features: SheetFeatureSection[]
  effects: SheetEffectSection[]
  inventory: SheetInventory
  spellcasting: SheetSpellcasting | null
  spells: SheetSpellSection[]
  traits: SheetTrait[]
  deathSaves: { success: number; failure: number } | null
  details: SheetDetails
  actions: SheetActionSection[]
  /** In the order dnd5e shows them: resources first, then in the player's order. */
  favorites: SheetFavorite[]
}

export type RollSummary = {
  formula: string
  total: number | null
  dice: {
    faces: number | null
    results: { result: number; active: boolean }[]
  }[]
  advantage?: boolean
  disadvantage?: boolean
  critical?: boolean
  fumble?: boolean
  damageType?: string
  /** The roll's class, such as "D20Roll" or "DamageRoll". */
  class?: string
  /** From module 0.28.0: a dnd5e damage roll, of a type or none. */
  damage?: true
  /** From module 0.28.0: its damage type's label, as the game words it. */
  damageLabel?: string
  /** From module 0.28.0: which of Midi-QOL's damage it is: its base, bonus or other damage. */
  section?: 'damage' | 'bonus' | 'other'
  /** From module 0.28.0: what Midi-QOL's bonus damage is called, such as "Sneak Attack". */
  flavor?: string
  /** From module 0.28.0: an attack roll, as dnd5e or Midi-QOL marked it. */
  attack?: true
}

export type Dnd5eMessageData = {
  messageType: string | null
  roll: {
    type?: string
    skillId?: string
    toolId?: string
    ability?: string
  } | null
  item: { name: string | null; type?: string | null } | null
  activity: { name: string | null; type: string | null } | null
  /** Armor class is sent only when the Gamemaster shares Gamemaster-only information. */
  targets: Dnd5eTarget[]
  /** For damage rolled from an attack's card: that attack's message. */
  originatingMessage?: string | null
  /**
   * For a save rolled from dnd5e's card for a save activity, from module 0.29.0: whose it is, and
   * whether it succeeded, where players see that in Foundry; from module 0.30.0, for a saving
   * throw from anywhere. Absent for any other message.
   */
  save?: Dnd5eSave
  /** The same for an ability, skill or tool check, from module 0.30.0. */
  check?: Dnd5eCheck
}

/**
 * Someone a message was aimed at: their name, their actor's uuid, and their armor class where the
 * Gamemaster shares Gamemaster-only information; and from module 0.29.0, where players see it in
 * Foundry, whether an attack hit them, and on Midi-QOL's card, whether they saved.
 */
export type Dnd5eTarget = {
  name: string
  ac?: number | null
  uuid?: string
  outcome?: 'hit' | 'miss'
  save?: 'success' | 'failure'
}

/**
 * A save rolled from dnd5e's card: its creature, by its actor's uuid, as the card names its
 * targets; whether it succeeded, where players see it; and where only the players of some of the
 * campaign's characters see it, as where only the card's author may, those characters' ids.
 */
export type Dnd5eSave = {
  target: string
  outcome?: 'success' | 'failure'
  readers?: string[]
}

/** A check, from module 0.30.0: its creature, whether it succeeded and who may know, as a save. */
export type Dnd5eCheck = Dnd5eSave

/**
 * The saving throw a roll request card asks the table for: one the Gamemaster posted from a
 * description, or one a player asked for from the app. Module 0.17.0; or the check one does, from
 * module 0.18.0.
 */
export type MessageAsk = MessageSaveAsk | MessageCheckAsk

/** A saving throw, or a concentration check, a roll request card asks the table for. */
export type MessageSaveAsk = {
  type: 'save' | 'concentration'
  /** dnd5e's ids, such as ["dex"]; for a concentration check, the one it names, if any. */
  abilities: string[]
  /** Its DC, only where players may see it. */
  dc?: number
  /** What asks for it, such as the player's item. */
  label?: string
}

/** A check a roll request card asks the table for, its buttons' ways to make it. Module 0.18.0. */
export type MessageCheckAsk = {
  type: 'check'
  checks: AskedCheck[]
  /** Its DC, only where players may see it. */
  dc?: number
  /** What asks for it, such as the player's item. */
  label?: string
}

/**
 * One way a check the table is asked for may be made, as its card's button has it: an ability
 * check, or a skill's or a tool's, each with the ability it's made with, as dnd5e's keys.
 */
export type AskedCheck = {
  type: 'check' | 'skill' | 'tool'
  ability: string
  /** For a skill check, the skill's key, such as "ath". */
  skill?: string
  /** For a tool check, the tool's key, such as "thief". */
  tool?: string
  /** For a tool check, the tool's name, as the game has it, such as "Thieves' Tools". */
  name?: string
}

export type SerializedMessage = {
  id: string
  type: string
  timestamp: number
  speaker: { alias: string | null; actorId: string | null }
  author: { id: string; name: string } | null
  // The connected character's actor id if one spoke it.
  character: string | null
  title: string | null
  flavor: string
  text: string
  audience: { public: boolean; characters: string[] }
  rolls: RollSummary[]
  dnd5e: Dnd5eMessageData | null
  /** The message's HTML, as Foundry holds it: read, never shown. */
  content?: string
  /**
   * The saving throw it asks the table for, if it's a roll request card; null for any other
   * message. Module 0.17.0; absent before. The check one asks for, from module 0.18.0.
   */
  ask?: MessageAsk | null
  /**
   * The roll it says the campaign's Gamemaster made here as a character, by its id: a claim its
   * author could write, which only marks the message once checked against the rolls handed over.
   * Module 0.23.0.
   */
  gmRoll?: string
}

export type CombatantSummary = {
  id: string
  name: string
  initiative: number | null
  defeated: boolean
  // The connected character's actor id, or null.
  character: string | null
  playerOwned: boolean
  /** As a sheet's: with any temporary change to the maximum, from module 0.17.0. */
  hp?: { value: number; max: number | null; temp: number } | null
  // Present only when the Gamemaster sends Gamemaster-only information.
  hidden?: boolean
  /**
   * How its token is disposed to the party in the game, from module 0.29.0: null for one whose
   * disposition players aren't shown, such as a secret or hidden token, or one with no token.
   */
  disposition?: 'friendly' | 'neutral' | 'hostile' | null
}

export type CombatSnapshot = {
  id: string
  name: string | null
  active: boolean
  started: boolean
  round: number
  combatantId: string | null
  combatants: CombatantSummary[]
}

/**
 * What the module does for a campaign beyond sending its events, from its hello. Module 0.10.0.
 */
export type BridgeFeatures = {
  /**
   * Whether its players may roll in the game from here, which rolls, and if not, why not; and
   * whether they may change their damage there, from module 0.13.0.
   */
  rolls?: {
    enabled: boolean
    kinds: string[]
    reason: string | null
    modifiers?: boolean
    /** Whether its players are asked here for the saves their game asks of them. Module 0.13.0. */
    prompts?: boolean
    /** Whether an area attack is made at the combatants its player picks. Module 0.16.0. */
    areaAttacks?: boolean
    /**
     * Whether a check an activity asks for, the player's own, is made against it, as its card's
     * button makes it, under dnd5e 5. Module 0.21.0.
     */
    activityChecks?: boolean
    /**
     * Whether more dice and another die change only a die damage adds, never one it takes away,
     * which its previews mark. Module 0.21.0.
     */
    signedDice?: boolean
    /** Whether a use may be made at its user, as `self` on its request asks. Module 0.22.0. */
    selfTargets?: boolean
    /**
     * Whether a roll may say it's the campaign's Gamemaster's, `by: "gm"`, made as the character
     * and marked as theirs. Module 0.23.0.
     */
    gmRolls?: boolean
    /**
     * Whether the result of each of the Gamemaster's rolls lists the chat messages it made, as
     * `messages`, wherever `gmRolls` is true. Module 0.25.0.
     */
    gmRollMessages?: boolean
    /**
     * Whether players may enter their own dice's results: where the campaign lets them, the Manual
     * Dice module is on, and players' rolls are enabled; each character's player may where its
     * own `manualDice` says so too. Module 0.26.0.
     */
    manualDice?: boolean
    /**
     * Whether what Midi-QOL asks of the campaign's characters is asked here too, while they're open
     * in the app: where the game asks players for saves, and Midi-QOL is one the module can wait
     * on. Told to the app only; nothing turns on it yet. Module 0.27.0.
     */
    midiPrompts?: boolean
  } | null
  /**
   * Whether its players may move items and coins from here, apart from the rolls: on, with
   * `"transfer"` among its kinds, or off, and why, `"off"` or `"system"`. Module 0.31.0.
   */
  transfers?: {
    enabled: boolean
    kinds: string[]
    reason: string | null
    /**
     * From module 0.32.0: whether a party's Owner may send its items and coins elsewhere, and share
     * its coin among its characters.
     */
    partySends?: boolean
    distribute?: boolean
  } | null
  /**
   * Whether the module removes characters' items for the app, `"remove"` among its kinds; or not,
   * and why, `"system"`. Module 0.33.0.
   */
  removals?: { enabled: boolean; kinds: string[]; reason: string | null } | null
  /**
   * Whether the module keeps journal notes for the app, under any system, `"personal"` and
   * `"party"` among its kinds; and which of the campaign's characters and parties have a journal of
   * them in Foundry for this campaign. Module 0.34.0.
   */
  notes?: {
    enabled: boolean
    kinds: string[]
    reason: string | null
    journals: { kind: NoteBookKind; actorId: string }[]
  } | null
}

/**
 * A character's or a party's journal of notes as Foundry holds it, whole, for one campaign: none
 * where it has no journal, or why it isn't sent. Module 0.34.0.
 */
export type JournalUpdated = {
  kind: NoteBookKind
  /** The character's actor, or the party's Group actor. */
  actorId: string
  journal: { id: string; name: string; notes: JournalPage[] } | null
  withheld?:
    { reason: 'private' } | { reason: 'tooLarge'; bytes: number; limit: number }
}

/** One of a journal's notes as Foundry holds it: a chapter or an entry, by its page's id. */
export type JournalPage = {
  id: string
  role: NoteRole
  /** An entry's chapter, by its page's id; null for none, and for a chapter. */
  chapter: string | null
  title: string
  /** 2 for Markdown; 1 for HTML, from Foundry's own editor or for a party's secret. */
  format: 1 | 2
  markdown?: string
  html?: string
  /** The title or the text was cut short. */
  cut?: true
  /** A party's page sent as HTML for a secret its Markdown holds. */
  secret?: true
  /** When it was written, and last changed, in milliseconds. */
  createdAt: number
  modifiedAt: number
  modifiedBy: string
  modifiedIn: 'app' | 'foundry'
  /** Who wrote it from the app; none for one written in Foundry. */
  author: { actorId: string | null; gm: boolean; name: string } | null
  /** Its revision, 14 hexadecimal digits. */
  rev: string
}

/**
 * A saving throw the game asks of one of a campaign's characters, which its player rolls here,
 * such as a concentration check after damage. Module 0.13.0. From module 0.27.0, also what
 * Midi-QOL asks of a character while it's open in the app, which says where it comes from: a save,
 * or an ability or skill check, which Midi-QOL rolls itself once its time is up.
 */
export type GamePrompt = {
  /** Its chat card's id and its character's, joined by "-"; or for Midi-QOL's, a key's. */
  id: string
  actorId: string
  /** The chat card that asks; for Midi-QOL's, its workflow's card, where it has one. */
  messageId: string
  /** What it asks for: an ability or skill check only where Midi-QOL asks. */
  type: 'save' | 'concentration' | 'check' | 'skill'
  /**
   * The abilities it may be rolled with, such as ["dex"]; one for a concentration check; none for
   * a skill check.
   */
  abilities: string[]
  /** For a skill check, the skills it may be rolled with, such as ["ath", "acr"]. */
  skills?: string[]
  /** Its DC, where the player may see it. */
  dc: number | null
  /** What asks: a spell or feature, or what the character is concentrating on. */
  label: string | null
  openedAt: string
  /** When it stops waiting for its player. */
  expiresAt: string
  /** Where Midi-QOL asks it from; unset for what a chat card asks. */
  source?: PromptSource
  /**
   * How Midi-QOL has each choice rolled, by its key: with advantage or disadvantage, or else
   * normally. The player has no say.
   */
  advantage?: Partial<Record<string, 'adv' | 'dis'>>
  /** Whether Foundry asks the player too, where Midi-QOL leaves the question to it at the end. */
  askedInFoundry?: boolean
}

/** Where Midi-QOL asks what it asks of a character from. Module 0.27.0. */
export type PromptSource = (typeof PROMPT_SOURCES)[number]

/** What became of a command the module fetched, such as a player's roll. Module 0.10.0. */
export type CommandResult = {
  id: string
  status: 'done' | 'failed'
  /** Why it failed, such as "off" or "not-dying". */
  reason: string | null
  error: string | null
  /** The chat message the roll made. */
  messageId: string | null
  /** Whether the roll's player may see it; false for one the game made blind. */
  visible: boolean
  /**
   * The roll as the game made it, when its player may see it; for hit dice, every roll of every
   * card they made, in order.
   */
  rolls: RollSummary[]
  /** For an attack, what came of it, when its player may see it. Module 0.11.0. */
  attack?: AttackOutcome | null
  /** For a use, the kind of activity used. Module 0.12.0. */
  use?: UseOutcome | null
  /**
   * For an attack or a use, the dice its damage or healing will throw; null when none follows.
   * Module 0.11.0.
   */
  damage?: DamagePreview | null
  /**
   * For a save the game asked for, whether it succeeded, where its player may know. Module
   * 0.13.0.
   */
  outcome?: SaveOutcome | null
  /**
   * For a hit die or hit dice, the hit points they gave back, no more than were missing. Module
   * 0.16.0; for hit dice, 0.20.0.
   */
  healed?: number | null
  /**
   * For hit dice, how many were asked for, and how many the game made, a card each, once they
   * passed its checks: all of them, or those made before it stopped. Module 0.20.0.
   */
  spent?: { count: number; made: number } | null
  /**
   * For a use of an enchant activity, or an enchantment ended, the enchantment it applied and the
   * one it ended, if any; null where it applied and ended none. Module 0.21.0.
   */
  enchantment?: EnchantmentOutcome | null
  /**
   * For the Gamemaster's roll as a character, the chat messages it made, by their Foundry ids, in
   * the order made, as many as 20: those the module marks as theirs. Module 0.25.0; never on a
   * player's roll.
   */
  messages?: string[]
  /**
   * For a move of items and coins, what moved, by ids and counts alone: everything, when it was
   * made, or the parts made before it failed. Module 0.31.0.
   */
  transfer?: TransferMoved
  /**
   * For an item removed from the character, it and how many of its stack, by id and count alone:
   * when it was made, or where it failed after the item itself changed. Module 0.33.0.
   */
  removed?: RemovedItem
  /**
   * For a note command, the note and its page's revision now: none for a delete, which says so,
   * or where the page is hidden from the app. Module 0.34.0.
   */
  note?: { id: string; rev: string | null; deleted?: true }
}

/**
 * What an enchant activity did to the character's items: the enchantment it applied, such as
 * Magic Weapon, +1 on a longsword, and the one it ended, such as the one it replaced, or a Flame
 * Tongue's put out; either null for none.
 */
export type EnchantmentOutcome = {
  enchanted: {
    item: string
    /** The item's own name, not as the enchantment renames it. */
    itemName: string
    effect: string
    profile: string
    name: string
  } | null
  ended: {
    item: string
    itemName: string
    effect: string
    name: string
  } | null
}

/** Whether a saving throw succeeded against its DC. */
export type SaveOutcome = 'success' | 'failure'

/** A spell or feature used in the game: the kind of activity it was. */
export type UseOutcome = { type: string }

/**
 * What came of an attack made in the game: a critical hit or a fumble, and whether it hit its
 * target, where the game shows players that; never the target's armor class.
 */
export type AttackOutcome = {
  critical: boolean
  fumble: boolean
  outcome: 'hit' | 'miss' | null
  /**
   * For an area attack, whether it hit each combatant picked, where the game shows players that.
   * Module 0.16.0.
   */
  targets?: AttackTargetOutcome[]
}

/** Whether an area attack hit one of the combatants it was made at. */
export type AttackTargetOutcome = {
  combatId: string
  combatantId: string
  outcome: 'hit' | 'miss' | null
}

/**
 * The dice an attack's or a use's damage or healing will throw in the game, as the game will make
 * up its rolls, with a critical hit's dice: for the player to roll them. None when the game can't
 * say beforehand, as for a d3, and then rolls them all itself.
 */
export type DamagePreview = {
  critical: boolean
  plannable: boolean
  /** Healing, rather than damage. Module 0.12.0. */
  healing?: boolean
  rolls: DamagePreviewRoll[]
}

/** One of damage's rolls, as the game will roll it. */
export type DamagePreviewRoll = {
  /** As the game will roll it, such as "2d8 + 3". */
  formula: string
  /** Such as "Slashing"; null for none. */
  type: string | null
  /**
   * The kinds of damage its roller chooses among, as Chromatic Orb's, by key and label; null or
   * absent for none. Module 0.12.0.
   */
  types?: DamageTypeChoice[] | null
  /**
   * Each kind of die it throws, in order. From module 0.20.0, those of the critical damage a
   * critical hit adds, such as a weapon's, are marked `added`: they are never its first die. From
   * module 0.21.0, those the damage takes away, as Reduce's −1d4, are marked `subtracted`: never
   * its first die. Either mark may be on a die with the other.
   */
  dice: { faces: number; number: number; added?: true; subtracted?: true }[]
  /**
   * How many dice it throws for each die of its own: 1, or on a critical hit as many as the
   * world's rules make of each, such as 2. Module 0.13.0; absent before, as 1.
   */
  perDie?: number
}

/** A kind of damage to choose, such as { key: "fire", label: "Fire" }. */
export type DamageTypeChoice = { key: string; label: string }

/** An event this app acts on, with its payload checked. */
export type GameEvent =
  | {
      type: 'bridge.hello'
      data: {
        characters: ConnectedCharacter[]
        /** The campaign's Group actors, without their sheets, which follow it. Module 0.30.0. */
        groups?: GroupEntry[]
        combats: CombatSnapshot[]
        features?: BridgeFeatures | null
        /** The saves the game is asking its players for. Module 0.13.0. */
        prompts?: GamePrompt[]
        /**
         * Its characters carry no sheets, which follow it, each in a post of its own. Module
         * 0.22.0.
         */
        sheetsApart?: boolean
        /** Sending Stone's id and version in Foundry. */
        module?: { id: string; version: string | null }
        foundry?: { version: string; generation?: number | null }
        system?: { id: string; title: string; version: string }
        /** The Foundry settings that decide what it sends, for the Gamemaster. Module 0.30.0. */
        settings?: FoundrySettings
      }
    }
  | { type: 'character.updated'; data: { character: ConnectedCharacter } }
  | { type: 'character.texts'; data: { texts: Record<string, string> } }
  | {
      type: 'chat.message.created' | 'chat.message.updated'
      data: { message: SerializedMessage }
    }
  | { type: 'chat.message.deleted'; data: { id: string } }
  | { type: 'chat.cleared'; data: Record<string, never> }
  | {
      type:
        | 'combat.created'
        | 'combat.started'
        | 'combat.turn'
        | 'combat.updated'
        | 'combat.ended'
      data: { combat: CombatSnapshot }
    }
  | {
      type: 'combat.combatant.added' | 'combat.combatant.updated'
      data: { combatId: string; combatant: CombatantSummary }
    }
  | {
      type: 'combat.combatant.removed'
      data: { combatId: string; combatantId: string }
    }
  | { type: 'command.result'; data: CommandResult }
  | { type: 'roll.prompt.opened'; data: { prompt: GamePrompt } }
  | { type: 'roll.prompt.closed'; data: { id: string; reason: string } }
  | {
      type: 'group.updated'
      data: {
        group: GroupEntry & {
          sheet: GroupSheet | null
          sheetWithheld?: SheetWithheld
        }
      }
    }
  | { type: 'group.removed'; data: { id: string } }
  | { type: 'bridge.settings'; data: { settings?: FoundrySettings } }
  | { type: 'journal.updated'; data: JournalUpdated }
