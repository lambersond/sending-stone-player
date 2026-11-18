import { coinsCovered, wholeCoins } from '@/utils/coins'
import { coinsWords } from '@/utils/move-words'
import { seatWords } from '@/utils/seat-words'
import type { CoinSpeaker } from './types'
import type { SeatRole } from '@/types/seats'
import type {
  SheetContainer,
  SheetCurrency,
  SheetItem,
} from '@/types/sending-stone'

/** Whether an item may hold anything: a container, unless it's known to hold nothing. */
export function mayHold(item: SheetItem | SheetContainer): boolean {
  return (
    'contents' in item && (item.contents === null || item.contents.length > 0)
  )
}

/** Any whole coin: dnd5e 6 may hold part of one, which can't be moved. */
export function anyCoins(currency: SheetCurrency[] | undefined): boolean {
  return !!currency?.some(coin => Math.floor(coin.value) >= 1)
}

/** Whose coins a dialog changes, as its words say them: the player's, or the character's. */
export function coinSpeaker(role: SeatRole, name: string): CoinSpeaker {
  const { game } = seatWords(role)
  return role === 'gm'
    ? { who: name, hold: 'holds', lack: 'hasn’t', their: 'their', game }
    : { who: 'You', hold: 'hold', lack: 'haven’t', their: 'your', game }
}

/** The sheet's coins' abbreviations, by key, in its order, for telling what the game used. */
export function coinAbbreviations(
  currency: readonly SheetCurrency[],
): Record<string, string> {
  return Object.fromEntries(
    currency.map(({ id, abbreviation }) => [id, abbreviation]),
  )
}

/**
 * What a dialog says where coins taken from a character are more of a coin than it holds (module
 * 0.49.0), by the app's own count of what its coins are worth, which the game's stands over:
 * nothing where it holds them all, or the app can't tell and the game pays with other coins;
 * `note`, said after what it'll do, where its other coins pay; or `refused`, said in its place,
 * where they're worth too little, or the game doesn't pay with other coins.
 * @param pay - All that's taken, by coin: of a hand-out, every share together.
 * @param options - `change`: whether the game pays with other coins. `inAll`: that `pay` is a
 *   hand-out's shares together, which its words then say.
 */
export function shortCoinWords(
  speaker: CoinSpeaker,
  currency: readonly SheetCurrency[],
  pay: Readonly<Record<string, number>>,
  { change, inAll = false }: { change: boolean; inAll?: boolean },
): { note?: string; refused?: string } {
  const cover = coinsCovered([...currency], pay)
  if (cover.state === 'held') return {}
  const { who, hold, lack, their, game } = speaker
  const coin = currency.find(({ id }) => id === cover.coin)
  const abbreviation = coin?.abbreviation ?? cover.coin
  const held = coin ? wholeCoins(coin) : 0
  const all = inAll ? ' in all' : ''
  if (!change) {
    const asked = `${pay[cover.coin].toLocaleString('en')} ${abbreviation}`
    const holds = heldWords(held, abbreviation, inAll ? asked : undefined)
    return {
      refused: `${who} ${hold} ${holds}, and ${game} doesn’t pay with other coins.`,
    }
  }
  if (cover.state === 'unknown') return {}
  if (cover.state === 'short') {
    const paid = `${coinsWords(currency, pay)}${all}`
    return {
      refused: `${who} ${lack} that much: ${paid} is more than ${their} coins are worth.`,
    }
  }
  const holds = heldWords(held, abbreviation)
  return { note: `${who} ${hold} ${holds}, so other coins pay for the rest.` }
}

/**
 * How few of a coin are held, after who holds them: "only 3 gp", or "no gp"; of a hand-out's
 * shares together, "only 20 gp of the 150 gp in all", or "none of the 150 gp in all".
 */
function heldWords(held: number, abbreviation: string, ofAll?: string): string {
  const only = `only ${held.toLocaleString('en')} ${abbreviation}`
  if (ofAll) {
    return held === 0
      ? `none of the ${ofAll} in all`
      : `${only} of the ${ofAll} in all`
  }
  return held === 0 ? `no ${abbreviation}` : only
}
