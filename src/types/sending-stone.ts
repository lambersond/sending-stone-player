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
}

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
  text: string | null
}

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
export type SheetCastFrom = { id: string; name: string }

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
}

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
  range: string | null
  target: string | null
  /** The bonus to hit, for an action that attacks. */
  toHit: number | null
  /** The saving throw it calls for: the ability's abbreviation, such as "DEX", and the DC. */
  save: { ability: string; dc: number | null } | null
  damage: SheetDamage[]
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
  'activation' | 'range' | 'target' | 'toHit' | 'save' | 'damage' | 'uses'
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

export type CharacterSheet = {
  /** Relative to the game's address, or a full URL. */
  img: string | null
  level: number | null
  classes: SheetClass[]
  species: string | null
  background: string | null
  hp?: { value: number; max: number | null; temp: number } | null
  ac: number | null
  proficiency: number | null
  initiative: number | null
  speed: { value: number; units: string | null } | null
  inspiration: boolean
  abilities: SheetAbility[]
  skills: SheetSkill[]
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
}

export type CombatantSummary = {
  id: string
  name: string
  initiative: number | null
  defeated: boolean
  // The connected character's actor id, or null.
  character: string | null
  playerOwned: boolean
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

/** An event this app acts on, with its payload checked. */
export type GameEvent =
  | {
      type: 'bridge.hello'
      data: { characters: ConnectedCharacter[]; combats: CombatSnapshot[] }
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
