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
}
