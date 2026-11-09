import type { SheetCurrency, SheetInventory } from '@/types/sending-stone'

/*
 * A campaign's Group actors, such as its party, as the module sends them from 0.30.0, and as this
 * app shows them: its members, by name and portrait only, its stash and its description. A player
 * sees a group only where their Foundry user has Observer or Owner on it, as Foundry shows it them.
 */

/** Who is at a party sheet: a player, through their character, or the campaign's Gamemaster. */
export type PartySeat =
  | {
      role: 'player'
      campaignId: string | null
      actorId: string | null
      characterId: string
      name: string
    }
  | { role: 'gm'; campaignId: string; userId: string }

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
  moves?: {
    /** The Gamemaster's: the campaign's characters to take into (module 0.31.0). */
    characters?: TableMoves['characters']
    /**
     * From module 0.32.0: where the party's items and coins may be sent, never the party itself:
     * for a player, the other parties their Foundry user owns and every campaign character, their
     * own included; for the Gamemaster, every other listed party and every character.
     */
    send?: TableMoves
    /**
     * From module 0.32.0: its members that are the campaign's characters, in its sheet's order,
     * which Distribute shares a coin among; at most MOST_AMONG.
     */
    distribute?: TableMoves['characters']
    /**
     * A player's seat, from module 0.32.0: their character's coins, as last sent, which Give
     * gives.
     */
    give?: { currency: SheetCurrency[] }
  }
}

/** A group a seat has been let see, by the access check, for its descriptions to be served by. */
export type AllowedGroup = { campaignId: string; groupId: string }

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
