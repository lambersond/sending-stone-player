import { CoinsDialog } from '@/features/transfers/components/coins-dialog/coins-dialog'
import type { CoinDialogsProps } from './types'

/**
 * The dialog a character's Currency row's own buttons open (module 0.48.0), for what it was last
 * opened with, kept as it closes.
 */
export function CoinDialogs({
  changing,
  open,
  setOpen,
  role,
  name,
  table,
  logMove,
  setActed,
}: Readonly<CoinDialogsProps>) {
  return (
    <CoinsDialog
      open={open}
      onClose={() => setOpen(false)}
      role={role}
      name={name}
      currency={changing.currency}
      change={changing.change}
      onChange={({ coins, words }) => {
        setActed(true)
        table.sendCoins(logMove(words), coins)
      }}
    />
  )
}
