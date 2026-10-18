/*
 * Searching names as a player types them: whatever their case, their accents or their quotes, and
 * word by word, so that "gob 2" finds "Goblin Archer 2" and "eowyn" finds "Éowyn".
 */

/**
 * A name or a query as they're compared: lowercased first, so that a capital whose lowercase
 * carries a mark, such as "İ", loses it too; its accents taken off; typographic quotes and
 * apostrophes as plain ones; and runs of spacing as one. Lowercased the same in every locale, so
 * a search finds the same everywhere.
 */
export function searchKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[\u2018\u2019\u201A\u201B\u02BC]/g, "'")
    .replaceAll(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

/**
 * Whether what's shown matches a query: each of its words is somewhere in it. A query of nothing
 * but spaces matches everything, as no search.
 * @param texts - What's shown of it, such as its name.
 */
export function matchesSearch(
  texts: readonly string[],
  query: string,
): boolean {
  const words = searchKey(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const shown = searchKey(texts.join(' '))
  return words.every(word => shown.includes(word))
}
