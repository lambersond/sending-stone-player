import type { DiceEntrySides } from '@/types/dice-entry'

// What a player may type into a die's box, by the keypad or a keyboard: at most three digits, read
// as the die reads. A d10 marks its 10 with a 0, and a percentile die its 100 with a 00 and its
// ones with a leading 0, so those zeros count; on any other die a leading zero is no face at all.

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * The face typed, if it's one of this die's: a d10's 0 is 10, and a d100's 00 is 100, as they read.
 */
export function faceOf(
  text: string,
  sides: DiceEntrySides,
): number | undefined {
  if (!/^[0-9]{1,3}$/.test(text)) return undefined
  if (sides === 10 && text === '0') return 10
  if (sides === 100) {
    if (text === '00') return 100
    if (/^0[1-9]$/.test(text)) return Number(text[1])
  }
  if (text.startsWith('0')) return undefined
  const face = Number(text)
  return face <= sides ? face : undefined
}

/** Whether some digits more could still make it one of this die's faces. */
export function facePrefix(text: string, sides: DiceEntrySides): boolean {
  if (text === '') return true
  // A box holds three digits at most, so only one or two can be followed by more.
  if (!/^[0-9]{1,2}$/.test(text)) return false
  return DIGITS.some(
    digit =>
      faceOf(text + digit, sides) !== undefined ||
      facePrefix(text + digit, sides),
  )
}

/** Whether it's a face no digit more could make another face of, so the next box may take focus. */
export function faceComplete(text: string, sides: DiceEntrySides): boolean {
  return (
    faceOf(text, sides) !== undefined &&
    DIGITS.every(digit => faceOf(text + digit, sides) === undefined)
  )
}

/** What a die shows, said when the text typed can't be one of its faces. */
export function faceRule(sides: DiceEntrySides): string {
  if (sides === 10) return 'A d10 shows 1 to 10. Type 0 for 10.'
  if (sides === 100) return 'A d100 shows 1 to 100. Type 00 for 100.'
  return `A d${sides} shows 1 to ${sides}.`
}
