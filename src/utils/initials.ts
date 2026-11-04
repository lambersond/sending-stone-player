/**
 * A word's first letter, whole: its first code point, so one beyond the first UTF-16 unit, as an
 * emoji, is never cut in half. Empty for an empty word.
 */
export function firstLetter(word: string): string {
  return [...word][0] ?? ''
}

/** Up to two letters from a speaker's name, for their avatar. */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => firstLetter(word).toUpperCase())
    .join('')
  return letters || '?'
}
