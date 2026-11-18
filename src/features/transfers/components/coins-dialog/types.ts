import type { CoinsInput, LocalMove } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { CoinOp, SheetCurrency } from '@/types/sending-stone'

export type CoinsDialogProps = {
  open: boolean
  onClose: () => void
  /** Whose page it is: the Gamemaster's words name the character. */
  role: SeatRole
  /** The character whose coins they are. */
  name: string
  /** Its coins, as the sheet had them when the dialog opened. */
  currency: SheetCurrency[]
  /** Whether the game pays with other coins where the character is short of one. */
  change: boolean
  onChange: (changed: { coins: CoinsInput; words: LocalMove }) => void
}

/** What's chosen in the dialog: whether to add or remove, if either yet, and how many. */
export type CoinsChosen = {
  op?: CoinOp
  amounts?: Record<string, number>
}
