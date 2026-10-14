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
  /** A combat not yet started. */
  settingUp: string
  /** The game, live. */
  connected: string
  /** The game, not heard from lately. */
  unheard: string
}

const WORDS: Record<SeatRole, SeatWords> = {
  player: {
    game: 'your Gamemaster’s game',
    notViewing: 'your Gamemaster isn’t viewing',
    targets: 'your Gamemaster’s targets',
    applies: 'your Gamemaster can apply it from the card',
    putsOn: 'your Gamemaster puts it on from the card',
    hidden: 'Rolled at the table, hidden by your Gamemaster',
    asks: 'Your Gamemaster asks',
    asksForRoll: ', your Gamemaster asks for a roll',
    notSent:
      "Only you see these rolls for now. They aren't sent to your Gamemaster's game.",
    told: 'Your Gamemaster has been told.',
    noSheet:
      "Your Gamemaster's Sending Stone module sends it under D&D Fifth Edition, from version 0.5.0. It arrives the next time their game connects.",
    addBack:
      'Ask your Gamemaster to add them back to the campaign in Sending Stone.',
    noCombat:
      'The initiative order appears here when your Gamemaster starts an encounter.',
    settingUp: 'The Gamemaster is setting up this encounter.',
    connected: "Your Gamemaster's game is connected.",
    unheard:
      "Your Gamemaster's game hasn't been heard from in the last two minutes.",
  },
  gm: {
    game: 'your game',
    notViewing: 'you aren’t viewing',
    targets: 'your targets',
    applies: 'you can apply it from the card',
    putsOn: 'you put it on from the card',
    hidden: 'Rolled at the table, hidden from its player',
    asks: 'Your game asks',
    asksForRoll: ', your game asks for a roll',
    notSent: "Only you see these rolls for now. They aren't sent to your game.",
    told: 'Foundry told you so when it held it back.',
    noSheet:
      'Your Sending Stone module sends it under D&D Fifth Edition, from version 0.5.0. It arrives the next time your game connects.',
    addBack:
      'Add them back on the campaign’s Players tab in Sending Stone’s settings in Foundry.',
    noCombat: 'The initiative order appears here when you start an encounter.',
    settingUp: 'You’re setting up this encounter.',
    connected: 'Your game is connected.',
    unheard: "Your game hasn't been heard from in the last two minutes.",
  },
}

/** The table page's words for a seat. */
export function seatWords(role: SeatRole): SeatWords {
  return WORDS[role]
}
