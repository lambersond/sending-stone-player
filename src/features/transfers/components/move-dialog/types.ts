import type { MoveEnd } from '@/features/transfers/types'
import type { LocalMove } from '@/types/roll'
import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'

export type MoveDialogProps = {
  open: boolean
  onClose: () => void
  mode: 'take' | 'give' | 'send'
  /** Who moves it, as the summary says: "You" for a player; the character's name for the GM. */
  mover: string
  what: { item: SheetItem | SheetContainer } | { coins: SheetCurrency[] }
  /** Take and send: the party it's taken or sent from. */
  from?: MoveEnd
  /** Take, or a give into a party, with a set receiver: no To list. */
  into?: MoveEnd
  /** Take on the GM's party page: picked here. */
  receivers?: MoveEnd[]
  /** Give and send: where it may go. */
  recipients?: { parties: MoveEnd[]; characters: MoveEnd[] }
  onMove: (move: {
    to: string
    items?: { id: string; quantity: number }[]
    currency?: Record<string, number>
    words: LocalMove
  }) => void
  /**
   * From module 0.49.0, a character's coins given from its Currency row: they may go to any of the
   * campaign's characters ticked, so many to each, as the game hands coins out, paid with the
   * character's other coins where `change` says the game does; `onGive` sends that.
   */
  handOut?: {
    change: boolean
    /**
     * From module 0.51.0: the parties are given coins as characters are, ticked among them; and
     * so is the party a give goes into.
     */
    parties?: true
    /** The character whose coins they are, as the Gamemaster's words and the tray name it. */
    name: string
    onGive: (give: EachGive) => void
  }
}

/**
 * Coins given to characters, and from module 0.51.0 parties, as it's sent: to whom, so many to
 * each, and the tray's words.
 */
export type EachGive = {
  each: string[]
  currency: Record<string, number>
  words: LocalMove
}
