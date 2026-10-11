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
  /** The character's sheet under dnd5e; null under another system, or from modules before 0.5.0. */
  sheet?: CharacterSheet | null
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

export type SheetUses = {
  /** Uses left. */
  value: number
  max: number
  /** When they come back, such as "Short Rest, Long Rest". */
  recovery: string | null
}

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
  text: string | null
} & SheetUsage

export type SheetContainer = SheetItem & {
  /** How full it is, by count or weight; null without a limit, or when its contents are secret. */
  capacity: { value: number; max: number; units: string } | null
  /** Null when its contents are secret. */
  contents: (SheetItem | SheetContainer)[] | null
}

export type SheetInventory = {
  /** Items by type, in dnd5e's order, leaving out those in containers. */
  sections: { id: string; label: string; items: SheetItem[] }[]
  containers: SheetContainer[]
  currency: { id: string; label: string; abbreviation: string; value: number }[]
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
   * 0.14.0; absent otherwise.
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
  uses: SheetUses | null
  /** A spell's level, 0 for a cantrip; null for anything else. */
  level: number | null
  /** For a spell, the item it's cast from, such as a wand; null or absent for anything else. */
  castFrom?: SheetCastFrom | null
  concentration: boolean
  /** False for an item not identified yet, which keeps its secrets. */
  identified: boolean
  text: string | null
}

/**
 * How a spell an item casts is cast, such as a staff's Silvery Barbs: at what level, whether it
 * takes concentration, how many of the item's uses it spends, if any, and whether that many are
 * left; and, where the item is listed for it, the spell's description.
 */
export type SheetCast = {
  level: number
  concentration: boolean
  /** How many of the item's uses, or the activity's own, it spends; null for none, or a formula. */
  charges: number | null
  /** Fewer are left than it spends. */
  short: boolean
  /** The spell's description's hash. */
  text?: string | null
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
  type: 'save' | 'damage' | 'heal' | 'utility'
  targets: SheetUseTargets
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
  | 'uses'
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
  /** How many more it takes for each level it's cast above its own, as Bless; null for none. */
  perLevel: number | null
  /** dnd5e's kind of target, such as "ally", "enemy", "creature" or "willing"; null for none. */
  affects: string | null
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
  | 'activities'
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
  | 'uses'
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
  targets: { name: string; ac?: number | null }[]
  /** For damage rolled from an attack's card: that attack's message. */
  originatingMessage?: string | null
}

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
  } | null
}

/**
 * A saving throw the game asks of one of a campaign's characters, which its player rolls here,
 * such as a concentration check after damage. Module 0.13.0.
 */
export type GamePrompt = {
  /** Its chat card's id and its character's, joined by "-". */
  id: string
  actorId: string
  /** The chat card that asks. */
  messageId: string
  type: 'save' | 'concentration'
  /** The abilities it may be rolled with, such as ["dex"]; one for a concentration check. */
  abilities: string[]
  /** Its DC, where the player may see it. */
  dc: number | null
  /** What asks: a spell or feature, or what the character is concentrating on. */
  label: string | null
  openedAt: string
  /** When it stops waiting for its player. */
  expiresAt: string
}

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
  /** The roll as the game made it, when its player may see it. */
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
  /** For a hit die, the hit points it gave back, no more than were missing. Module 0.16.0. */
  healed?: number | null
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
  dice: { faces: number; number: number }[]
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
        combats: CombatSnapshot[]
        features?: BridgeFeatures | null
        /** The saves the game is asking its players for. Module 0.13.0. */
        prompts?: GamePrompt[]
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
