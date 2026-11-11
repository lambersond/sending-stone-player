import {
  ALONE_CHOICES,
  COMPANIONS,
  DICE_ASKS,
  DISHES,
  EFFECTS,
  EVENTS,
  FAVORITES,
  FOUNDRY_SETTINGS,
  GROUPS,
  HIT_POINTS,
  MAX_ENVELOPE_BYTES,
  MIDI_PROMPTS,
  NOTES,
  REMOVALS,
  SLIM_SHEETS,
  TRANSFERS,
  WILD_SHAPE,
} from '@/constants/sending-stone'

/**
 * The campaign's switches the module's fetches are answered by, in the order they're read: its
 * players' rolls; from module 0.31.0 moves of items and coins; 0.33.0 removals; 0.34.0 journal
 * notes; 0.37.0 favorites; 0.38.0 dishes from the Magical Recipe Book; 0.39.0 effects changed;
 * 0.40.0 Wild Shape; and 0.44.0 hit points set. While any is on, the module's fetches are taken.
 */
export const BRIDGE_SWITCHES = [
  'rollsEnabled',
  'transfersEnabled',
  'removalsEnabled',
  'notesEnabled',
  'favoritesEnabled',
  'dishesEnabled',
  'effectsEnabled',
  'wildShapeEnabled',
  'hitPointsEnabled',
] as const

/**
 * What this app does beyond taking events, as told to the module: it has commands to fetch, it
 * expands slim sheets up to this format, it takes posts of up to this many bytes, and it reads
 * what Midi-QOL asks of characters in this format, which the module sends only then (0.27.0); and
 * the campaign's groups in this format, which the module sends only then too (0.30.0).
 * Foundry's settings too, in this format, which the module likewise sends only then (0.30.0);
 * moves of items and coins, from module 0.31.0; removals of a character's items, from module
 * 0.33.0; and journal notes, from module 0.34.0, which the module fetches for, and sends journals
 * of, only then, and from module 0.35.0 orders of a group's notes and who changed a journal in
 * Foundry; and from module 0.36.0 the campaign's characters' companions, which the module sends,
 * and marks its combats and chat with, only then; and from module 0.37.0 favorites added and
 * removed, which the module fetches for only then; and from module 0.38.0 dishes from the Magical
 * Recipe Book, which the module fetches, and reports the Gamemaster's choice of, only then; and
 * from module 0.39.0 a player's own effects turned off, on and deleted, which the module fetches
 * for only then; and from module 0.40.0, Wild Shape from the app and a shaped character's sheet,
 * which the module sends and fetches for only then; and from module 0.41.0 the saves the game asks
 * of companions (`companions` 2), and the plans of damage on its own at each level, in each attack
 * mode and with each ammunition, and what it would spend (`aloneChoices`), which the module sends
 * only then; and from module 0.44.0 hit points and temporary hit points set from here, of the
 * characters, their Wild Shape forms and their companions, which the module fetches for only then;
 * and from module 0.44.0 too the dice the game rolls later in a typed roll's run, asked of its
 * player, which the module asks, and takes the `dice` answer to, only then.
 */
export const FEATURES = {
  commands: true,
  slimSheets: SLIM_SHEETS,
  maxBytes: MAX_ENVELOPE_BYTES,
  midiPrompts: MIDI_PROMPTS,
  groups: GROUPS,
  settings: FOUNDRY_SETTINGS,
  transfers: TRANSFERS,
  removals: REMOVALS,
  notes: NOTES,
  companions: COMPANIONS,
  favorites: FAVORITES,
  dishes: DISHES,
  effects: EFFECTS,
  wildShape: WILD_SHAPE,
  aloneChoices: ALONE_CHOICES,
  hitPoints: HIT_POINTS,
  diceAsks: DICE_ASKS,
}

/**
 * The events answered with them: a hello and a heartbeat, and from module 0.22.0 a sheet's post,
 * as the module sends each sheet slim or in full, and sizes it, by the latest answer, so that it
 * follows this app being rolled back or deployed again without waiting for a heartbeat; a group's
 * sheet too, from module 0.30.0, and a companion's, from module 0.36.0.
 */
export const ANSWERED_WITH_FEATURES: ReadonlySet<string> = new Set([
  EVENTS.HELLO,
  EVENTS.HEARTBEAT,
  EVENTS.CHARACTER_UPDATED,
  EVENTS.GROUP_UPDATED,
  EVENTS.COMPANION_UPDATED,
])
