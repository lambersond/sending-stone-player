import type { TableGroup } from '@/types/party'
import type { EndedTurn, GmRollView, RollFeature, RollKind } from '@/types/roll'
import type {
  AskedCheck,
  CharacterSheet,
  PromptSource,
  SheetWithheld,
} from '@/types/sending-stone'

/**
 * What a player is shown of their campaign: their view of its chat log and combat tracker, and
 * their character's sheet. Built on the server from what the Gamemaster's module sent, with what
 * this player may not see left out.
 */

/** Whose side something is on, from this player's point of view. */
export type Side = 'me' | 'party' | 'other'

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

/** What a combat roll or card is, for highlighting it. */
export type TableAction =
  'attack' | 'spell-attack' | 'damage' | 'healing' | 'spell'

export type TableTarget = {
  name: string
  /** Only when the Gamemaster shares Gamemaster-only information. */
  ac?: number
  /**
   * For an attack, whether it hit them: as the module says, from 0.29.0, where players see it in
   * Foundry; or else, where their armor class is known, as the attack's total met it.
   */
  outcome?: 'hit' | 'miss'
  /**
   * For a spell's saving throw, whether they saved, where players see it in Foundry, from module
   * 0.29.0: as Midi-QOL's card says, or as their own save rolled from dnd5e's card came out.
   */
  save?: 'saved' | 'failed'
  /**
   * For their own ability, skill or tool check, whether it succeeded, where players see it in
   * Foundry, from module 0.30.0.
   */
  check?: 'success' | 'failure'
}

export type TableMessage = {
  id: string
  sentAt: string
  speaker: string
  /** The speaker's portrait, when they are one of the campaign's characters and have one. */
  avatar?: string
  side: Side
  whisper: boolean
  /**
   * text: something said, or a roll request card, with a line of text for pages that don't read
   * its ask; roll: one or more rolls; card: an item or ability used.
   */
  kind: 'text' | 'roll' | 'card'
  /** What the message is about, such as "Longsword" or "Perception check". */
  label?: string
  /**
   * Set for an attack, damage, healing or a spell, from what D&D Fifth Edition recorded of the
   * whole message. Drawn only on a card; a roll's card and a damage card each carry their own.
   */
  action?: TableAction
  text?: string
  /** The rolls drawn on cards of their own, in the message's order: every roll but its damage. */
  rolls: TableRoll[]
  /** The attack among `rolls`, by its index there, and its chip. */
  attackRoll?: { index: number; action: 'attack' | 'spell-attack' }
  /**
   * The message's damage, folded into a card: its main damage, then Midi-QOL's other damage,
   * either left out where it has none. Absent when the message has no damage.
   */
  damage?: TableDamage[]
  targets: TableTarget[]
  /**
   * How it went, over more than one target, counting only those with a result: such as "Hit 2 of
   * 3" or "3 of 8 saved", or both, joined by " · ". Absent where no target has one.
   */
  summary?: string
  /** For a roll request card, the saving throw or check it asks the table for. */
  ask?: TableAsk
  /** Made for a roll the campaign's Gamemaster made here as a character, as this app knows. */
  byGm?: true
  /** A damage or healing card made on its own, for the Gamemaster to apply (module 0.36.0). */
  alone?: true
}

/**
 * What a kind of damage takes or fills: hit points, or one of healing's pools; 'none' isn't
 * counted.
 */
export type DamagePool = 'harm' | 'healing' | 'temphp' | 'maximum' | 'none'

export type TableDamageKind = {
  /** dnd5e's key, such as "piercing"; absent for damage of no type. */
  type?: string
  /**
   * The chip's word, such as "Piercing", "Temp HP" or "No damage"; absent for damage of no type.
   */
  label?: string
  /** Its rolls' totals added, at least 0; null when any is unknown. */
  total: number | null
  pool: DamagePool
}

export type TableDamageRoll = {
  formula: string
  /** As rolled: may be below 0. */
  total: number | null
  dice: TableRoll['dice']
  /** Its kind's word; absent for damage of no type. */
  label?: string
  /** Midi-QOL's bonus damage: its flavor, or "Bonus". */
  tag?: string
}

/** A message's damage rolls folded into one card, as dnd5e's damage card adds them up. */
export type TableDamage = {
  section: 'main' | 'other'
  action: 'damage' | 'healing'
  /** Its rolls' formulas, kind by kind, joined. */
  formula: string
  kinds: TableDamageKind[]
  /** Absent: no big total (mixed pools, or nothing counted). null: unknown ("–"). */
  total?: number | null
  critical: boolean
  /** Main card only: what a creature that saves takes, as dnd5e's damage card says. */
  onSave?: 'half' | 'none' | 'full'
  /** Every roll of the card, in roll order. */
  rolls: TableDamageRoll[]
}

/**
 * The saving throw a roll request card in the chat asks the table for, such as "DC 15 Dexterity
 * saving throw", or the check, such as "DC 15 Strength (Athletics) check", from a description: by
 * the Gamemaster, or by a player from the app, naming what asks for it.
 */
export type TableAsk = TableSaveAsk | TableCheckAsk

/** A saving throw, or a concentration check, the table is asked for. */
export type TableSaveAsk = {
  type: 'save' | 'concentration'
  /** The abilities it may be rolled with, such as ["dex"]; for concentration, the one it names. */
  abilities: string[]
  /** Unset where players may not see it. */
  dc?: number
  /** What asks for it, such as "Worn Bardic Eternal Flame". */
  label?: string
}

/** A check the table is asked for, in one way or more, such as Strength (Athletics). */
export type TableCheckAsk = {
  type: 'check'
  checks: AskedCheck[]
  /** Unset where players may not see it. */
  dc?: number
  /** What asks for it, such as "Cloak of Climbing". */
  label?: string
}

export type TableCombatant = {
  id: string
  name: string
  initiative: number | null
  defeated: boolean
  side: Side
  /**
   * For one not of the party, how the game has its token disposed, from module 0.29.0: an ally,
   * as a hireling the Gamemaster marked Friendly, or neutral. Unset for the rest, and for the
   * party, who are allies whatever their token says.
   */
  stance?: 'ally' | 'neutral'
  /** Only for the party; a creature's hit points stay with the Gamemaster. */
  hp?: { value: number; max: number | null; temp: number }
  /**
   * One of the viewer's own creatures, other than the one they're at: their character, or a
   * companion of it.
   */
  yours?: true
  /** For one of the viewer's character's companions, its key, for its tab. */
  companion?: string
}

export type TableCombat = {
  id: string
  name: string | null
  started: boolean
  round: number
  /** Whose turn it is. Unset before the start, or while a hidden combatant acts. */
  currentId?: string
  combatants: TableCombatant[]
}

/**
 * A turn the seat may end from the table (module 0.36.0): its character's, or one of its
 * companions', as the page last saw the combat.
 */
export type EndableTurn = EndedTurn & {
  /**
   * For one of its companions' turns: its key and name, for words such as "Ending Brakka’s turn".
   */
  companion?: { key: string; name: string }
}

/**
 * A saving throw the Gamemaster's game asks of the player's character, to roll here: such as a
 * concentration check after damage, or a save a spell targeting them calls for; or from module
 * 0.27.0, what Midi-QOL asks of them, which may be an ability or skill check, and which it rolls
 * itself once its time is up.
 */
export type TablePrompt = {
  id: string
  type: 'save' | 'concentration' | 'check' | 'skill'
  /**
   * The abilities it may be rolled with, such as ["dex"]; one for a concentration check; none for
   * a skill check.
   */
  abilities: string[]
  /** For a skill check, the skills it may be rolled with, such as ["ath", "acr"]. */
  skills?: string[]
  /** Unset where the game doesn't show the player its DC. */
  dc?: number
  /** What asks, such as "Fireball", or what the character is concentrating on. */
  label?: string
  /** When it stops waiting. */
  expiresAt: string
  /** Where Midi-QOL asks it from; unset for what a chat card asks. */
  source?: PromptSource
  /** How Midi-QOL has each choice rolled, by its key, where not normally. */
  advantage?: Partial<Record<string, 'adv' | 'dis'>>
  /** Where Foundry asks the player too, and is left to once its time is up. */
  askedInFoundry?: true
  /**
   * For one Midi-QOL asked that closed just now, how, for its player to be told: rolled in Foundry
   * first, or its time ran out, so Midi-QOL rolled it, or left it to Foundry.
   */
  closed?: PromptNotice
}

/** How a prompt Midi-QOL asked closed, where its player is told. */
export type PromptNotice = 'rolled' | 'expired'

/** The player's own character's sheet, to see and roll from. */
export type TableSheet = Omit<CharacterSheet, 'img'> & {
  /** The portrait's full address. Unset when it has none, or only Foundry's default. */
  portrait?: string
}

export type TableView = {
  /** The campaign's version when this was built. Unchanged means nothing new. */
  version: number
  /** Is the Gamemaster's game sending? */
  live: boolean
  /** Unset while the character is in no campaign. */
  campaign?: { title: string; worldTitle?: string; lastSeenAt?: string }
  /** Is this character still one of its campaign's characters? */
  connected: boolean
  messages: TableMessage[]
  combat?: TableCombat
  /**
   * Unset under a system other than dnd5e, or until the module sends it; and when the viewer
   * already has the sheet of this `sheetVersion`, which is left out to save sending it again.
   */
  sheet?: TableSheet
  /** Changes whenever the sheet does. Unset when there is no sheet. */
  sheetVersion?: string
  /**
   * Why the module held the character's sheet back, such as for being too large to send, with its
   * size and the limit. Unset otherwise. Module 0.22.0.
   */
  sheetWithheld?: SheetWithheld
  /** How far the player has read the chat, on any device: later messages are unread. */
  chatReadAt?: string
  /**
   * The rolls the player can have made in the Gamemaster's game from here, with the dice they
   * roll: none unless the Gamemaster lets them, and the game is fetching them.
   */
  rollsToTable?: RollKind[]
  /** What else the game can do with them, such as take damage the player changed. */
  rollFeatures?: RollFeature[]
  /** The saving throws the game is asking of the character, oldest first, while it takes them. */
  prompts?: TablePrompt[]
  /**
   * For the Gamemaster's view of a character only (#156): whether what they roll here is made in
   * their game (`made`), stays here until its module is updated (`update`), or stays here while
   * it takes no rolls (`off`).
   */
  gm?: { rolls: GmRolls }
  /**
   * For the player's view only (#156): the rolls their campaign's Gamemaster made as their
   * character lately, newest first, as many as `GM_ROLLS_SHOWN`; with what changes whenever any of
   * them does, which the page sends back as it polls. Unset where there are none.
   */
  gmRolls?: GmRollView[]
  gmRollsKey?: string
  /**
   * The campaign's groups this seat may open, such as its party, primary first, from module
   * 0.30.0: for a player, those their Foundry user may see; for the Gamemaster, every one. Unset
   * for none.
   */
  groups?: TableGroup[]
  /**
   * The seat's character's companions, as the module lists them, for their tabs. Module 0.36.0;
   * unset for none.
   */
  companions?: TableCompanion[]
  /**
   * Where the seat may move the character's items and coins to, from module 0.31.0: set only while
   * the campaign lets them be moved, its game is taking moves, and the character is in its roster.
   */
  moves?: TableMoves
  /**
   * From module 0.33.0: whether the seat may remove the character's items, its player's or the
   * Gamemaster's at its page: set only while the game removes them, its module is fetching, and the
   * character is in its roster.
   */
  removes?: true
  /**
   * For the player's seat only, from module 0.32.0: whether they may type in their own dice for
   * this character here, and whether they chose to. Unset for the Gamemaster's seat.
   */
  manualDice?: { offered: boolean; on: boolean }
}

/** Where a seat may move its character's items and coins to. Never anyone's access. */
export type TableMoves = {
  /**
   * Where the seat may give: a player's parties they own in Foundry; the Gamemaster's, every one
   * listed.
   */
  parties: TableGroup[]
  /** The campaign's other characters, in its roster's order. */
  characters: { id: string; name: string; portrait?: string }[]
}

/** Where the Gamemaster's rolls as a character go, as their view of it says. */
export type GmRolls = 'made' | 'update' | 'off'

/** One of the seat's character's companions, for its tab beside the character (module 0.36.0). */
export type TableCompanion = {
  key: string
  name: string
  portrait?: string
  kind: 'owned' | 'summoned'
  /** For a summoned one, the item it was summoned with, such as "Find Familiar". */
  from?: string
}

/**
 * What the creature view says of whose a creature is: a companion now; a wild-shaped form later.
 */
export type CreatureRelation =
  | { kind: 'owned'; of: string }
  | { kind: 'summoned'; of: string; from?: string }

/** A creature's pane's facts (module 0.36.0): its name, and whose it is. */
export type CreatureFacts = { name: string; relation: CreatureRelation }

/**
 * A companion's own view, for its pane to poll (module 0.36.0): its sheet, the encounter seen from
 * it, and the rolls it can have made. Its chat is its character's.
 */
export type CompanionView = {
  version: number
  live: boolean
  /** It's still one of the seat's character's companions, as the module last listed them. */
  connected: boolean
  companion?: TableCompanion
  sheet?: TableSheet
  sheetVersion?: string
  sheetWithheld?: SheetWithheld
  combat?: TableCombat
  rollsToTable?: RollKind[]
  rollFeatures?: RollFeature[]
  gm?: { rolls: GmRolls }
  gmRolls?: GmRollView[]
  gmRollsKey?: string
  /** Its character's: the companion's dice are typed in as the character's are. */
  manualDice?: { offered: boolean; on: boolean }
  /**
   * How it enters initiative, as its campaign's Gamemaster sets it in Foundry (module 0.36.0): its
   * own roll, or right after its character. `after` names that character while it's in the combat
   * shown: its initiative is then the game's to set, and nothing is rolled for it here.
   */
  initiative: { mode: 'own' | 'after'; after?: string }
}
