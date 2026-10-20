'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { Send } from 'lucide-react'
import { ChoiceMenu, type MenuItem, type MenuPoint } from './roll-menu'

/** Send to…, in an item's menu: from module 0.32.0's feedback. */
const SEND_TO: MenuItem<'send'> = {
  id: 'send',
  label: 'Send to…',
  icon: Send,
  tint: 'text-primary',
}

/** Where the menu was opened: the row, and where on it, if a pointer opened it. */
type Opened = { anchor: HTMLElement; point?: MenuPoint }

/**
 * An item's own menu: what else is done with it, opened on a right-click or long-press of its row.
 * Nothing where it can't be sent.
 * @param send - Opens Send to… for it.
 */
export function useItemMenu(
  name: string,
  send?: () => void,
): {
  onMenu?: (anchor: HTMLElement, point?: MenuPoint) => void
  menu: ReactNode
} {
  const [opened, setOpened] = useState<Opened>()
  const onMenu = useCallback(
    (anchor: HTMLElement, point?: MenuPoint) => setOpened({ anchor, point }),
    [],
  )
  if (!send) return { menu: undefined }
  const menu = opened && (
    <ChoiceMenu
      anchor={opened.anchor}
      point={opened.point}
      title={name}
      items={[SEND_TO]}
      onClose={() => setOpened(undefined)}
      onChoose={() => {
        // The row has focus as the dialog opens, so that the browser gives it back to the row,
        // not to the menu item that's gone, once the dialog closes.
        opened.anchor.focus({ preventScroll: true })
        setOpened(undefined)
        send()
      }}
    />
  )
  return { onMenu, menu }
}
