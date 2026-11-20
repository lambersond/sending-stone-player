/**
 * Beginnings said with a consonant though a vowel starts them: a "u" or "eu" said "you", as
 * "Utility", "Unicorn", "European", and "one" said "won". Common English ones, not every one: a
 * name such as "Euler" (said "oiler") reads "a".
 */
const CONSONANT_START =
  /^(?:eu|uni(?![dmnr])|use|usu|uta|ute|uti|uto|ura|ure|uri|uvu|one(?![a-z]))/i

/** Beginnings said with a vowel though an h starts them: a silent h. */
const SILENT_H = /^(?:hono(?:u)?r|honest|hour|heir)/i

/** Numbers said with a vowel: eight and the eighties, eleven, eighteen. */
const VOWEL_NUMBER = /^(?:8|1[18](?!\d))/

/**
 * "a" or "an" before a word, as it's said: "an" before a vowel, in either case, as "an Ape", "an
 * elk"; but "a" where the vowel is said as a consonant, as "a Utility saving throw", "a Unicorn",
 * "a European Badger"; and "an" before a silent h, as "an Honor (Etiquette) check", "an hour", and
 * a number said with a vowel, as "an 8th-level spell slot", "an 11th"; else "a", as "a Wolf", "a
 * Honey Badger", "a Hound", "a 1st-level spell slot".
 */
export function articleOf(word: string): 'a' | 'an' {
  if (CONSONANT_START.test(word)) return 'a'
  return /^[aeiou]/i.test(word) ||
    SILENT_H.test(word) ||
    VOWEL_NUMBER.test(word)
    ? 'an'
    : 'a'
}
