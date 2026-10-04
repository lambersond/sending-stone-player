/**
 * What a player is shown of their campaign: their view of its chat log and combat tracker. Built
 * on the server from what the Gamemaster's module sent, with what this player may not see left out.
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

export type TableMessage = {
  id: string
  sentAt: string
  speaker: string
  side: Side
  whisper: boolean
  /** text: something said; roll: one or more rolls; card: an item or ability used. */
  kind: 'text' | 'roll' | 'card'
  /** What the message is about, such as "Longsword · Attack" or "Perception check". */
  label?: string
  text?: string
  rolls: TableRoll[]
  targets: string[]
}

export type TableCombatant = {
  id: string
  name: string
  initiative: number | null
  defeated: boolean
  side: Side
  /** Only for the party; a creature's hit points stay with the Gamemaster. */
  hp?: { value: number; max: number | null; temp: number }
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

export type TableView = {
  /** The campaign's version when this was built. Unchanged means nothing new. */
  version: number
  /** Unset until the character's campaign has been sent anything. */
  campaign?: { title: string; worldTitle?: string; lastEventAt?: string }
  /** Is this character one of its campaign's characters? */
  connected: boolean
  messages: TableMessage[]
  combat?: TableCombat
}
