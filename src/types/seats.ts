/**
 * Who a table page is for (#156): a character's player, or its campaign's Gamemaster at the
 * character's sheet, rolling as it.
 */
export type SeatRole = 'player' | 'gm'

/**
 * Each table-page string that names the Gamemaster, as the character's player reads it, and as the
 * Gamemaster reads it at the character's sheet, where the game is their own: "your game", "you
 * aren't viewing", "Your game asks". The player's are as they always were, to the character.
 */
export type SeatWords = {
  /** The game rolls are made in, in a sentence. */
  game: string
  /** Who isn't viewing a target's level or scene. */
  notViewing: string
  /** Whose targets defend themselves, as Midi-QOL's active defence has them. */
  targets: string
  /** Who can apply an enchantment from its card. */
  applies: string
  /** Who puts an enchantment for someone else's item on from its card. */
  putsOn: string
  /** Said of a roll the game made blind. */
  hidden: string
  /** The heading over the saves the game asks for. */
  asks: string
  /** A tab's mark, read aloud, that the game asks for a roll. */
  asksForRoll: string
  /** The tray, while no roll is sent to the game. */
  notSent: string
  /** Who was told of a sheet too large to send. */
  told: string
  /** A sheet that hasn't arrived. */
  noSheet: string
  /** A character no longer in its campaign. */
  addBack: string
  /** The combat tracker with no combat. */
  noCombat: string
  /**
   * The combat tracker with no combat under way, while the seat's character, or a companion of it,
   * waits to roll initiative into the encounter it holds: one being set up, or one begun that isn't
   * the Gamemaster's tracker's.
   */
  rollInitiative: string
  /** The game, live. */
  connected: string
  /** The game, not heard from lately. */
  unheard: string
}
