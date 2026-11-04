'use client'

import { actionTitle, verbOf, viewOf } from '../action-entry/utils'
import { AttackChip } from './attack-chip'
import { DamageChip } from './damage-chip'
import { FormulaChip } from './formula-chip'
import { SaveChip } from './save-chip'
import { UsingChip } from './using-chip'
import { attackSource } from './utils'
import type { ActionRows } from '../action-entry/types'
import type { SheetAction, SheetUses } from '@/types/sending-stone'

/**
 * What an action rolls, each a button of its own: its attack's bonus, its saving throw, its
 * damage or healing, its own formula, or using it in the game. A table lists all but its damage or
 * healing in one cell, and that in its own.
 */
export function ActionChips({
  action,
  view,
  rows,
  uses,
  damage = 'inline',
}: Readonly<{
  action: SheetAction
  view: ReturnType<typeof viewOf>
  rows: ActionRows
  /** The uses its row shows, which a Use spending them, with none left, can't be. */
  uses?: SheetUses | null
  /** Its damage or healing among them, or none, where a table gives it a cell of its own. */
  damage?: 'inline' | 'none'
}>) {
  const { toHit, save } = action
  const name = actionTitle(action)
  return (
    <>
      {toHit !== null && (
        <AttackChip
          name={name}
          toHit={toHit}
          d20={rows.d20}
          source={attackSource(action)}
        />
      )}
      {save && <SaveChip name={name} save={save} onUse={view.uses.save} />}
      {damage === 'inline' && view.formula && (
        <DamageChip
          name={name}
          formula={view.formula}
          healing={view.healing}
          target={view.target}
          damage={rows.damage}
          onUse={view.uses.damage}
          verb={verbOf(action)}
        />
      )}
      {action.rollFormula && (
        <FormulaChip action={action} onRoll={rows.formula} />
      )}
      <UsingChip action={action} view={view} rows={rows} uses={uses} />
    </>
  )
}
