import { MOST_MOVED } from '@/constants/sending-stone'
import { typedCount } from '@/features/transfers/components/amount-field/utils'
import type { SheetCurrency } from '@/types/sending-stone'

/**
 * Whether what's typed for a coin may be added, taken away or handed out: nothing, as none, or a
 * whole number up to the most the game takes of a coin at once, whatever the character holds.
 */
export function amountFits(text: string): boolean {
  if (text === '') return true
  const count = typedCount(text)
  return count !== undefined && count <= MOST_MOVED
}

/**
 * The coins typed, by key, leaving out those with none; or nothing, while any is typed as more
 * than the game takes at once, or not as a number, or none at all is.
 * @param currency - The sheet's coins: only what's typed for one of them counts.
 * @param value - What's typed, by coin.
 */
export function amountsTyped(
  currency: readonly SheetCurrency[],
  value: Readonly<Record<string, string>>,
): Record<string, number> | undefined {
  const typed: Record<string, number> = {}
  for (const { id } of currency) {
    const text = value[id] ?? ''
    if (!amountFits(text)) return undefined
    const count = typedCount(text) ?? 0
    if (count >= 1) typed[id] = count
  }
  return Object.keys(typed).length > 0 ? typed : undefined
}
