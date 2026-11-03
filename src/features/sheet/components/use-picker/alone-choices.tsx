'use client'

import { Chip } from './chip'
import { ChipRow } from './chip-row'
import { Go } from './go'
import { SpendSwitch } from './spend-switch'
import { useAloneChoices } from './use-alone-choices'
import { alonePicked, poolLabel } from './utils'
import { useTableRole } from '@/hooks/use-table-api'
import { poolName } from '@/utils/action-groups'
import { seatWords } from '@/utils/seat-words'
import type { Picked, Picking } from './types'
import type { SheetSpellSection } from '@/types/sending-stone'
import type { Ref } from 'react'

/**
 * Damage on its own's choices, from module 0.41.0 (round 0.41.0 §2.3, §2.4, §2.11.2): said first
 * where it goes and for whom to apply; the slots it may be rolled at, each with how many are left
 * while the switch spends one, an empty one then not to be chosen; the ammunition, likewise, and
 * the weapon's modes; then a switch to spend what its use would, named for what it spends as
 * picked, kept on this device for the character, on the first time; and Roll damage, or Roll
 * healing, which goes on with what was picked, the slot always where the spell is cast with one.
 * A screen reader hears what the switch spends once a pick changes it, as its name changes out of
 * focus.
 * @param first - What takes focus as it opens: the choice made in its first row of chips, or the
 *   switch where it shows none.
 */
export function AloneChoices({
  picking,
  spellbook,
  spendKey,
  first,
  onPick,
}: Readonly<{
  picking: Extract<Picking, { kind: 'alone' }>
  spellbook: SheetSpellSection[]
  spendKey: string
  first: Ref<HTMLElement>
  onPick: (picked: Picked) => void
}>) {
  const { healing } = picking
  const role = useTableRole()
  const { game } = seatWords(role)
  const {
    pools,
    ammunition,
    modes,
    picks,
    choose,
    on,
    label,
    said,
    slotSpent,
    ammoSpent,
    turn,
  } = useAloneChoices({ picking, spellbook, spendKey })
  const what = healing ? 'healing' : 'damage'
  // The first row of chips shown takes focus as it opens, at its choice; else the switch.
  const rows = [
    pools.length > 0 && 'pools',
    ammunition.length > 0 && 'ammunition',
    modes.length > 0 && 'modes',
  ].filter(Boolean)
  const focusOf = (row: string, selected: boolean) =>
    row === rows[0] && selected ? first : undefined
  return (
    <div className='flex flex-col gap-4'>
      <p className='text-sm text-text-secondary'>
        Its {what} goes to {game} on its own, for{' '}
        {role === 'gm' ? 'you' : 'your Gamemaster'} to apply.
      </p>
      {pools.length > 0 && (
        <ChipRow label='At level'>
          {pools.map(pool => (
            <Chip
              key={pool.id}
              ref={focusOf('pools', pool.id === picks.slot)}
              tall
              selected={pool.id === picks.slot}
              disabled={slotSpent && pool.value <= 0}
              onSelect={() => choose({ slot: pool.id })}
              label={slotSpent ? poolLabel(pool) : pool.label}
            >
              {poolName(pool)}
              {slotSpent && (
                <span className='font-normal text-text-secondary'>
                  {' '}
                  · {pool.value} left
                </span>
              )}
            </Chip>
          ))}
        </ChipRow>
      )}
      {ammunition.length > 0 && (
        <ChipRow label='Ammunition'>
          {ammunition.map(({ id, name, quantity }) => (
            <Chip
              key={id}
              ref={focusOf('ammunition', id === picks.ammunition)}
              tall
              selected={id === picks.ammunition}
              disabled={ammoSpent && quantity <= 0}
              onSelect={() => choose({ ammunition: id })}
              label={`${name}, ${quantity} left`}
            >
              {name}{' '}
              <span className='font-normal text-text-secondary'>
                · {quantity}
              </span>
            </Chip>
          ))}
        </ChipRow>
      )}
      {modes.length > 0 && (
        <ChipRow label='Mode'>
          {modes.map(({ value, label: name }) => (
            <Chip
              key={value}
              ref={focusOf('modes', value === picks.attackMode)}
              tall
              selected={value === picks.attackMode}
              onSelect={() => choose({ attackMode: value })}
              label={name}
            >
              {name}
            </Chip>
          ))}
        </ChipRow>
      )}
      {label && (
        <SpendSwitch
          ref={rows.length === 0 ? first : undefined}
          label={label}
          on={on}
          onChange={turn}
        />
      )}
      <p aria-live='polite' className='sr-only'>
        {said}
      </p>
      <Go
        label={healing ? 'Roll healing' : 'Roll damage'}
        onGo={() => onPick(alonePicked(picks, { modes, label, on }))}
      />
    </div>
  )
}
