'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { Send, Trash2 } from 'lucide-react'
import { ChoiceMenu, type MenuItem, type MenuPoint } from './roll-menu'

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
 * An item's own menu: what else is done with it, opened on a right-click or long-press of its row:
 * Send to…, and from module 0.33.0 Remove…, each where it may be done. Nothing where neither may.
 * @param send - Opens Send to… for it.
 * @param remove - Opens Remove… for it, and whether it waits, as while it's on its way.
 */
export function useItemMenu(
  name: string,
  {
    send,
    remove,
  }: Readonly<{
    send?: () => void
    remove?: { open: () => void; waiting: boolean }
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
  if (!send && !remove) {
    // Nothing to send or remove, as while the game takes neither or once the last of it has gone:
    // a menu left open closes, rather than opening again by itself, at a row that may be gone, and
    // taking focus, once there is again.
    if (opened) setOpened(undefined)
    return { menu: undefined }
  }
  const items: MenuItem<'send' | 'remove'>[] = [
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
        if (choice === 'send') send?.()
        else remove?.open()
      }}
    />
  )
  return { onMenu, menu }
}
