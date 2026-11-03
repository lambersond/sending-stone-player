import { createElement } from 'react'
import { TakeButton } from './take-button'
import { PENDING_COINS } from '@/features/transfers/constants'
import { anyCoins } from '@/features/transfers/utils'
import type { TransferControls, Taking } from '@/features/transfers/types'
import type { TableGroup } from '@/types/party'

/**
 * The controls a party's sheet gives its stash: Take beside each item, and its coin, each waiting
 * while what it takes is on its way.
 * @param pending - What's on its way: item ids, and `coins` for coins.
 * @param onTake - Opens the dialog for what's taken.
 */
export function takeControls({
  group,
  pending,
  onTake,
}: Readonly<{
  group: TableGroup
  pending: ReadonlySet<string>
  onTake: (what: Taking['what']) => void
}>): TransferControls {
  return {
    item: item => ({
      aside: createElement(TakeButton, {
        label: `Take ${item.name}`,
        busy: pending.has(item.id),
        onTake: () => onTake({ item }),
      }),
    }),
    coins: currency =>
      anyCoins(currency) &&
      createElement(TakeButton, {
        label: `Take coins from ${group.name}`,
        busy: pending.has(PENDING_COINS),
        onTake: () => onTake({ coins: currency }),
      }),
  }
}
