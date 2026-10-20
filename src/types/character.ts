export type Character = {
  id: string
  name: string
  gameUrl: string
  campaignTitle: string
  /**
   * The campaign the character is in. Unset for one made before invite links, or whose campaign
   * was removed.
   */
  campaignId: string | null
  /** The campaign's Foundry actor that this character is. Unset until its player chooses one. */
  actorId: string | null
  /** When its player last had the chat in view, as an ISO timestamp. Unset until they have. */
  chatReadAt?: string
  /** Whether its player types in their own dice for it, on every device. Unset reads as off. */
  manualDice?: boolean
}

/**
 * Who is at a character's sheet (#156): its player, or its campaign's Gamemaster rolling as it.
 * A Gamemaster's seat has no Character of its own, so no `characterId` and no `chatReadAt`, but
 * always a campaign and an actor.
 */
export type SheetSeat = Pick<
  Character,
  | 'name'
  | 'gameUrl'
  | 'campaignTitle'
  | 'campaignId'
  | 'actorId'
  | 'chatReadAt'
  | 'manualDice'
> & {
  role: 'player' | 'gm'
  /** The signed-in user at the sheet. */
  userId: string
  /** The player's character; null for the Gamemaster's seat. */
  characterId: string | null
}

/**
 * A table page's seat, as its browser code needs it: whose it is, the API base it reads and rolls
 * through, and the prefix of what it keeps in the browser: the character's id for its player, so
 * what they kept before stays, or `gm:<campaignId>:<actorId>` for the Gamemaster.
 */
export type TableSeat = { role: 'player' | 'gm'; api: string; key: string }
