import { CoinsDialog } from '@/features/transfers/components/coins-dialog/coins-dialog'
import { HandOutDialog } from '@/features/transfers/components/hand-out-dialog/hand-out-dialog'
import type { CoinDialogsProps } from './types'

/**
 * The dialog a character's Currency row's own buttons open (module 0.49.0), for what it was last
 * opened with, kept as it closes: its coins added or taken away, or handed out.
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
  if (changing.mode === 'handOut') {
    return (
      <HandOutDialog
        open={open}
        onClose={() => setOpen(false)}
        role={role}
        name={name}
        currency={changing.currency}
        characters={changing.characters}
        change={changing.change}
        onHandOut={({ each, currency, words }) => {
          setActed(true)
          table.sendTransfer(logMove(words), {
            from: changing.from,
            each,
            currency,
          })
        }}
      />
    )
  }
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
