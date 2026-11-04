import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { Giving } from '@/features/transfers/types'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'

/** What the dialog a character's Give opens is drawn from: the hook's state and what it's given. */
export type GiveDialogsProps = {
  giving: Giving
  open: boolean
  setOpen: (open: boolean) => void
  role: SeatRole
  name: string
  table: Pick<ReturnType<typeof useTableRolls>, 'states' | 'sendTransfer'>
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}
