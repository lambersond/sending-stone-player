import type { RollTarget } from '@/features/rolling/types'
import type { TableSheet } from '@/types/table'

export type Ability = TableSheet['abilities'][number]

/**
 * One way to answer what Midi-QOL asks: its key, its name, such as "Dexterity" or "Athletics",
 * and its abbreviation where it has one; and the roll, with the sheet's modifier and the advantage
 * or disadvantage Midi-QOL gives it, as the game makes it.
 */
export type Choice = {
  key: string
  name: string
  short: string
  target: RollTarget
}
