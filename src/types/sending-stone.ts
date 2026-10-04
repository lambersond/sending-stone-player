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
  item: { name: string | null } | null
  activity: { name: string | null; type: string | null } | null
  targets: { name: string }[]
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
