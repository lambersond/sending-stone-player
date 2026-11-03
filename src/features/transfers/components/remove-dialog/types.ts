import type { LocalMove } from '@/types/roll'
import type { SheetContainer, SheetItem } from '@/types/sending-stone'

export type RemoveDialogProps = {
  open: boolean
  onClose: () => void
  /** "You" for a player; the character's name for the Gamemaster. */
  mover: string
  /** The item, as the sheet had it when the dialog opened. */
  item: SheetItem | SheetContainer
  /** The character it's removed from: its name, for the words the tray keeps. */
  character: string
  onRemove: (removal: {
    item: string
    quantity: number
    held: number
    words: LocalMove
  }) => void
}
