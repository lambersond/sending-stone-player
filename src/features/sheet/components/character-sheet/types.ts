import type { SheetFormulaRoll, SheetRoll } from '@/types/roll'
import type { CreatureFacts, TableCombat, TableSheet } from '@/types/table'
import type { ReactNode } from 'react'

/** What a character's sheet is given (CharacterSheet). */
export type CharacterSheetProps = {
  name: string
  sheet: TableSheet
  /** The encounter under way, in which the character may be waiting to roll initiative. */
  combat?: TableCombat
  onRoll: (roll: SheetRoll) => void
  /** Spends hit dice, rolling them. */
  onRollFormula?: (roll: SheetFormulaRoll) => void
  /** Shows one of the character's conditions in full, with its rules, by its id. */
  onShowConditions?: (id: string) => void
  /**
   * A creature's sheet rather than the character's (module 0.36.0), such as a companion's: its
   * header is the creature's.
   */
  creature?: CreatureFacts
  /**
   * The character a companion acts right after in initiative, while it's in the combat (module
   * 0.36.0): its Initiative tile says so, and rolls nothing.
   */
  follows?: string
  /** What the ids of its pane begin with, as a companion's pane's do (module 0.36.0). */
  idPrefix?: string
  /**
   * Between the skills and the traits, such as the character's favorites, where this browser
   * shows them on the Character tab (v0.44).
   */
  favorites?: ReactNode
}
