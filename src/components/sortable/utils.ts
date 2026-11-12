/** The list with one of its items moved, from one place to another. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/**
 * What's announced as a row moves in a sortable list, as a note in a group's order (round 0.35.0)
 * or a favorite (module 0.47.0).
 * @param place - Where it is now, from 1.
 * @param of - How many rows the list holds.
 */
export function movedTo(title: string, place: number, of: number): string {
  return `${title}, now ${place} of ${of}.`
}
