/**
 * A key's entry in a table of names, such as `ABILITIES`: the table's own, never one every object
 * answers to, such as `constructor`; none for a key not in it.
 */
export function ownName(
  names: Record<string, string>,
  key: unknown,
): string | undefined {
  const id = String(key)
  return Object.hasOwn(names, id) ? names[id] : undefined
}
