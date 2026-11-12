import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { FavoriteOrderContext } from '@/features/sheet/components/favoriting/use-favorite-choice'
import { movable, stepOrders } from '@/features/sheet/utils/favorite-order'
import type { FavoriteMoves } from '@/features/sheet/components/favoriting/types'
import type { FavoriteEntry } from '@/types/sending-stone'

/** What a line among the rolls calls an order made in Reorder, which moves many at once. */
const REORDERED = 'Favorites'

/**
 * The favorites as their list shows them, from module 0.47.0: in the order on its way, if one is,
 * else the sheet's; which may move, where the pane takes orders and two or more may; whether
 * Reorder is open; and where each row's menu may move it, Move up or Move down, each sent at once.
 * Reorder closed, focus goes back to its button.
 * @param reorder - Reorder's button, beneath the list.
 * @returns the entries in order, those that move, whether reordering is offered and open, `open`,
 *   `close` and `save` for Reorder, and `movesOf`, by a row's key and name, for its menu.
 */
export function useFavoriteList(
  entries: FavoriteEntry[],
  reorder: RefObject<HTMLButtonElement | null>,
) {
  const ordering = use(FavoriteOrderContext)
  const [open, setOpen] = useState(false)
  const arranged = ordering.arrange(entries)
  const moving = useMemo(
    () => arranged.filter(entry => movable(entry)),
    [arranged],
  )
  const offered = ordering.on && moving.length > 1
  const reordering = offered && open
  // Closed, by Cancel or Save order, focus goes back to Reorder, drawn again in its place.
  const was = useRef(reordering)
  useEffect(() => {
    if (was.current && !reordering) reorder.current?.focus()
    was.current = reordering
  }, [reordering, reorder])
  const { save } = ordering
  const keys = moving.map(entry => entry.key).join('\n')

  const movesOf = useCallback(
    (key: string, name: string): FavoriteMoves | undefined => {
      const steps = offered ? stepOrders(keys.split('\n'), key) : undefined
      if (!steps) return undefined
      const { up, down } = steps
      return {
        ...(up && { up: () => save(up, name) }),
        ...(down && { down: () => save(down, name) }),
      }
    },
    [offered, keys, save],
  )

  return {
    arranged,
    moving,
    offered,
    reordering,
    open: () => setOpen(true),
    close: () => setOpen(false),
    save: (order: string[]) => {
      save(order, REORDERED)
      setOpen(false)
    },
    movesOf,
  }
}
