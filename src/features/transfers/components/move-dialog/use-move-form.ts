import { useState, type FormEvent } from 'react'
import {
  choicesOf,
  firstChosen,
  itemAmounts,
  labelOf,
  moveOf,
  summaryOf,
  thingsOf,
} from './utils'
import { coinsMoved } from '@/features/transfers/components/coin-fields/utils'
import { useTableRole } from '@/hooks/use-table-api'
import type { MoveDialogProps } from './types'

/**
 * A move's form as its dialog shows it: who it may go to and who's chosen, how many of an item or
 * which coins, what it says it'll do, and its button's words; and Submit, which sends it once all
 * that's needed is chosen, and closes the dialog.
 */
export function useMoveForm({
  onClose,
  mode,
  mover,
  what,
  from,
  into,
  receivers,
  recipients,
  onMove,
}: Readonly<MoveDialogProps>) {
  const gm = useTableRole() === 'gm'
  const item = 'item' in what ? what.item : undefined
  const currency = 'coins' in what ? what.coins : undefined
  const take = mode === 'take'
  const choices = choicesOf({ mode, receivers, recipients })
  const [chosen, setChosen] = useState<string | undefined>(() =>
    firstChosen({ mode, recipients }),
  )
  const [count, setCount] = useState('1')
  const [coins, setCoins] = useState<Record<string, string>>({})

  const { max, counted, tooMany, quantity } = itemAmounts(item, count)
  const recipient = choices ? choices.find(({ id }) => id === chosen) : into
  const moved = currency ? coinsMoved(currency, coins) : undefined
  const things = thingsOf(item, quantity, currency, moved)
  // On the Gamemaster's party page, who takes it is who it's taken into, once they're chosen.
  const speaker = take && receivers ? recipient?.name : mover
  const ready = !!recipient && !!speaker && things !== undefined
  const summary = summaryOf({ mode, tooMany, recipient, speaker, things, from })
  const label = labelOf(mode, currency, quantity)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!ready || !recipient || things === undefined) return
    onMove(
      moveOf({
        mode,
        things,
        recipient,
        from,
        item,
        quantity,
        moved,
        gm,
        speaker,
      }),
    )
    onClose()
  }

  return {
    choices,
    take,
    chosen,
    setChosen,
    counted,
    max,
    count,
    setCount,
    currency,
    coins,
    setCoins,
    item,
    summary,
    ready,
    label,
    submit,
  }
}
