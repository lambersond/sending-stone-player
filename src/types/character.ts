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
}
