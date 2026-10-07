'use client'

import clsx from 'clsx'
import { Crosshair, Skull } from 'lucide-react'
import { Modal } from '@/components/modal'
import type { TableCombat, TableCombatant } from '@/types/table'

/** Who a combatant is, beside its name, as the combat tracker has it. */
const SIDES: Partial<Record<TableCombatant['side'], string>> = {
  party: 'Ally',
}

/** The combatants an attack can be made at: everyone in the combat but the attacker. */
export function targetsOf(combat?: TableCombat): TableCombatant[] {
  return combat?.combatants.filter(combatant => combatant.side !== 'me') ?? []
}

/**
 * Who an attack is made at, chosen as it's made: the combatants of the combat the player sees,
 * the one they last attacked first, then the rest in turn order; or no one.
 */
export function TargetPicker({
  open,
  label,
  combat,
  last,
  onPick,
  onClose,
}: Readonly<{
  open: boolean
  /** What attacks, such as "Longsword attack". */
  label: string
  combat?: TableCombat
  /** The combatant last attacked, if any. */
  last?: string
  /** Told of the combatant picked, or of none. */
  onPick: (combatant?: TableCombatant) => void
  onClose: () => void
}>) {
  const targets = targetsOf(combat)
  const ordered = [
    ...targets.filter(({ id }) => id === last),
    ...targets.filter(({ id }) => id !== last),
  ]
  return (
    <Modal open={open} onClose={onClose} title={label}>
      <p className='mb-3 text-sm text-text-secondary'>Choose who to attack.</p>
      <ul className='flex flex-col gap-1.5'>
        {ordered.map(combatant => (
          <li key={combatant.id}>
            <button
              type='button'
              onClick={() => onPick(combatant)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5',
                combatant.id === last ? 'border-primary' : 'border-border',
              )}
            >
              <Crosshair aria-hidden className='size-4 shrink-0 text-attack' />
              <span
                className={clsx(
                  'min-w-0 flex-1 truncate font-semibold',
                  combatant.defeated && 'text-text-secondary line-through',
                )}
              >
                {combatant.name}
              </span>
              {SIDES[combatant.side] && (
                <span className='shrink-0 text-xs text-text-secondary'>
                  {SIDES[combatant.side]}
                </span>
              )}
              {combatant.defeated && (
                <span className='flex shrink-0 items-center gap-1 text-xs text-text-secondary'>
                  <Skull aria-hidden className='size-3.5' />
                  Defeated
                </span>
              )}
              {combatant.id === last && (
                <span className='shrink-0 text-xs font-semibold text-primary'>
                  Last target
                </span>
              )}
            </button>
          </li>
        ))}
        <li>
          <button
            type='button'
            onClick={() => onPick()}
            className='w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary'
          >
            No target
          </button>
        </li>
      </ul>
    </Modal>
  )
}
