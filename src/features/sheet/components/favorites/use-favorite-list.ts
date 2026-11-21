import {
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { FavoriteOrderContext } from '@/features/sheet/components/favoriting/use-favorite-choice'
import { movable, stepOrders } from '@/features/sheet/utils/favorite-order'
import { rowControlOf } from '@/utils/focus-beside'
import type { FavoriteMoves } from '@/features/sheet/components/favoriting/types'
import type { FavoriteEntry } from '@/types/sending-stone'

/** What a line among the rolls calls an order made in Reorder, which moves many at once. */
const REORDERED = 'Favorites'

/**
 * Gives a favorite's row focus where focus was lost, as it is with the row it was on, drawn anew
 * in the other of two lists (ROADMAP item 74); never where focus is somewhere else. What takes it
 * is the row's own control (`rowControlOf`), as its own menu opens from it: what opens it, the row
 * itself where it takes focus for its menu, as spell slots' does, or its first button, an action's
 * name or a check's roll; never a row listed inside it once it's open.
 * @param row - The favorite's row, by its place among the card's rows.
 */
function focusRowIfLost(row: Element | undefined): void {
  const active = document.activeElement
  if (active && active !== document.body && active.isConnected) return
  rowControlOf(row)?.focus()
}

/**
 * The favorites as their list shows them, from module 0.47.0: in the order on its way, if one is,
 * else the sheet's; which may move, where the pane takes orders and two or more may; whether
 * Reorder is open; and where each row's menu may move it, Move up or Move down, each sent at once.
 * Reorder closed, focus goes back to its button. A favorite moved from its menu keeps focus where
 * it's drawn next, in the other of two lists too (ROADMAP item 74), where the list shows the move
 * at once and focus was lost with its row.
 * @param reorder - Reorder's button, beneath the list.
 * @param card - The card the rows are in, each favorite one row of its lists, in order.
 * @returns the entries in order, those that move, whether reordering is offered and open, `open`,
 *   `close` and `save` for Reorder, and `movesOf`, by a row's key and name, for its menu.
 */
export function useFavoriteList(
  entries: FavoriteEntry[],
  reorder: RefObject<HTMLButtonElement | null>,
  card: HTMLElement | null,
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
  // A favorite moved from its menu, and the order that moves it, until the list's next commit,
  // which shows that order: forgotten then, whatever it shows, so that no later one takes focus.
  const moved = useRef<{ key: string; order: string }>(undefined)
  useLayoutEffect(() => {
    const held = moved.current
    moved.current = undefined
    if (held?.order !== keys) return
    const at = arranged.findIndex(entry => entry.key === held.key)
    focusRowIfLost(card?.querySelectorAll(':scope > ul > li')[at])
  })

  const movesOf = useCallback(
    (key: string, name: string): FavoriteMoves | undefined => {
      const steps = offered ? stepOrders(keys.split('\n'), key) : undefined
      if (!steps) return undefined
      const move = (order: string[]) => () => {
        moved.current = { key, order: order.join('\n') }
        save(order, name)
      }
      const { up, down } = steps
      return {
        ...(up && { up: move(up) }),
        ...(down && { down: move(down) }),
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
