import { ModifyRoll } from '../modify-roll/modify-roll'
import { RollMenu } from '../roll-menu/roll-menu'
import { Modal } from '@/components/modal/modal'
import { formatModifier } from '@/utils/format-modifier'
import type { D20Menu } from './types'
import type { RollChoice, RollTarget } from '../../types'
import type { SheetRoll } from '@/types/roll'

/**
 * What `useD20Rolls` puts on the page: the menu of other ways to roll a check, save or attack,
 * while it's open, and the dialog that modifies the roll first.
 */
export function D20Dialogs({
  menu,
  setMenu,
  modifying,
  setModifying,
  choose,
  onRoll,
}: Readonly<{
  menu?: D20Menu
  setMenu: (menu?: D20Menu) => void
  modifying?: RollTarget
  setModifying: (target?: RollTarget) => void
  choose: (target: RollTarget, choice: RollChoice) => void
  onRoll: (roll: SheetRoll) => void
}>) {
  return (
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
}
