import { useCallback, useMemo } from 'react'
import { ORDER_KEY } from './constants'
import { FAVORITE_SETTLE } from '@/constants/sending-stone'
import { useSettle } from '@/features/sheet/hooks/use-settle'
import {
  arrangeEntries,
  orderTargets,
  placeShown,
  shownOrder,
  targetsOf,
} from '@/features/sheet/utils/favorite-order'
import { targetKey } from '@/utils/favorite-commands'
import type { FavoriteOrder, SentOrder } from './types'
import type { FavoriteTarget, TableRollState } from '@/types/roll'
import type { SheetFavorite } from '@/types/sending-stone'

/**
 * The character's favorites put in order from here (module 0.47.0), where the pane offers
 * favorites and its module takes orders. An order sent is shown at once, and while it's on its way,
 * and once made until the sheet shows it, for up to `FAVORITE_SETTLE`; one that failed or was
 * refused, as one Foundry's sheet changed meanwhile, shows the sheet's own again, its line saying
 * why. A favorite the sheet lists that an order shown doesn't name, as one added meanwhile from a
 * row's menu or in Foundry, is shown where the sheet lists it. Each is sent whole, every favorite
 * the sheet lists but its old-style resources, from the order shown, as the game checks it; the
 * page reads the sheet again as the game answers it.
 * @param send - Sends an order and the one it was made from, and logs it among the rolls, named
 *   for what moved, returning its local id.
 */
export function useFavoriteOrder({
  on,
  favorites,
  states,
  send,
}: Readonly<{
  on: boolean
  favorites: SheetFavorite[]
  states: ReadonlyMap<string, TableRollState>
  send: (
    order: FavoriteTarget[],
    was: FavoriteTarget[],
    label: string,
  ) => string
}>): FavoriteOrder {
  const targets = useMemo(() => orderTargets(favorites), [favorites])
  const sheetKeys = useMemo(
    () => targets.map(target => targetKey(target)),
    [targets],
  )
  const sheetOrder = sheetKeys.join('\n')
  const { sent, last, waitingOf } = useSettle<SentOrder>({
    states,
    settleMs: FAVORITE_SETTLE,
    missing: 'waiting',
    agrees: useCallback(
      ({ keys }: SentOrder) => keys.join('\n') === sheetOrder,
      [sheetOrder],
    ),
  })
  const latest = last(ORDER_KEY)
  const waiting = waitingOf(latest)
  // While one waits, a favorite it doesn't name, as one added meanwhile, is shown where the sheet
  // lists it, and named in what's sent next.
  const shown = useMemo(
    () => (latest && waiting ? shownOrder(latest.keys, sheetKeys) : sheetKeys),
    [latest, waiting, sheetKeys],
  )

  const arrange = useCallback(
    (entries: Parameters<FavoriteOrder['arrange']>[0]) =>
      arrangeEntries(entries, shown),
    [shown],
  )
  const save = useCallback(
    (moved: string[], label: string) => {
      const keys = placeShown(shown, moved)
      if (keys.join('\n') === shown.join('\n')) return
      const id = send(
        targetsOf(keys, targets),
        targetsOf(shown, targets),
        label,
      )
      sent(ORDER_KEY, { id, keys })
    },
    [shown, targets, send, sent],
  )
  return useMemo(() => ({ on, arrange, save }), [on, arrange, save])
}
