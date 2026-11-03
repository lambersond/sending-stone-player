import { createElement, useState, type ReactNode } from 'react'
import { D20Dialogs } from './d20-dialogs'
import { toAdvantage } from '@/features/rolling/utils/roll-mode'
import { rollOf } from '@/features/rolling/utils/sheet-rolls'
import type { D20Menu } from './types'
import type {
  RollActions,
  RollTarget,
  MenuPoint,
  RollChoice,
} from '@/features/rolling/types'
import type { SheetRoll } from '@/types/roll'

/**
 * Rolling a check, save or attack from the sheet. A tap rolls it with whatever advantage or
 * disadvantage the character's conditions and features give. A right-click or long-press opens a
 * menu of other ways to roll it, as dnd5e's roll dialog offers them: with advantage, with
 * disadvantage, or modified with extra dice or numbers. The menu and the dialog are in `dialogs`,
 * to be put on the page.
 */
export function useD20Rolls(onRoll: (roll: SheetRoll) => void): {
  actions: RollActions
  dialogs: ReactNode
} {
  const [menu, setMenu] = useState<D20Menu>()
  const [modifying, setModifying] = useState<RollTarget>()

  const tap = (target: RollTarget) =>
    onRoll(rollOf(target, toAdvantage(target.mode), false))
  const openMenu = (
    anchor: HTMLElement,
    target: RollTarget,
    point?: MenuPoint,
  ) => setMenu({ anchor, target, point })
  // A choice from the menu is the player's say on this roll, as in dnd5e's roll dialog.
  const choose = (target: RollTarget, choice: RollChoice) => {
    setMenu(undefined)
    if (choice === 'modify') setModifying(target)
    else if (choice === 'adv' || choice === 'dis') {
      onRoll(rollOf(target, choice, true))
    }
  }

  const dialogs = createElement(D20Dialogs, {
    menu,
    setMenu,
    modifying,
    setModifying,
    choose,
    onRoll,
  })
  return { actions: { onRoll: tap, onMenu: openMenu }, dialogs }
}
