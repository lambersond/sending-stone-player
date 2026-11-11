import type { SeatRole, SeatWords } from '@/types/seats'

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
    rollInitiative:
      'Your Gamemaster is setting up an encounter: roll initiative from the sheet.',
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
    rollInitiative:
      'You’re setting up an encounter: roll initiative from the sheet.',
    connected: 'Your game is connected.',
    unheard: "Your game hasn't been heard from in the last two minutes.",
  },
}

/** The table page's words for a seat. */
export function seatWords(role: SeatRole): SeatWords {
  return WORDS[role]
}
