'use client'

import { useState, type ReactNode } from 'react'
import { ModifyRoll } from './modify-roll'
import { RollMenu, type MenuPoint, type RollChoice } from './roll-menu'
import { Modal } from '@/components/modal'
import { formatModifier } from '@/utils/format-modifier'
import { toAdvantage } from '@/utils/roll-mode'
import type { RollTarget } from './roll-button'
import type { SheetRoll } from '@/hooks/use-sheet-roller'

/** What a part of the sheet that rolls a d20 does when tapped, or held for its menu. */
export type RollActions = {
  onRoll: (target: RollTarget) => void
  onMenu: (anchor: HTMLElement, target: RollTarget, point?: MenuPoint) => void
}

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
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    target: RollTarget
    point?: MenuPoint
  }>()
  const [modifying, setModifying] = useState<RollTarget>()

  const tap = (target: RollTarget) =>
    onRoll({
      label: target.label,
      modifier: target.modifier,
      advantage: toAdvantage(target.mode),
      source: target.source,
      explicit: false,
    })
  const openMenu = (
    anchor: HTMLElement,
    target: RollTarget,
    point?: MenuPoint,
  ) => setMenu({ anchor, target, point })
  // A choice from the menu is the player's say on this roll, as in dnd5e's roll dialog.
  const choose = (target: RollTarget, choice: RollChoice) => {
    setMenu(undefined)
    if (choice === 'modify') setModifying(target)
    else if (choice !== 'critical')
      onRoll({
        label: target.label,
        modifier: target.modifier,
        advantage: choice,
        source: target.source,
        explicit: true,
      })
  }

  const dialogs = (
    <>
      {menu && (
        <RollMenu
          anchor={menu.anchor}
          point={menu.point}
          title={`${menu.target.label} ${formatModifier(menu.target.modifier)}`}
          onChoose={choice => choose(menu.target, choice)}
          onClose={() => setMenu(undefined)}
        />
      )}
      <Modal
        open={modifying !== undefined}
        onClose={() => setModifying(undefined)}
        title='Modify roll'
      >
        {modifying && (
          <ModifyRoll
            target={modifying}
            mode={modifying.mode}
            onRoll={request => {
              setModifying(undefined)
              onRoll(request)
            }}
            onCancel={() => setModifying(undefined)}
          />
        )}
      </Modal>
    </>
  )
  return { actions: { onRoll: tap, onMenu: openMenu }, dialogs }
}
