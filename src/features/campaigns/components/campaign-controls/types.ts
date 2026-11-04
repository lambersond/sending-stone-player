// The controls on a campaign's page (round 0.39.0), which the server draws: each confirms with a
// toast the page shows, beside its own confirmation, and where what it acted on is gone with the
// refreshed page, has focus go next where its Gamemaster can carry on. Each dialog opens on its
// Cancel.

export type CharacterControl = {
  campaignId: string
  campaignTitle: string
  /** The character's id in the campaign, as its sheet link has it. */
  actorId: string
  name: string
  player: string
  /** The player's character's own id. */
  characterId: string
}
