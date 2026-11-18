import { coinAbbreviations, shortCoinWords } from '@/features/transfers/utils'
import { coinsWords } from '@/utils/move-words'
import type { CoinsChosen } from './types'
import type { CoinSpeaker, FormSummary } from '@/features/transfers/types'
import type { CoinsInput, LocalMove } from '@/types/roll'
import type { CoinOp, SheetCurrency } from '@/types/sending-stone'

/** What the dialog's button says: what it'll do, once that's chosen. */
export function coinsLabel(op: CoinOp | undefined): string {
  if (op === 'add') return 'Add coins'
  if (op === 'remove') return 'Remove coins'
  return 'Add or remove'
}

/**
 * What the dialog says it'll do, or what it still needs: whether to add or remove, then how many;
 * and for coins removed that are more of one than the character holds, that other coins pay for
 * the rest, or why it can't be sent.
 * @param currency - The character's coins, as the sheet had them when the dialog opened.
 * @param change - Whether the game pays with other coins where the character is short of one.
 */
export function coinsSummary(
  { op, amounts }: CoinsChosen,
  currency: readonly SheetCurrency[],
  change: boolean,
  speaker: CoinSpeaker,
): FormSummary {
  if (!op) return { text: 'Choose Add or Remove.', ready: false }
  if (!amounts) return { text: 'Choose how many.', ready: false }
  const things = coinsWords(currency, amounts)
  const you = speaker.who === 'You'
  if (op === 'add') {
    return {
      text: `${speaker.who} ${you ? 'add' : 'adds'} ${things}.`,
      ready: true,
    }
  }
  const { note, refused } = shortCoinWords(speaker, currency, amounts, {
    change,
  })
  if (refused) return { text: refused, ready: false }
  const text = `${speaker.who} ${you ? 'remove' : 'removes'} ${things}.`
  return { text, ...(note && { note }), ready: true }
}

/**
 * The change a dialog makes, as it's sent, with the words the tray keeps of it: coins the
 * character received, or paid, with its sheet's abbreviations for what else the game used.
 * @param name - The character's name; `mover` too, at the Gamemaster's page.
 */
export function coinsMove(
  op: CoinOp,
  amounts: Record<string, number>,
  currency: readonly SheetCurrency[],
  { name, gm }: { name: string; gm: boolean },
): { coins: CoinsInput; words: LocalMove } {
  return {
    coins: { op, currency: amounts },
    words: {
      verb: op === 'add' ? 'receive' : 'pay',
      things: coinsWords(currency, amounts),
      other: name,
      ...(gm && { mover: name }),
      ...(op === 'remove' && { abbreviations: coinAbbreviations(currency) }),
    },
  }
}
