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
 * Those picked once one is ticked or unticked (module 0.49.0), kept in the list's order, whatever
 * order they're ticked in, and only those `order` holds: with the characters alone, any party
 * chosen is let go, as a party is then given to alone; from module 0.51.0, with the parties and
 * the characters, a party is kept ticked with them.
 * @param value - Those picked, by id.
 * @param id - The one ticked or unticked.
 * @param order - Every one that may be ticked, in the list's order.
 */
export function tickedAfter(
  value: readonly string[],
  id: string,
  order: readonly MoveEnd[],
): string[] {
  const picked = new Set(value)
  return order
    .map(end => end.id)
    .filter(each => (each === id ? !picked.has(each) : picked.has(each)))
}

/**
 * Those picked once Select all is pressed (module 0.49.0): every one of `section`, or none of them
 * once they all are; those of `order` outside it kept as they are, and the rest let go, all in the
 * list's order. With the characters alone a party chosen is let go; from module 0.51.0 a party
 * ticked among them stays ticked.
 * @param value - Those picked, by id.
 * @param section - Those Select all ticks, whatever a search shows of them: the characters.
 * @param order - Every one that may be ticked, in the list's order.
 */
export function allTicked(
  value: readonly string[],
  section: readonly MoveEnd[],
  order: readonly MoveEnd[] = section,
): string[] {
  const all = everyTicked(value, section)
  const ids = new Set(section.map(end => end.id))
  const picked = new Set(value)
  return order
    .map(end => end.id)
    .filter(id => (ids.has(id) ? !all : picked.has(id)))
}
