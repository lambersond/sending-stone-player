import { damageName } from '../../utils/tray-words'
import { DamageButton } from './damage-button'
import { damageDue } from '@/features/rolling/utils/damage-due'
import type { RollDue } from '../../types'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * The damage or healing of an attack or use the game made, to roll while it's due (`damageDue`),
 * after a miss too, as the tray, the rolls' popover and a toast that waits for it all offer it:
 * nothing once it's rolled, nor where there's no way to roll it.
 */
export function DamageDue({
  roll,
  state,
  onRollDamage,
  modifies,
  onTint = false,
}: Readonly<{
  roll: LocalRoll
  state?: TableRollState
  onRollDamage?: RollDue
  modifies?: boolean
  /** On a toast's tint, which its buttons' own tint would make too dark to read. */
  onTint?: boolean
}>) {
  if (!state || !onRollDamage || !damageDue(roll, state)) return
  return (
    <DamageButton
      name={damageName(roll)}
      state={state}
      onRollDamage={onRollDamage}
      modifies={modifies}
      onTint={onTint}
    />
  )
}
