import type { ActionsLayout } from '../actions-layout/types'

/** What the sheet's settings are given, behind its cog. */
export type SheetSettingsProps = {
  /** Whether this device sends the player's rolls to the table, while the game takes any. */
  send?: { on: boolean; onChange: (on: boolean) => void }
  /**
   * Whether damage rolled here goes to the table on its own, from module 0.36.0, where the game
   * takes it: this device's, so every pane's cog says the same. Disabled while Send to the table
   * is off, as nothing goes then. From module 0.41.0, whether the game takes its choices too,
   * which its hint then says.
   */
  alone?: {
    on: boolean
    onChange: (on: boolean) => void
    disabled: boolean
    choices?: boolean
  }
  /**
   * Whether the player types in what their own dice show, where the campaign's game lets them,
   * from module 0.32.0: the setting is shown only then.
   */
  manualDice?: { on: boolean; onChange: (on: boolean) => void }
  /** Whether the player's rolls pop up as toasts on this device, or stay in the banner. */
  toasts?: { on: boolean; onChange: (on: boolean) => void }
  /** The Actions tab's layouts, where the sheet is wide enough for more than one. */
  layouts?: ActionsLayout
  /**
   * Told as the settings open and close (round 0.39.0), as the player's Magical Recipe Book is read
   * again each time they open, to know whether to offer it.
   */
  onOpenChange?: (open: boolean) => void
  /**
   * The player's Magical Recipe Book, at their own seat, while the game takes dishes or the
   * character has a link (round 0.39.0): Configure Magical Cookbook opens it in a modal of its own.
   */
  cookbook?: { onOpen: () => void }
}
