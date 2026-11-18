import { MOST_AMONG } from '@/constants/sending-stone'
import { coinAbbreviations, shortCoinWords } from '@/features/transfers/utils'
import { coinTotals } from '@/utils/coins'
import { coinsWords, namesWords } from '@/utils/move-words'
import type { HandOutDialogProps } from './types'
import type {
  CoinSpeaker,
  FormSummary,
  MoveEnd,
} from '@/features/transfers/types'
import type { SheetCurrency } from '@/types/sending-stone'

/**
 * What the dialog says it'll do, or what it still needs: who gets them, no more than one hand-out
 * gives to, then how many each; what each gets and what that comes to in all; and where that's
 * more of a coin than the character holds, that other coins pay for the rest, or why it can't be
 * sent.
 * @param to - Those ticked, in the list's order.
 * @param each - What each gets, by coin; unset until it's typed.
 * @param currency - The character's coins, as the sheet had them when the dialog opened.
 * @param change - Whether the game pays with other coins where the character is short of one.
 */
export function handOutSummary(
  to: readonly MoveEnd[],
  each: Readonly<Record<string, number>> | undefined,
  currency: readonly SheetCurrency[],
  change: boolean,
  speaker: CoinSpeaker,
): FormSummary {
  if (to.length === 0) return { text: 'Choose who gets them.', ready: false }
  if (to.length > MOST_AMONG) {
    return { text: `Choose up to ${MOST_AMONG} at a time.`, ready: false }
  }
  if (!each) return { text: 'Choose how many each gets.', ready: false }
  const totals = coinTotals(each, to.length)
  const { note, refused } = shortCoinWords(speaker, currency, totals, {
    change,
    inAll: true,
  })
  if (refused) return { text: refused, ready: false }
  const verb = speaker.who === 'You' ? 'hand' : 'hands'
  const names = namesWords(to.map(({ name }) => name))
  const things = coinsWords(currency, each)
  const all = coinsWords(currency, totals)
  const text = `${speaker.who} ${verb} out ${things} each to ${names}: ${all} in all.`
  return { text, ...(note && { note }), ready: true }
}

/**
 * The hand-out a dialog makes, as it's sent, with the words the tray keeps of it: what each gets,
 * to whom, with the sheet's abbreviations for what else the game used.
 * @param name - The character's name; `mover` too, at the Gamemaster's page.
 */
export function handOutMove(
  to: readonly MoveEnd[],
  each: Record<string, number>,
  currency: readonly SheetCurrency[],
  { name, gm }: { name: string; gm: boolean },
): Parameters<HandOutDialogProps['onHandOut']>[0] {
  return {
    each: to.map(({ id }) => id),
    currency: each,
    words: {
      verb: 'handOut',
      things: coinsWords(currency, each),
      other: name,
      among: namesWords(to.map(end => end.name)),
      ...(gm && { mover: name }),
      abbreviations: coinAbbreviations(currency),
    },
  }
}
