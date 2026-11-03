export type Toast = (
  text: string,
  options?: {
    /**
     * Whether the status region says it too: not where what was pressed already says so, as a
     * Copy button saying Copied.
     */
    announce?: boolean
  },
) => void

/** Finds where focus goes next, once it's there. */
export type Find = () => HTMLElement | null | undefined

export type CampaignChoice = {
  /** The campaign the address chooses, where it's one of the list. */
  chosen?: string
  /** Shows a campaign, as its row does: beside the list when wide, in its place on a phone. */
  choose: (id: string) => void
  /**
   * Where focus goes once the dialog acting has closed and the page has what the action changed,
   * as the page behind an open dialog is inert: the page's heading after Delete, a character's
   * sheet link after Remove.
   */
  focusNext: (find: Find) => void
}

/** What a campaign's chip says of its Foundry (round 0.39.0). */
export type FoundryState = 'refused' | 'live' | 'waiting' | 'offline'

/**
 * What a campaign's row in the index shows (round 0.39.0), worked out on the server, so the page
 * hands the index no more of each campaign than its row draws.
 */
export type CampaignRowData = {
  id: string
  title: string
  /** Searched with its title. */
  worldTitle?: string
  /** Its world and its game's host, as far as known. */
  sub: string
  state: FoundryState
  flag?: { attention: Attention; text: string }
  seats: { shown: Seat[]; chosen: number; total: number }
  live: boolean
  lastSeenAt?: string
}

/** What a campaign needs of its Gamemaster: Foundry's posts refused, or a first connection. */
export type Attention = 'refused' | 'waiting'

/** One of a campaign's characters as its row draws it: its player's letters, or none chosen yet. */
export type Seat = {
  character: string
  player?: string
  initials?: string
}
