import { createElement, useCallback, useState, type ReactNode } from 'react'
import { ItemMenu } from './item-menu'
import { effectItems, menuItems } from './utils'
import type { Opened } from './types'
import type { EffectChoice } from '../effect-controls/types'
import type { FavoriteChoice, FavoriteMoves } from '../favoriting/types'
import type { PrepareChoice } from '../preparing/types'
import type { MenuPoint } from '@/features/rolling/types'

/**
 * A row's own menu: what else is done with it, opened on a right-click or long-press of its row:
 * from module 0.37.0 Add to favorites or Remove from favorites, then for a spell from module 0.42.1
 * Prepare or Unprepare, then for an item Send to…, and from module 0.33.0 Remove…, and for one of
 * the character's own effects from module 0.39.0 Turn off or Turn on, then Delete…, each where it
 * may be done; and among the favorites, from module 0.47.0, Move up and Move down, after its
 * favorites entry, or alone for a row with none, as spell slots. Nothing where none may.
 * @param send - Opens Send to… for it.
 * @param remove - Opens Remove… for it, and whether it waits, as while it's on its way.
 * @param favorite - Adds it to the favorites, or removes it, and whether it waits.
 * @param moves - Where it may move among the favorites; its favorites entry's unless given.
 * @param prepare - Prepares the spell, or unprepares it, and whether it waits, from module 0.42.1.
 * @param effect - Turns the effect off or on, as its `ops` say, and whether it waits.
 * @param onDelete - Opens the effect's Delete… confirmation, where its `ops` offer it.
 */
export function useItemMenu(
  name: string,
  {
    send,
    remove,
    favorite,
    moves = favorite?.moves,
    prepare,
    effect,
    onDelete,
  }: Readonly<{
    send?: () => void
    remove?: { open: () => void; waiting: boolean }
    favorite?: FavoriteChoice
    /**
     * Where it may move among the favorites (module 0.47.0): its favorites entry's, unless given
     * alone, as for spell slots, which have no entry of their own (ROADMAP item 47).
     */
    moves?: FavoriteMoves
    /** Prepares the spell, or unprepares it, and whether it waits, from module 0.42.1. */
    prepare?: PrepareChoice
    effect?: EffectChoice
    onDelete?: () => void
  }>,
): {
  onMenu?: (anchor: HTMLElement, point?: MenuPoint) => void
  menu: ReactNode
} {
  const [opened, setOpened] = useState<Opened>()
  const onMenu = useCallback(
    (anchor: HTMLElement, point?: MenuPoint) => setOpened({ anchor, point }),
    [],
  )
  const effects = effectItems(effect, onDelete)
  if (
    !send &&
    !remove &&
    !favorite &&
    !moves &&
    !prepare &&
    effects.length === 0
  ) {
    // Nothing to do with it, as while the game takes none of it or once the last of it has gone:
    // a menu left open closes, rather than opening again by itself, at a row that may be gone, and
    // taking focus, once there is again.
    if (opened) setOpened(undefined)
    return { menu: undefined }
  }
  const items = menuItems({ favorite, moves, prepare, send, remove, effects })
  const menu =
    opened &&
    createElement(ItemMenu, {
      opened,
      name,
      items,
      onClose: () => setOpened(undefined),
      favorite,
      moves,
      prepare,
      send,
      remove,
      effect,
      onDelete,
    })
  return { onMenu, menu }
}
