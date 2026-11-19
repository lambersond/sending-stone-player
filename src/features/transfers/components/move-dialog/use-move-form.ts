import { useState, type FormEvent } from 'react'
import {
  choicesOf,
  coinsLegend,
  eachMove,
  eachSummary,
  firstChosen,
  givesEach,
  itemAmounts,
  labelOf,
  moveOf,
  pickedOf,
  summaryOf,
  thingsOf,
  toldWords,
} from './utils'
import { amountsTyped } from '@/features/transfers/components/coin-amounts/utils'
import { coinsMoved } from '@/features/transfers/components/coin-fields/utils'
import { coinSpeaker } from '@/features/transfers/utils'
import { useTableRole } from '@/hooks/use-table-api'
import type { MoveDialogProps } from './types'
import type { FormSummary } from '@/features/transfers/types'

/**
 * A move's form as its dialog shows it: who it may go to and who's chosen, how many of an item or
 * which coins, what it says it'll do and who's told, and its button's words; and Submit, which
 * sends it once all that's needed is chosen, and closes the dialog. From module 0.49.0, a
 * character's coins given to characters, one or several, are given as the game hands coins out
 * (`each`), with the rules of `eachSummary` and `eachMove`; to a party, as any give.
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
  handOut,
}: Readonly<MoveDialogProps>) {
  const gm = useTableRole() === 'gm'
  const item = 'item' in what ? what.item : undefined
  const currency = 'coins' in what ? what.coins : undefined
  const take = mode === 'take'
  const choices = choicesOf({ mode, receivers, recipients })
  const [chosen, setChosen] = useState<string[]>(() =>
    firstChosen({ mode, recipients }),
  )
  const [count, setCount] = useState('1')
  // What's typed, by coin, kept whichever fields show it.
  const [coins, setCoins] = useState<Record<string, string>>({})

  const picked = pickedOf(choices, chosen, into)
  const parties = recipients?.parties ?? []
  // A character's coins given to characters: so many to each, paid as the game hands them out.
  const giving =
    handOut && currency && givesEach({ handOut, currency, chosen, parties })
      ? { ...handOut, currency, amounts: amountsTyped(currency, coins) }
      : undefined

  const { max, counted, tooMany, quantity } = itemAmounts(item, count)
  const recipient = picked.at(0)
  const moved = currency ? coinsMoved(currency, coins) : undefined
  const things = thingsOf(item, quantity, currency, moved)
  // On the Gamemaster's party page, who takes it is who it's taken into, once they're chosen.
  const speaker = take && receivers ? recipient?.name : mover
  const summary: FormSummary = giving
    ? eachSummary(
        picked,
        giving.amounts,
        giving.currency,
        giving.change,
        coinSpeaker(gm ? 'gm' : 'player', giving.name),
      )
    : {
        text: summaryOf({ mode, tooMany, recipient, speaker, things, from }),
        ready: !!recipient && !!speaker && things !== undefined,
      }
  const label = labelOf(mode, currency, quantity)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!summary.ready) return
    if (giving?.amounts) {
      const { amounts, name } = giving
      giving.onGive(eachMove(picked, amounts, giving.currency, { name, gm }))
    } else if (recipient && things !== undefined) {
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
    } else return
    onClose()
  }

  return {
    choices,
    take,
    chosen,
    setChosen,
    // Any of the characters may be ticked: a character's coins, where its module hands them out.
    several: handOut && currency ? ('characters' as const) : undefined,
    each: !!giving,
    legend: coinsLegend(picked.length),
    told: summary.ready ? toldWords({ each: !!giving, to: picked, gm }) : '',
    counted,
    max,
    count,
    setCount,
    currency,
    coins,
    setCoins,
    item,
    summary,
    label,
    submit,
  }
}
