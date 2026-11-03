/**
 * live: the Gamemaster's game is sending. offline: it has not been heard from lately.
 * reconnecting: this app's server cannot be reached. waiting: the character is in no campaign.
 */
export type LiveState = 'live' | 'offline' | 'reconnecting' | 'waiting'
