import { useState, type FormEvent } from 'react'
import { handOutMove, handOutSummary } from './utils'
import { amountsTyped } from '@/features/transfers/components/coin-amounts/utils'
import { coinSpeaker } from '@/features/transfers/utils'
import type { HandOutDialogProps } from './types'

/**
 * The form coins are handed out in, as its dialog shows it: who's ticked, none at first, how many
 * of each coin each gets, and what it says it'll do; and Submit, which sends it once it may be,
 * and closes the dialog.
 */
export function useHandOutForm({
  onClose,
  role,
  name,
  currency,
  characters,
  change,
  onHandOut,
}: Readonly<HandOutDialogProps>) {
  const [ticked, setTicked] = useState<string[]>([])
  const [typed, setTyped] = useState<Record<string, string>>({})
  const to = characters.filter(({ id }) => ticked.includes(id))
  const each = amountsTyped(currency, typed)
  const summary = handOutSummary(
    to,
    each,
    currency,
    change,
    coinSpeaker(role, name),
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!summary.ready || !each) return
    onHandOut(handOutMove(to, each, currency, { name, gm: role === 'gm' }))
    onClose()
  }

  return { ticked, setTicked, typed, setTyped, summary, submit }
}
