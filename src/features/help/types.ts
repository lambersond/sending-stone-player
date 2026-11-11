import type { TableView } from '@/types/table'

/**
 * A part of a section of Help: its bold lead, where it has one, and what follows it, which carries
 * its own punctuation, such as " Tap an ability…" after "Checks and saves." or ": your checks…"
 * after "Players roll in the app". `later` marks "Dice an item rolls later", shown only where the
 * campaign's module is one that asks for those dice, whatever its switches (H6 B, round 3's
 * decision 3).
 */
export type HelpPart = { lead?: string; text: string; later?: true }

/** One of Help's sections, with the id its chip goes to it by. */
export type HelpSection = { id: string; title: string; parts: HelpPart[] }

/** A row of the "In this game" box: what it's about, what it says now, and whether that's on. */
export type BoxRow = { label: string; says: string; on: boolean }

/**
 * A row's own words: what it's about, and what it says while on and off; for one about something
 * this device sends the game that has words of its own for Send to the table off here, those.
 */
export type RowWords = {
  label: string
  on: string
  off: string
  unsent?: string
}

/** A line under the box's rows; `warn` while the Gamemaster's game isn't connected. */
export type BoxNote = { text: string; warn?: true }

/** The "In this game" box (H2 B): what the character's campaign allows now. */
export type HelpBox = { title: string; rows: BoxRow[]; notes: BoxNote[] }

/** What Help reads of the character's page: whose seat, the character, and its campaign's view. */
export type HelpFacts = {
  /** At the Gamemaster's seat (H3 B). */
  gm: boolean
  /** The character's name, as its page's header shows it. */
  name: string
  /** Whether the character plays in its campaign: the box shows only then. */
  playing: boolean
  view: TableView
  /** The player's Enter dice results manually, where the game lets them type in their dice. */
  typing?: { on: boolean }
  /**
   * This device's Send to the table, the seat's own: the seat's rolls are made in the game, where
   * it takes them, only while it's on.
   */
  send: boolean
}

/** Opens Help, focus going back to `opener` once it closes: the header's button, or the cog. */
export type ShowHelp = (opener: HTMLElement | null) => void

/** Help's panel reads this device's Send to the table itself, as every roll on the page does. */
export type HelpPanelProps = Omit<HelpFacts, 'send'> & {
  open: boolean
  onClose: () => void
}
