import type { useTableRolls } from '@/features/rolling/hooks/use-table-rolls'
import type { LocalMove, LocalUse } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { SheetContainer, SheetItem } from '@/types/sending-stone'

/** What the confirmation a character's Remove… opens is drawn from: the hook's state, and more. */
export type RemoveDialogsProps = {
  removing: SheetItem | SheetContainer
  open: boolean
  setOpen: (open: boolean) => void
  role: SeatRole
  name: string
  table: Pick<ReturnType<typeof useTableRolls>, 'states' | 'sendRemove'>
  logMove: (move: LocalMove) => LocalUse
  setActed: (acted: boolean) => void
}
