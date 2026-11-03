import { createElement, useState, type ReactNode } from 'react'
import { LinkMenusDialogs } from './link-menus-dialogs'
import { useDamageMenu } from '@/features/rolling/components/damage-menu/use-damage-menu'
import type { LinkMenus, Modifying, OpenMenu } from './types'
import type { DescriptionActions } from '../description-actions/types'

/**
 * The menus a description's links open, one at a time, and the dialogs that modify a saving throw
 * or check, or damage, before it's rolled, which are in `dialogs`, to be put on the page beside the
 * description, never in it.
 */
export function useLinkMenus(actions?: DescriptionActions): {
  menus: LinkMenus
  dialogs: ReactNode
} {
  const [menu, setMenu] = useState<OpenMenu>()
  const [modifying, setModifying] = useState<Modifying>()
  const damage = useDamageMenu()
  const dialogs = createElement(LinkMenusDialogs, {
    menu,
    setMenu,
    modifying,
    setModifying,
    actions,
    damageDialogs: damage.dialogs,
  })
  return {
    menus: {
      open: setMenu,
      modify: (target, dc) => setModifying({ target, dc }),
      damage: damage.open,
    },
    dialogs,
  }
}
