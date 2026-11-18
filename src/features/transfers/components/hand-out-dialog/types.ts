import type { MoveEnd } from '@/features/transfers/types'
import type { LocalMove } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { SheetCurrency } from '@/types/sending-stone'

export type HandOutDialogProps = {
  open: boolean
  onClose: () => void
  /** Whose page it is: the Gamemaster's words name the character. */
  role: SeatRole
  /** The character whose coins are handed out. */
  name: string
  /** Its coins, as the sheet had them when the dialog opened. */
  currency: SheetCurrency[]
  /** The campaign's other characters, any of which may be given coins. */
  characters: MoveEnd[]
  /** Whether the game pays with other coins where the character is short of one. */
  change: boolean
  onHandOut: (handOut: {
    each: string[]
    currency: Record<string, number>
    words: LocalMove
  }) => void
}
