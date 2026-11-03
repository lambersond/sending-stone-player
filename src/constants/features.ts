/**
 * The campaign's switches the module's fetches are answered by, in the order they're read: its
 * players' rolls; from module 0.31.0 moves of items and coins; 0.33.0 removals; 0.34.0 journal
 * notes; 0.37.0 favorites; 0.38.0 dishes from the Magical Recipe Book; 0.39.0 effects changed; and
 * 0.40.0 Wild Shape. While any is on, the module's fetches are taken.
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
] as const
