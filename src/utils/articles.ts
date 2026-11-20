/**
 * "a" or "an" before a word, as it's said: "an" before a vowel, in either case, as "an Ape", "an
 * elk"; and before a silent h, as "an Honor (Etiquette) check", "an hour"; else "a", as "a Wolf",
 * "a Honey Badger", "a Hound".
 */
export function articleOf(word: string): 'a' | 'an' {
  return /^(?:[aeiou]|hono(?:u)?r|honest|hour|heir)/i.test(word) ? 'an' : 'a'
}
