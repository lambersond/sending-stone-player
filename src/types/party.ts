import type { SheetInventory, SheetWithheld } from '@/types/sending-stone'
import type { TableMoves } from '@/types/table'

/*
 * A campaign's Group actors, such as its party, as the module sends them from 0.30.0, and as this
 * app shows them: its members, by name and portrait only, its stash and its description. A player
 * sees a group only where their Foundry user has Observer or Owner on it, as Foundry shows it them.
 */

/** What a campaign character's player has on a group in Foundry: less is no access. */
export type GroupAccess = 'observer' | 'owner'

/** A group as the campaign's roster keeps it: who may see it, never its sheet. */
export type GroupEntry = {
  id: string
  uuid: string
  name: string
  img: string | null
  type: 'group'
  /** dnd5e's primary party. */
  primary: boolean
  /** By campaign character's actor id: only those whose player has Observer or Owner on it. */
  access: Record<string, GroupAccess>
  /** Why its sheet is null, where the module held it back: for its size, or as none may see it. */
  sheetWithheld?: Pick<SheetWithheld, 'reason'> &
    Partial<Pick<SheetWithheld, 'bytes' | 'limit'>>
}

/** One of a group's members: its name and portrait, and nothing else of it, for anyone. */
export type GroupMember = {
  id: string
  name: string
  img: string | null
  type: 'character' | 'npc' | 'vehicle'
  /** One of this campaign's characters. */
  character: boolean
}

/** A group's sheet, as the module last sent it. */
export type GroupSheet = {
  members: GroupMember[]
  /** Hashes of its descriptions, sent apart, as a character's are. */
  description: { full: string | null; summary: string | null }
  /** As a character's, with nothing to roll or use, and no load or attunement. */
  inventory: SheetInventory
}

/** An entry point on the table view: a group this seat may open. Never its access. */
export type TableGroup = {
  id: string
  name: string
  portrait?: string
  primary: boolean
}

/** A party sheet's view, for its page or side panel to poll. */
export type PartyView = {
  version: number
  live: boolean
  campaign: { title: string }
  group: TableGroup
  /** Absent when unchanged since `sheetVersion`, or when there's none. */
  sheet?: {
    /** In the module's order; `own` marks the player's own character, for no one else. */
    members: { id: string; name: string; portrait?: string; own?: true }[]
    /** Its items' icons loading from the game. */
    inventory: SheetInventory
    /** The hash of the description shown: its full one, else its summary, as dnd5e shows them. */
    description: string | null
  }
  /** Changes whenever the sheet does. Unset when there is none. */
  sheetVersion?: string
  /** Why the module held the sheet back, for its size. */
  withheld?: { reason: 'tooLarge'; bytes?: number; limit?: number }
  /** The Gamemaster's view only: no player may see it in Foundry. */
  private?: true
  /**
   * Set where the seat may take from it, from module 0.31.0: while the campaign lets items and
   * coins be moved and its game is taking moves, for a player whose Foundry user has Owner on it,
   * and for the Gamemaster, with the campaign's characters to take into. Never anyone's access.
   */
  moves?: { characters?: TableMoves['characters'] }
}

/** A group a seat has been let see, by the access check, for its descriptions to be served by. */
export type AllowedGroup = { campaignId: string; groupId: string }
