/** A row's parts, such as a spell's casting time and range, joined by dots, or nothing for none. */
export function joinParts(
  ...parts: (string | false | null | undefined)[]
): string | undefined {
  const present = parts.filter(Boolean)
  return present.length > 0 ? present.join(' · ') : undefined
}
