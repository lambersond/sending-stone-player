import { switchOn } from '@/utils/features'
import type { CoinsCover, CoinsInput } from '@/types/roll'
import type { SheetCurrency, SheetInventory } from '@/types/sending-stone'
import type { RollRefusal } from '@/utils/requests/types'

// How this app checks coins added to a character and taken away (module 0.48.0), and a character's
// coins handed out, before the Gamemaster's module is sent them: whether the game takes them now,
// and whether the coins a sheet showed last can pay what's taken. The module pays as its own rule
// has it, a larger coin broken first, then smaller ones, and says which coins went; the app copies
// none of that, only whether the coins are worth enough, by the rates the sheet sends. The module
// checks it all again, live, in the game: these checks only spare a player a change the game would
// refuse, and say beforehand that other coins will pay.

/**
 * How far from a whole number a coin's worth in another may be and still count as one, as the
 * module has it: a world's own rates may be fractions that don't divide exactly.
 */
const NEARLY = 1e-6

/**
 * Whether the game adds and takes away a campaign's characters' coins now: its Gamemaster lets its
 * players, and the Gamemaster's module is fetching, as `removalsAvailable` reads it of removals.
 */
export function coinsAvailable(
  campaign: { coinsEnabled: boolean; bridgePolledAt: Date | null },
  now = Date.now(),
): boolean {
  return switchOn(campaign, 'coinsEnabled', now)
}

/**
 * The whole coins a sheet shows of a coin: dnd5e 6 may show part of one, which is never paid,
 * broken or counted.
 */
export function wholeCoins(coin: Pick<SheetCurrency, 'value'>): number {
  return Math.max(0, Math.floor(coin.value))
}

/** A ratio as a whole number of 1 or more, or nothing where it isn't one, within NEARLY. */
function whole(ratio: number): number | undefined {
  const count = Math.round(ratio)
  return count >= 1 && Math.abs(ratio - count) < NEARLY ? count : undefined
}

/**
 * What each of a sheet's coins with a rate is worth, counted in the smallest of them; or nothing
 * where the game may refuse a payment the coins are worth, which it does only where a coin isn't
 * worth a whole number of every coin worth less, as in a world whose own rates don't divide one
 * another. dnd5e's own always do, and so do two coins worth the same.
 */
function coinWorths(
  currency: SheetCurrency[],
): ReadonlyMap<string, number> | undefined {
  const rated = currency.flatMap(({ id, conversion }) =>
    typeof conversion === 'number' && conversion > 0
      ? [{ id, conversion }]
      : [],
  )
  const divide = rated.every(larger =>
    rated.every(
      smaller =>
        smaller.conversion < larger.conversion ||
        whole(smaller.conversion / larger.conversion) !== undefined,
    ),
  )
  if (!divide) return undefined
  const smallest = Math.max(...rated.map(({ conversion }) => conversion))
  return new Map(
    rated.map(({ id, conversion }) => [id, whole(smallest / conversion) ?? 1]),
  )
}

/**
 * Whether the coins a sheet shows can pay these, each a whole number of a coin by its key: each
 * from its own coins (`held`); or, of the largest coin there are too few of (`coin`), with the
 * sheet's other coins, which the game uses where its campaign lets it, a larger coin broken first
 * and then smaller ones, wherever they're worth as much together (`other`), and never where they
 * aren't (`short`). Where a coin there are too few of has no rate, which only its own coins pay,
 * or the sheet's rates don't divide one another, the app can't tell and the game decides
 * (`unknown`). A coin with no rate there's enough of is paid from its own coins, and counts for
 * nothing else.
 * @param currency - The sheet's coins, in its order, which is dnd5e's: the largest first.
 * @param pay - How many of each coin to pay, by key.
 */
export function coinsCovered(
  currency: SheetCurrency[],
  pay: Readonly<Record<string, number>>,
): CoinsCover {
  const held = new Map(currency.map(coin => [coin.id, wholeCoins(coin)]))
  const paid = Object.entries(pay)
  const short = new Set(
    paid.flatMap(([id, count]) => (count > (held.get(id) ?? 0) ? [id] : [])),
  )
  if (short.size === 0) return { state: 'held' }
  // The largest of them, as the sheet lists its coins; one it doesn't list, as named.
  const coin = currency.find(({ id }) => short.has(id))?.id ?? [...short][0]
  const worths = coinWorths(currency)
  if (!worths || [...short].some(id => !worths.has(id))) {
    return { state: 'unknown', coin }
  }
  const worth = (counts: Iterable<readonly [string, number]>) => {
    let total = 0
    for (const [id, count] of counts) total += count * (worths.get(id) ?? 0)
    return total
  }
  const [has, owes] = [worth(held), worth(paid)]
  // Counts past what a number holds exactly are the game's to decide.
  if (!Number.isSafeInteger(has) || !Number.isSafeInteger(owes)) {
    return { state: 'unknown', coin }
  }
  return { state: has >= owes ? 'other' : 'short', coin }
}

/** What a hand-out takes from its giver in all: each coin's count for every character picked. */
export function coinTotals(
  each: Readonly<Record<string, number>>,
  count: number,
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(each).map(([id, coins]) => [id, coins * count]),
  )
}

/**
 * Why coins can't be added or taken away, as the sheet last sent has them: a coin it doesn't list
 * (`gone`); or, taken away, coins the sheet's can't pay (`short`): worth too little together, or
 * more of a coin than it shows where the campaign doesn't pay with other coins (`change` off).
 * Where the app can't tell, the game decides.
 * @param change - Whether the campaign pays with other coins where a character is short of one.
 */
export function checkCoins(
  coins: CoinsInput,
  sheet: { inventory?: SheetInventory } | undefined,
  change: boolean,
): Extract<RollRefusal, 'gone' | 'short'> | undefined {
  const currency = sheet?.inventory?.currency
  if (!currency) return 'gone'
  const listed = new Set(currency.map(({ id }) => id))
  if (Object.keys(coins.currency).some(id => !listed.has(id))) return 'gone'
  if (coins.op === 'add') return undefined
  const { state } = coinsCovered(currency, coins.currency)
  const refused = change ? state === 'short' : state !== 'held'
  return refused ? 'short' : undefined
}
