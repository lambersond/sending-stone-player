import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { CoinChanging } from '@/features/transfers/types'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/** What a character's coins' dialog is drawn from: the hook's state and what it's given. */
export type CoinDialogsProps = {
  changing: CoinChanging
  open: boolean
  setOpen: (open: boolean) => void
  role: SeatRole
  name: string
  table: Pick<ReturnType<typeof useTableRolls>, 'sendCoins'>
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}
