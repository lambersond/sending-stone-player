import type { TableDamage } from '../action-entry/types'
import type {
  DamageModifiers,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/types/roll'
import type { FavoriteEntry, SheetAction } from '@/types/sending-stone'
import type { TableSheet } from '@/types/table'

/** What the character's favorites are given, wherever they're shown. */
export type FavoritesProps = {
  characterId: string
  sheet: TableSheet
  /** The character's favorites, each with what it refers to. */
  entries: FavoriteEntry[]
  onRoll: (roll: SheetRoll) => void
  onRollDamage: (roll: SheetDamageRoll) => void
  /** Spends hit dice, or rolls an activity's own formula, such as a light's radius. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Uses a spell or feature in the Gamemaster's game, while it takes them. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  /** What the game does with damage, while it takes it. */
  tableDamage?: TableDamage
}

/** Reorder's favorites, from module 0.47.0: those that move, in order, and what's done with it. */
export type FavoritesReorderProps = {
  entries: FavoriteEntry[]
  /** Saves the favorites in this order, by key. */
  onSave: (keys: string[]) => void
  onCancel: () => void
}
