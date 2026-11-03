'use client'

import { useRef } from 'react'
import { actionTitle } from '../action-entry/utils'
import { AloneChoices } from './alone-choices'
import { Choices } from './choices'
import { ALONE_SPEND_KEY } from './constants'
import { NO_CASTS } from './utils'
import { Modal } from '@/components/modal/modal'
import type { Picked, Picking } from './types'
import type { Belonging } from '@/features/sheet/types'
import type { CastIndex, SheetSpellSection } from '@/types/sending-stone'
import type { TableCombat } from '@/types/table'

/*
 * What an attack or the use of a spell or feature is made with, chosen as it's made: whom at, and
 * with which spell slot, ammunition or attack mode, or at which level a spell an item casts is
 * cast, where there's a choice; and for one that enchants, how, and which item. And since module
 * 0.41.0 damage on its own, at the level chosen, in the attack mode and with the ammunition chosen,
 * and whether it spends what its use would.
 */

/** Nothing of the character's to enchant, as for a sheet that lists nothing. */
const NO_BELONGINGS: ReadonlyMap<string, Belonging> = new Map()

/**
 * What an attack, or a spell or feature used, is made with, chosen as it's made: the spell slot,
 * or the level a spell an item casts is cast at, with the item's charges it spends there,
 * ammunition and attack mode, where there's more than one, each preset as the game would have it;
 * and whom at. An attack, or a use at one target, is made at the one tapped, or at no one; a use at
 * more, or at an area, at those ticked, as many as it takes at the level it's cast at, as is an
 * area attack where the game makes it so; one with no one to pick, at once. A use may be made at
 * its user, as Self, where it's offered: first, and marked the default, or ticked already, for one
 * made there by default, as a potion. One that enchants is used at no one: with the way it
 * enchants, of those it offers at the level chosen, and for one that enchants another item, the
 * item tapped, or none, to leave on its card.
 */
export function UsePicker({
  picking,
  combat,
  spellbook,
  casts = NO_CASTS,
  belongings = NO_BELONGINGS,
  last,
  areas = false,
  selfTargets = false,
  spendKey = ALONE_SPEND_KEY,
  onPick,
  onClose,
}: Readonly<{
  picking?: Picking
  combat?: TableCombat
  spellbook: SheetSpellSection[]
  /** How each spell an item casts is cast, by its copy's id. */
  casts?: CastIndex
  /** What the character has that an enchantment may be put on, by id. */
  belongings?: ReadonlyMap<string, Belonging>
  /** The combatant last attacked, if any. */
  last?: string
  /** Whether the game makes an area attack at the combatants picked. */
  areas?: boolean
  /** Whether the game makes a use at its user as asked, from module 0.22.0. */
  selfTargets?: boolean
  /**
   * Where this device keeps the Spend switch of damage on its own for this character, from module
   * 0.41.0: `ALONE_SPEND_KEY`, then its seat and pane.
   */
  spendKey?: string
  onPick: (picked: Picked) => void
  onClose: () => void
}>) {
  // Damage on its own's picker gives focus to the choice made in its first row of chips, or to
  // its switch where it shows none (module 0.41.0).
  const first = useRef<HTMLElement>(null)
  let title = ''
  if (picking) {
    title =
      picking.kind === 'attack'
        ? picking.request.label
        : actionTitle(picking.action)
  }
  return (
    <Modal
      open={picking !== undefined}
      onClose={onClose}
      title={title}
      initialFocus={picking?.kind === 'alone' ? first : undefined}
    >
      {picking?.kind === 'alone' && (
        <AloneChoices
          picking={picking}
          spellbook={spellbook}
          spendKey={spendKey}
          first={first}
          onPick={onPick}
        />
      )}
      {picking && picking.kind !== 'alone' && (
        <Choices
          picking={picking}
          combat={combat}
          spellbook={spellbook}
          casts={casts}
          belongings={belongings}
          last={last}
          areas={areas}
          selfTargets={selfTargets}
          onPick={onPick}
        />
      )}
    </Modal>
  )
}
