/**
 * A journal note's id, from module 0.34.0: 16 letters and digits, as Foundry's own document ids
 * are. A note made here keeps this id as its page's in Foundry, which creates the page with it, so
 * the note is the same one everywhere, through reloads, retries and moves (round 0.34.0 §4.7).
 */
export const NOTE_ID = /^[A-Za-z0-9]{16}$/

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** The bytes taken: below the largest multiple of 62 a byte holds, so that none is likelier. */
const BELOW = 256 - (256 % ALPHABET.length)

/**
 * A new note's id: 16 letters and digits drawn from the platform's cryptographic random numbers,
 * a byte at a time, each byte past the last whole multiple of 62 thrown away, so that every
 * character is as likely as every other.
 */
export function newNoteId(): string {
  let id = ''
  while (id.length < 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(24))
    for (const byte of bytes) {
      if (byte >= BELOW) continue
      id += ALPHABET[byte % ALPHABET.length]
      if (id.length === 16) break
    }
  }
  return id
}
