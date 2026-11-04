import type { MoveEnd } from '@/features/transfers/types'
import type { LocalMove } from '@/types/roll'
import type { SheetCurrency } from '@/types/sending-stone'

export type DistributeDialogProps = {
  open: boolean
  onClose: () => void
  /** "You" for a player; the character's name for the Gamemaster. */
  mover: string
  /** The party it's distributed from. */
  from: MoveEnd
  /** The party's coins, as its sheet has them. */
  currency: SheetCurrency[]
  /**
   * Who shares it: the party's members that are the campaign's characters, in its sheet's order.
   */
  among: MoveEnd[]
  onMove: (move: {
    among: string[]
    currency: Record<string, number>
    words: LocalMove
  }) => void
}

/** A coin there's a whole one of, with as many as may be shared. */
export type Shared = SheetCurrency & { whole: number }
