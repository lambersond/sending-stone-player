import { MOST_MOVED } from '@/constants/sending-stone'
import { typedCount } from '@/features/transfers/components/amount-field/utils'
import type { SheetCurrency } from '@/types/sending-stone'

/** The coins there's a whole one of, in the sheet's order, each with as many as may be moved. */
export function movableCoins(
  currency: SheetCurrency[],
): (SheetCurrency & { max: number })[] {
  return currency
    .map(coin => ({
      ...coin,
      max: Math.min(Math.floor(coin.value), MOST_MOVED),
    }))
    .filter(({ max }) => max >= 1)
}

/** Whether what's typed for a coin may be moved: nothing, as none, or a number up to its most. */
export function fits(text: string, max: number): boolean {
  if (text === '') return true
  const count = typedCount(text)
  return count !== undefined && count <= max
}

/**
 * The coins to move, by key, as typed, leaving out those with none; or nothing, while any is typed
 * as more than there is, or not as a number, or none at all is.
 */
export function coinsMoved(
  currency: SheetCurrency[],
  value: Readonly<Record<string, string>>,
): Record<string, number> | undefined {
  const moved: Record<string, number> = {}
  for (const { id, max } of movableCoins(currency)) {
    const text = value[id] ?? ''
    if (!fits(text, max)) return undefined
    const count = typedCount(text) ?? 0
    if (count >= 1) moved[id] = count
  }
  return Object.keys(moved).length > 0 ? moved : undefined
}
