'use client'

import clsx from 'clsx'
import type { DamageModifiers } from '@/types/roll'
import type { SheetAction } from '@/types/sending-stone'

/**
 * The saving throw an action calls for, such as DEX 14: while the Gamemaster's game takes spells
 * and features, a button that uses it there, calling for it.
 */
export function SaveChip({
  name,
  save,
  onUse,
}: Readonly<{
  name: string
  save: NonNullable<SheetAction['save']>
  onUse?: (modifiers?: DamageModifiers) => void
}>) {
  const chip =
    'shrink-0 rounded-lg border border-border px-2 py-1 text-xs font-semibold whitespace-nowrap tabular-nums'
  const title = `${save.ability.toUpperCase()} saving throw`
  const content = (
    <>
      <span className='text-text-secondary uppercase'>{save.ability}</span>
      {save.dc !== null && ` ${save.dc}`}
    </>
  )
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={`${name}, ${title}${save.dc === null ? '' : ` DC ${save.dc}`}`}
        title={title}
        onClick={() => onUse()}
        className={clsx(chip, 'transition-colors hover:bg-primary/5')}
      >
        {content}
      </button>
    )
  }
  return (
    <span className={chip} title={title}>
      {content}
    </span>
  )
}
