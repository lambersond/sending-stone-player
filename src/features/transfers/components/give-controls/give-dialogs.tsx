import { MoveDialog } from '@/features/transfers/components/move-dialog/move-dialog'
import type { GiveDialogsProps } from './types'

/**
 * The dialog a character's Give opens, for what it was last opened for, kept as it closes; from
 * module 0.49.0, coins given to characters are sent as the game hands them out, in its name.
 */
export function GiveDialogs({
  giving,
  open,
  setOpen,
  role,
  name,
  table,
  logMove,
  setActed,
}: Readonly<GiveDialogsProps>) {
  return (
    <MoveDialog
      open={open}
      onClose={() => setOpen(false)}
      mode='give'
      mover={role === 'gm' ? name : 'You'}
      what={giving.what}
      recipients={giving.recipients}
      onMove={({ to, items, currency, words }) => {
        setActed(true)
        table.sendTransfer(logMove(words), {
          from: giving.from,
          to,
          ...(items && { items }),
          ...(currency && { currency }),
        })
      }}
      handOut={
        giving.handOut && {
          change: giving.handOut.change,
          name,
          onGive: ({ each, currency, words }) => {
            setActed(true)
            table.sendTransfer(logMove(words), {
              from: giving.from,
              each,
              currency,
            })
          },
        }
      }
    />
  )
}
