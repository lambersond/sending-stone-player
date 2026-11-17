import { useState, type FormEvent } from 'react'
import { coinsLabel, coinsMove, coinsSummary } from './utils'
import { amountsTyped } from '@/features/transfers/components/coin-amounts/utils'
import { coinSpeaker } from '@/features/transfers/utils'
import type { CoinsDialogProps } from './types'
import type { CoinOp } from '@/types/sending-stone'

/**
 * The form coins are added or taken away in, as its dialog shows it: whether to add or take away,
 * none chosen at first, how many of each coin, what it says it'll do, and its button's words; and
 * Submit, which sends it once it may be, and closes the dialog.
 */
export function useCoinsForm({
  onClose,
  role,
  name,
  currency,
  change,
  onChange,
}: Readonly<CoinsDialogProps>) {
  const [op, setOp] = useState<CoinOp>()
  const [typed, setTyped] = useState<Record<string, string>>({})
  const amounts = amountsTyped(currency, typed)
  const summary = coinsSummary(
    { op, amounts },
    currency,
    change,
    coinSpeaker(role, name),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!summary.ready || !op || !amounts) return
    onChange(coinsMove(op, amounts, currency, { name, gm: role === 'gm' }))
    onClose()
  }

  return {
    op,
    setOp,
    typed,
    setTyped,
    summary,
    label: coinsLabel(op),
    submit,
  }
}
