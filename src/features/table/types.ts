import type { CampaignChoice, ChooseCharacterFormState } from '@/types/campaign'
import type { Character, TableSeat } from '@/types/character'
import type { CookbookCodeAnswer } from '@/types/cookbook'
import type { TableRollState } from '@/types/roll'
import type {
  EndableTurn,
  GmRolls,
  RowCompanion,
  TableCombat,
  TableCompanion,
  TableView,
  TurnUndo,
} from '@/types/table'
import type {
  MouseEventHandler,
  PointerEventHandler,
  ReactNode,
  RefObject,
} from 'react'

export type Tab = 'character' | 'combat' | 'chat'

/** What shares the narrow column beside the sheet on a wide screen: combat, or the chat. */
export type Aside = Exclude<Tab, 'character'>

export type GameTableProps = {
  character: Character
  initialView: TableView
  /**
   * Who is at the sheet (#156): its player, by default, through the character's own API; or its
   * campaign's Gamemaster, through theirs, rolling as it.
   */
  seat?: TableSeat
  /** The campaign's characters, for a character in it that has yet to choose which it is. */
  choice?: CampaignChoice
  /** Saves which of its campaign's characters this character is. A player's page only. */
  chooseActor?: (
    state: ChooseCharacterFormState,
    formData: FormData,
  ) => Promise<ChooseCharacterFormState>
  /** Deletes this character and leaves its page. A player's page only. */
  deleteCharacter?: () => Promise<void>
  /**
   * Notes that the player has read the chat up to the message sent at this ISO time. A player's
   * page only: the Gamemaster never moves their place in it.
   */
  markChatRead?: (readAt: string) => Promise<void>
  /**
   * Remembers whether the player types in their own dice for this character, on every device. A
   * player's page only.
   */
  setManualDice?: (on: boolean) => Promise<void>
  /**
   * Makes a link code for the Magical Recipe Book for this character, from module 0.38.0,
   * replacing any before it. A player's page only.
   */
  makeCookbookCode?: () => Promise<CookbookCodeAnswer>
  /** Revokes this character's link code for the Magical Recipe Book. A player's page only. */
  revokeCookbookCode?: () => Promise<void>
}

/**
 * A turn that is the seat's own (v0.44): its character's, or one of its companions', by its key.
 */
export type SeatTurn = { companion?: string }

/** What `useHold` puts on the tab held to end the turn: its pointer, menu and click handlers. */
export type HoldHandlers = {
  onPointerDown: PointerEventHandler
  onPointerMove: PointerEventHandler
  onPointerUp: PointerEventHandler
  onPointerCancel: PointerEventHandler
  onContextMenu: MouseEventHandler
  onClickCapture: MouseEventHandler
}

/**
 * The Combat tab held to end the turn (module 0.36.0): the hold's handlers, on it always; whether
 * a press is held, and whether the tab takes a held touch; and while a turn may be ended, its
 * fill and what it's described as, by the id of the words that say so.
 */
export type TabHold = {
  handlers: HoldHandlers
  holding: boolean
  touch: boolean
  offer?: {
    fill: RefObject<HTMLSpanElement | null>
    id: string
    description: string
  }
}

/**
 * The row of companions as the page keeps it (module 0.36.0): as last listed, which it was worked
 * out from; the gone ones whose tabs have been left; the row; each one's name and number where
 * the row repeats a name; and how many times each has come back after it had gone, which its pane
 * is mounted afresh for.
 */
export type RowState = {
  listed?: TableCompanion[]
  dismissed: ReadonlySet<string>
  row: RowCompanion[]
  names: ReadonlyMap<string, string>
  numbers: ReadonlyMap<string, number>
  generations: ReadonlyMap<string, number>
}

/** The switch for whether the player types in their own dice (module 0.32.0), where offered. */
export type DiceSwitch = { on: boolean; onChange: (on: boolean) => void }

/**
 * What a companion's pane says of itself: damage to roll, a roll on its way, and that its view
 * can't be read.
 */
export type PaneMarks = {
  pending?: boolean
  busy?: boolean
  reconnecting?: boolean
}

/**
 * How a companion's pane tells the page so, and that its route said it's gone, the same each time
 * for its key.
 */
export type PaneReporters = {
  onPending: (pending: boolean) => void
  onBusy: (busy: boolean) => void
  onReconnecting: (reconnecting: boolean) => void
  onLost: () => void
}

/**
 * A companion the game asks a save of (module 0.41.0), or from module 0.45.0 its player's dice
 * (`dice`), as its tab in the row names it.
 */
export type WaitingCompanion = {
  key: string
  label: string
  name: string
  dice?: true
}

/**
 * The row of the character's companions above the sheet, as `useCompanionRow` keeps it (module
 * 0.36.0): the row, each one's name and number, how many times each has come back, and their keys;
 * those the game asks a save of, and their keys; the one chosen, and `choose`; what each mounted
 * pane says of itself, how it says so, and the panes mounted; whether the chosen one's pane can't
 * read its view; and `openCompanion`, which chooses one, shows the Character tab and focuses its
 * tab.
 */
export type CompanionRow = {
  row: RowCompanion[]
  names: ReadonlyMap<string, string>
  numbers: ReadonlyMap<string, number>
  generations: ReadonlyMap<string, number>
  rowKeys: string[]
  waiting: WaitingCompanion[]
  waitingKeys: ReadonlySet<string>
  chosen: string
  choose: (next: string) => void
  paneMarks: ReadonlyMap<string, PaneMarks>
  reportersOf: (key: string) => PaneReporters
  panes: string[]
  reconnecting: boolean
  openCompanion: (key: string) => void
}

/**
 * The Magical Recipe Book's button and dialog under why there's no sheet, as `useCookbookEntry`
 * has them: whether it's offered, `open`, which opens it, and its modal.
 */
export type CookbookEntry = {
  shown: boolean
  open: () => void
  modal: ReactNode
}

/**
 * What the viewer has of a view, which the table's poll sends and the server compares to say
 * nothing is new: its version, whether the game was live, its sheet's version, and the rolls,
 * Gamemaster's rolls and switches it was built with.
 */
export type ViewSeen = {
  version: number
  live: boolean
  sheetVersion?: string
  rolls: string
  gm?: GmRolls
  gmRolls?: string
  moves: boolean
  typed: boolean
  removes: boolean
  favorites: boolean
  effects: boolean
  wildShape: boolean
  hitPoints: boolean
}

/**
 * End Turn, for a character's page (module 0.36.0), as `useEndTurn` gives it: the turn it may end;
 * whether it's offered now; the way of the one sent for it; the last one sent, with its way; and
 * `end`, which sends it.
 */
export type EndTurnState = {
  turn?: EndableTurn
  offered: boolean
  way?: TableRollState
  sent?: { turn: EndableTurn; way: TableRollState }
  end: (turn: EndableTurn) => void
}

/**
 * Undo, for a character's page (module 0.36.0), as `useTurnUndo` gives it: the End Turn offered
 * to take back; the way of the Undo sent, with the End Turn it's for; and `undo`, which sends it.
 */
export type UndoState = {
  offer?: TurnUndo
  way?: TableRollState & { for: string }
  undo: () => void
}

/** The last End Turn sent, and its way. */
export type Sent = NonNullable<EndTurnState['sent']>

/**
 * The turn the page shows, as `useEndTurn` has it: which, by its key; how many turns have been
 * shown before it, so that what's heard of an End Turn sent for one of those is never taken for it,
 * even where it's the same turn shown again; whether it has been shown long enough to be offered;
 * and the way of the End Turn sent for it, if one was.
 */
export type Shown = {
  key?: string
  serial: number
  armed: boolean
  way?: TableRollState
  /**
   * Once that way says the turn is over, the view of the combat the page showed then. The game
   * moves the turn before it answers, so a newer view still showing the turn is the turn shown
   * again, as after the Gamemaster's Previous Turn, though the page never saw the turn between.
   */
  overIn?: TableCombat
}

/**
 * The End Turn `useTurnUndo` follows, by its id, as the page has shown its combat since the game
 * said it was made: the turn it left the combat on, once the page has shown one; and whether it
 * can no longer be taken back from here, as once the page has shown another turn since, or none,
 * or an Undo was sent for it.
 */
export type Followed = {
  id?: string
  left?: TurnUndo['left']
  over: boolean
}

/**
 * End Turn, as the turn panel offers it (module 0.36.0): the turn the seat may end and its way, as
 * `useEndTurn` has them; how the last End Turn was sent; why the last one wasn't made, by the turn
 * it was for and its way's reason, else its status; what ends a turn from the panel; and the page's
 * own place for focus on the turn, where the panel's heading has gone too.
 */
export type PanelEnding = {
  ending?: EndTurnState
  via?: 'button' | 'hold'
  refused?: { turn: EndableTurn; key: string }
  onEnd?: (turn: EndableTurn) => void
  focusTurn?: () => void
}

/**
 * What the toast shows: a hold past half a second; its End Turn on its way; one sent that can't be
 * followed; an End Turn the game made, with Undo while that's offered; one that wasn't made; Undo
 * on its way; or Undo not made. Each card shown is numbered, so that the next is announced, and
 * animates in, as a new one.
 */
export type CardBody =
  | { kind: 'holding'; turn: EndableTurn }
  | { kind: 'sending'; turn: EndableTurn }
  | { kind: 'sent'; turn: EndableTurn }
  | {
      kind: 'ended'
      id: string
      turn: EndableTurn
      line?: string
      undo: boolean
    }
  | { kind: 'refused'; turn: EndableTurn; key: string }
  | { kind: 'taking'; id: string; turn: EndableTurn }
  | { kind: 'kept'; turn: EndableTurn; key: string }

export type Card = CardBody & { serial: number }
