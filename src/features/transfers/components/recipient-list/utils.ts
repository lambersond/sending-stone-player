import type { MoveEnd } from '@/features/transfers/types'

/**
 * Whether every one of the characters is ticked: Select all's own tick. None to tick never are.
 * @param value - Those picked, by id.
 */
export function everyTicked(
  value: readonly string[],
  characters: readonly MoveEnd[],
): boolean {
  const picked = new Set(value)
  return characters.length > 0 && characters.every(end => picked.has(end.id))
}

/**
 * Those picked once a character is ticked or unticked (module 0.49.0): any party chosen is let go,
 * as a party is given to alone, and the characters are kept in the list's order, whatever order
 * they're ticked in.
 * @param value - Those picked, by id: a party, or characters.
 * @param id - The character ticked or unticked.
 * @param characters - Every character in the list, in its order.
 */
export function tickedAfter(
  value: readonly string[],
  id: string,
  characters: readonly MoveEnd[],
): string[] {
  const picked = new Set(value)
  return characters
    .map(end => end.id)
    .filter(each => (each === id ? !picked.has(each) : picked.has(each)))
}

/**
 * Those picked once Select all is pressed (module 0.49.0): every character, in the list's order,
 * or none once they all are; any party chosen is let go.
 * @param value - Those picked, by id: a party, or characters.
 * @param characters - Every character in the list, whatever a search shows of them.
 */
export function allTicked(
  value: readonly string[],
  characters: readonly MoveEnd[],
): string[] {
  return everyTicked(value, characters) ? [] : characters.map(end => end.id)
}
