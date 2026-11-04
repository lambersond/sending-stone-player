import { ModifyDamage } from '../modify-roll/modify-damage'
import { RollMenu } from '../roll-menu/roll-menu'
import { Modal } from '@/components/modal/modal'
import { labelsFor } from '@/features/rolling/utils/damage-words'
import type { DamageMenu } from './types'
import type { DamageSubject, RollChoice } from '../../types'

/**
 * What `useDamageMenu` puts on the page: the menu of ways to roll damage or healing, while it's
 * open, and the dialog that changes its dice first.
 */
export function DamageDialogs({
  menu,
  setMenu,
  modifying,
  setModifying,
  choose,
}: Readonly<{
  menu?: DamageMenu
  setMenu: (menu?: DamageMenu) => void
  modifying?: DamageSubject
  setModifying: (subject?: DamageSubject) => void
  choose: (subject: DamageSubject, choice: RollChoice) => void
}>) {
  return (
    <>
      {menu && (
        <RollMenu
          anchor={menu.anchor}
          point={menu.point}
          title={`${menu.subject.label} ${menu.subject.formula}`}
          choices={menu.subject.choices}
          labels={labelsFor(menu.subject)}
          onChoose={choice => choose(menu.subject, choice)}
          onClose={() => setMenu(undefined)}
        />
      )}
      <Modal
        open={modifying !== undefined}
        onClose={() => setModifying(undefined)}
        title={modifying?.healing ? 'Modify healing' : 'Modify damage'}
      >
        {modifying && (
          <ModifyDamage
            subject={modifying}
            onRoll={choice => {
              setModifying(undefined)
              modifying.onChoose(choice)
            }}
            onCancel={() => setModifying(undefined)}
          />
        )}
      </Modal>
    </>
  )
}
