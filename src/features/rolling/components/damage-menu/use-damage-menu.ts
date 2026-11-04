import { createElement, useState, type ReactNode } from 'react'
import { DamageDialogs } from './damage-dialogs'
import type { DamageMenu } from './types'
import type {
  DamageSubject,
  MenuPoint,
  RollChoice,
} from '@/features/rolling/types'

/**
 * The menu of ways to roll damage or healing, and the dialog that changes its dice first, which
 * are in `dialogs`, to be put on the page.
 */
export function useDamageMenu(): {
  open: (anchor: HTMLElement, subject: DamageSubject, point?: MenuPoint) => void
  dialogs: ReactNode
} {
  const [menu, setMenu] = useState<DamageMenu>()
  const [modifying, setModifying] = useState<DamageSubject>()
  const choose = (subject: DamageSubject, choice: RollChoice) => {
    setMenu(undefined)
    switch (choice) {
      case 'critical': {
        subject.onChoose({ critical: true })
        break
      }
      case 'maximize': {
        subject.onChoose({ modifiers: { maximize: true } })

        break
      }
      case 'modify-damage': {
        setModifying(subject)
        // No default
        break
      }
    }
  }
  const dialogs = createElement(DamageDialogs, {
    menu,
    setMenu,
    modifying,
    setModifying,
    choose,
  })
  return {
    open: (anchor, subject, point) => setMenu({ anchor, subject, point }),
    dialogs,
  }
}
