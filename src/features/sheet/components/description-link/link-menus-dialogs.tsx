'use client'

import { Modal } from '@/components/modal/modal'
import { ModifyRoll } from '@/features/rolling/components/modify-roll/modify-roll'
import { ChoiceMenu } from '@/features/rolling/components/roll-menu/choice-menu'
import type { Modifying, OpenMenu } from './types'
import type { DescriptionActions } from '../description-actions/types'
import type { ReactNode } from 'react'

/**
 * What a description's links open, as `useLinkMenus` puts it on the page: the menu a link opened,
 * the dialog that modifies a saving throw or check before it's rolled, and the damage menu's own.
 */
export function LinkMenusDialogs({
  menu,
  setMenu,
  modifying,
  setModifying,
  actions,
  damageDialogs,
}: Readonly<{
  menu?: OpenMenu
  setMenu: (menu?: OpenMenu) => void
  modifying?: Modifying
  setModifying: (modifying?: Modifying) => void
  actions?: DescriptionActions
  /** The damage menu's, as `useDamageMenu` gives them. */
  damageDialogs: ReactNode
}>) {
  return (
    <>
      {menu && (
        <ChoiceMenu
          anchor={menu.anchor}
          point={menu.point}
          title={menu.title}
          items={menu.items}
          onChoose={id => {
            setMenu(undefined)
            menu.onChoose(id)
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
      {modifying && actions && (
        <Modal open onClose={() => setModifying(undefined)} title='Modify roll'>
          <ModifyRoll
            target={modifying.target}
            mode={modifying.target.mode}
            onRoll={request => {
              setModifying(undefined)
              actions.roll({
                ...request,
                ...(modifying.dc !== undefined && { dc: modifying.dc }),
              })
            }}
            onCancel={() => setModifying(undefined)}
          />
        </Modal>
      )}
      {actions && damageDialogs}
    </>
  )
}
