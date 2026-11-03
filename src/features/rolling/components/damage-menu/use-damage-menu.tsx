import { useState, type ReactNode } from 'react'
import { RollMenu } from '../roll-menu/roll-menu'
import { ModifyDamage } from './damage-menu'
import { Modal } from '@/components/modal/modal'
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
  const [menu, setMenu] = useState<{
    anchor: HTMLElement
    subject: DamageSubject
    point?: MenuPoint
  }>()
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
  const dialogs = (
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
  return {
    open: (anchor, subject, point) => setMenu({ anchor, subject, point }),
    dialogs,
  }
}

/** What the menu calls each way, for damage or healing, rolled or used with a spell or feature. */
function labelsFor({
  healing,
  verb,
}: DamageSubject): Partial<Record<RollChoice, string>> {
  const kind = healing ? 'healing' : 'damage'
  return verb
    ? {
        maximize: `${verb} with maximum ${kind}`,
        'modify-damage': `${verb} with ${kind} modified…`,
      }
    : { maximize: `Roll maximum ${kind}`, 'modify-damage': `Modify ${kind}…` }
}
