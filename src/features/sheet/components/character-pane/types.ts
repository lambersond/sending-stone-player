import type { AlonePick, TableDamage } from '../action-entry/types'
import type { PartySheets } from '../party-sheets/types'
import type { Picked, Picking } from '../use-picker/types'
import type { NotesPlace } from '@/features/notes/types'
import type { useSheetRoller } from '@/features/rolling/hooks/use-sheet-roller'
import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { CookbookPlace } from '@/types/cookbook'
import type { TableMoves } from '@/types/party'
import type {
  DamageModifiers,
  GmRollView,
  HitPointsInput,
  RollFeature,
  RollKind,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from '@/types/roll'
import type { SheetAction, SpellSlotOp } from '@/types/sending-stone'
import type {
  CreatureFacts,
  TableCombat,
  TableDiceAsk,
  TablePrompt,
  TableSheet,
} from '@/types/table'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** A spell slot sent from the dots (module 0.42.1): its line's id, which, and its count then. */
export type SentSlot = { id: string; op: SpellSlotOp; from: number }

/**
 * Hit points sent from their tile (module 0.44.0): its line's id, and what the tile showed of each
 * number set.
 */
export type SentHitPoints = { id: string; from: HitPointsInput['from'] }

/** The pane's rolls' way to the game, as `useTableRolls` gives it. */
export type PaneTable = ReturnType<typeof useTableRolls>

/** The pane's rolls and the lines it logs, as `useSheetRoller` gives them. */
export type PaneRoller = ReturnType<typeof useSheetRoller>

/** A call made only while the pane's rolls aren't locked, checked as it's made. */
export type UnlessLocked = <A extends unknown[]>(
  run: (...args: A) => void,
) => (...args: A) => void

/**
 * A command sent the game, logged among the pane's rolls (`usePaneCommands`): its line logged, then
 * sent; the tray told first unless `acts` is false. Its line's local id.
 */
export type Command = <T extends { id: string }>(
  log: () => T,
  send: (logged: T) => void,
  options?: { acts?: boolean },
) => string

/**
 * The pane's picker as its rolls use it: `ask` opens it where there's anything to pick, saying
 * whether it did; a use made with what was picked; and damage on its own's choices picked first.
 */
export type PanePicking = {
  ask: (asking: Picking) => boolean
  makeUse: (
    action: SheetAction,
    chose: Picked,
    modifiers?: DamageModifiers,
  ) => void
  pickAlone: (pick: AlonePick) => void
}

/** What a character's pane is given (CharacterPane). */
export type CharacterPaneProps = {
  characterId: string
  name: string
  sheet: TableSheet
  /** The encounter under way. */
  combat?: TableCombat
  /** The rolls the Gamemaster's game takes from the player now, made there with the same dice. */
  rollsToTable?: RollKind[]
  /** What else the game does with them, such as take damage the player changed. */
  rollFeatures?: RollFeature[]
  /** The saving throws the game asks of the character, for its player to roll here. */
  prompts?: TablePrompt[]
  /**
   * The dice the game asks its player for, for later rolls in their typed rolls' runs, from module
   * 0.45.0: on the device that sent the roll, its dialog opens by itself; else its banner.
   */
  diceAsks?: TableDiceAsk[]
  /**
   * For its player, the rolls the campaign's Gamemaster made as the character lately (#156), shown
   * among their own.
   */
  gmRolls?: GmRollView[]
  /**
   * The table's header, which the rolls' toasts start below where the sheet's tabs aren't shown,
   * as on a phone showing combat or the chat.
   */
  header?: HTMLElement | null
  /**
   * Where the character's items and coins may be given to, from module 0.31.0, while the game
   * takes moves: from the Inventory tab, through the seat's own API.
   */
  moves?: TableMoves
  /**
   * Whether the seat may remove the character's items there, from module 0.33.0, as its game takes
   * them.
   */
  removes?: boolean
  /**
   * Whether the seat's player may add to and remove from the character's favorites there, from
   * module 0.37.0, as its game takes them: never at a creature's pane.
   */
  favorites?: boolean
  /**
   * Whether the seat's player may turn off, turn on and delete the character's own effects there,
   * from module 0.39.0, as the campaign lets them and each effect's `ops` say: never at a
   * creature's pane, nor the Gamemaster's page.
   */
  effects?: true
  /**
   * Whether the seat's player may use Wild Shape there, from module 0.40.0, as the campaign lets
   * them and the game takes it: never at a creature's pane, nor the Gamemaster's page.
   */
  wildShape?: true
  /**
   * Whether the seat's player may set the hit points and temporary hit points there, from module
   * 0.44.0, as the campaign lets them, whatever the rolls and this device's Send to the table: the
   * character's, its form's while shaped, or at a companion's pane the companion's; never the
   * Gamemaster's page, nor a companion no longer the character's.
   */
  hitPoints?: true
  /** The character's Foundry actor, which what's given is given from. */
  actorId?: string
  /** The party sheets the seat may open from the Inventory tab, from module 0.30.0. */
  parties?: PartySheets
  /**
   * Whether the player types in their own dice here, where the game lets them, from module
   * 0.32.0.
   */
  manualDice?: { on: boolean; onChange: (on: boolean) => void }
  /**
   * Where the character's own journal notes are read and written, from module 0.34.0: shown on
   * the Biography tab alone.
   */
  notes?: NotesPlace
  /**
   * The player's Magical Recipe Book, from module 0.38.0: since round 0.39.0 opened from the cog,
   * Configure Magical Cookbook, at their own seat, never at a creature's pane.
   */
  cookbook?: CookbookPlace
  /**
   * A creature's pane rather than the character's (module 0.36.0): its header is the creature's,
   * and it offers nothing an NPC lacks (Heroic Inspiration, give, remove, parties, the journal).
   */
  creature?: CreatureFacts
  /**
   * Whether the pane is the one shown, where several share the Character pane (module 0.36.0):
   * a pane not shown neither pops toasts nor rolls damage by itself, but offers it in its tray,
   * and says so through `onPending`. Shown when absent.
   */
  shown?: boolean
  onPending?: (pending: boolean) => void
  /**
   * (v5, critic) Told whether any of the pane's rolls is on its way to the game (its state not yet
   * in `SETTLED`), so that the page never unmounts it then, which would abort its follows.
   */
  onBusy?: (busy: boolean) => void
  /**
   * At a companion's pane under "Right after its character", while its character is in the combat
   * (module 0.36.0): that character's name. Its Initiative tile then says it acts after it, and
   * offers no roll (§8.10).
   */
  follows?: string
  /**
   * (v5) A companion no longer the seat's character's (module 0.36.0): its sheet shows as it was,
   * and nothing on it rolls (§8.3; Q 16).
   */
  locked?: boolean
  /**
   * (v5) What the ids of its tabs and their panel begin with, so that no two panes on one page
   * share one: none at the character's own pane, `creature-<key>-` at a companion's.
   */
  idPrefix?: string
  /**
   * What's said of the sheet under its tab row, above everything else, as a gone companion's note
   * (module 0.36.0).
   */
  note?: ReactNode
  /**
   * At the character's own pane, from module 0.41.0: which of their companions the game asks a
   * save of, each said under the prompts' heading with a way to its tab (round 0.41.0 §3.1.3),
   * as `CompanionAskNotice` lists them. Never at a companion's.
   */
  companionNotice?: ReactNode
}

/** The parts of the sheet, each a tab. */
export type SheetTab =
  | 'character'
  | 'actions'
  | 'inventory'
  | 'spells'
  | 'features'
  | 'effects'
  | 'biography'

/** One of the sheet's tabs as its row shows it: its name and icon. */
export type TabEntry = { id: SheetTab; label: string; icon: LucideIcon }

/** What the pane's tabs and favorites roll and use (`rollActions`), once for all of them. */
export type PaneActions = {
  onRoll: (request: SheetRoll) => void
  onRollDamage: (request: SheetDamageRoll) => void
  onRollFormula: (request: SheetFormulaRoll) => void
  /** While the game takes uses. */
  onUse?: (action: SheetAction, modifiers?: DamageModifiers) => void
  tableDamage?: TableDamage
}
