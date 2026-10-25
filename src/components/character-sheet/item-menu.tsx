'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { Send, Star, StarOff, Trash2 } from 'lucide-react'
import { ChoiceMenu, type MenuItem, type MenuPoint } from './roll-menu'
import type { FavoriteChoice } from './favoriting'

/** Add to favorites, in a row's menu, from module 0.37.0. */
const ADD_FAVORITE: MenuItem<'favorite'> = {
  id: 'favorite',
  label: 'Add to favorites',
  icon: Star,
  tint: 'text-gold-text',
}

/** Remove from favorites, in a row's menu, from module 0.37.0. */
const REMOVE_FAVORITE: MenuItem<'favorite'> = {
  id: 'favorite',
  label: 'Remove from favorites',
  icon: StarOff,
  tint: 'text-text-secondary',
}

/** Send to…, in an item's menu: from module 0.32.0's feedback. */
const SEND_TO: MenuItem<'send'> = {
  id: 'send',
  label: 'Send to…',
  icon: Send,
  tint: 'text-primary',
}

/** Remove…, in an item's menu, on a character's sheet: from module 0.33.0. */
const REMOVE: MenuItem<'remove'> = {
  id: 'remove',
  label: 'Remove…',
  icon: Trash2,
  tint: 'text-danger',
}

/** Where the menu was opened: the row, and where on it, if a pointer opened it. */
type Opened = { anchor: HTMLElement; point?: MenuPoint }

/**
 * A row's own menu: what else is done with it, opened on a right-click or long-press of its row:
 * from module 0.37.0 Add to favorites or Remove from favorites, then for an item Send to…, and from
 * module 0.33.0 Remove…, each where it may be done. Nothing where none may.
 * @param send - Opens Send to… for it.
 * @param remove - Opens Remove… for it, and whether it waits, as while it's on its way.
 * @param favorite - Adds it to the favorites, or removes it, and whether it waits.
 */
export function useItemMenu(
  name: string,
  {
    send,
    remove,
    favorite,
  }: Readonly<{
    send?: () => void
    remove?: { open: () => void; waiting: boolean }
    favorite?: FavoriteChoice
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
  if (!send && !remove && !favorite) {
    // Nothing to do with it, as while the game takes none of it or once the last of it has gone:
    // a menu left open closes, rather than opening again by itself, at a row that may be gone, and
    // taking focus, once there is again.
    if (opened) setOpened(undefined)
    return { menu: undefined }
  }
  const items: MenuItem<'favorite' | 'send' | 'remove'>[] = [
    // First, as the one that changes nothing in the game but where the sheet lists it; while it's
    // on its way, it waits, saying why.
    ...(favorite
      ? [
          {
            ...(favorite.op === 'add' ? ADD_FAVORITE : REMOVE_FAVORITE),
            ...(favorite.waiting && { disabled: 'It’s on its way already' }),
          },
        ]
      : []),
    ...(send ? [SEND_TO] : []),
    // While it, what's in it or what it's in is on its way from here, it waits, saying why.
    ...(remove
      ? [
          remove.waiting
            ? { ...REMOVE, disabled: 'It’s on its way already' }
            : REMOVE,
        ]
      : []),
  ]
  const menu = opened && (
    <ChoiceMenu
      anchor={opened.anchor}
      point={opened.point}
      title={name}
      items={items}
      onClose={() => setOpened(undefined)}
      onChoose={choice => {
        // The row has focus as the dialog opens, so that the browser gives it back to the row,
        // not to the menu item that's gone, once the dialog closes.
        opened.anchor.focus({ preventScroll: true })
        setOpened(undefined)
        if (choice === 'favorite') favorite?.choose()
        else if (choice === 'send') send?.()
        else remove?.open()
      }}
    />
  )
  return { onMenu, menu }
}
