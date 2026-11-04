import type { DiceEntry } from '@/types/dice-entry'

/** A key of the dice keypad: a digit, a percentile die's 00, Delete or Next die. */
export type DiceKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '00'
  | 'delete'
  | 'next'

/** A roll's dice asked for, until the player types them in or it closes. */
export type Asked = {
  entry: DiceEntry
  /** Gives the roll what was typed, or nothing; only the first time counts. */
  settle: (values?: number[][]) => void
}
