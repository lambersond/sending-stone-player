import { RemoveDialog } from '@/features/transfers/components/remove-dialog/remove-dialog'
import type { RemoveDialogsProps } from './types'

/** The confirmation a character's Remove… opens, for the item it was last opened for. */
export function RemoveDialogs({
  removing,
  open,
  setOpen,
  role,
  name,
  table,
  logMove,
  setActed,
}: Readonly<RemoveDialogsProps>) {
  return (
    <RemoveDialog
      open={open}
      onClose={() => setOpen(false)}
      mover={role === 'gm' ? name : 'You'}
      item={removing}
      character={name}
      onRemove={({ item, quantity, held, words }) => {
        setActed(true)
        table.sendRemove(logMove(words), { item, quantity, held })
      }}
    />
  )
}
