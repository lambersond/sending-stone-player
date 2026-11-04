'use client'

import clsx from 'clsx'
import { RollButton } from '@/features/rolling/components/roll-button/roll-button'
import type { DamageActions, DamageTarget } from '../action-entry/types'
import type { DamageModifiers } from '@/types/roll'

/**
 * The damage or healing an action rolls, as a button that rolls it, which a right-click or
 * long-press offers other ways to roll: as a critical hit's, at its highest, or changed. A formula
 * the app can't read is shown, but not rolled. While the Gamemaster's game takes the spell or
 * feature it's of, it uses it there, and its damage or healing follows; its menu then uses it
 * with its damage changed. Where it will go to the table on its own, from module 0.36.0, it looks
 * the same, but its name says so.
 */
export function DamageChip({
  name,
  formula,
  healing,
  target,
  damage,
  onUse,
  verb = 'Use',
}: Readonly<{
  name: string
  formula: string
  healing: boolean
  target: DamageTarget | undefined
  damage: DamageActions
  onUse?: (modifiers?: DamageModifiers) => void
  /** What using it is called, such as "Cast" for a spell. */
  verb?: string
}>) {
  const chip = clsx(
    'max-w-36 shrink-0 truncate rounded-lg px-2 py-1 text-sm font-semibold tabular-nums',
    healing ? 'bg-primary/10 text-primary-text' : 'bg-damage/15 text-damage',
  )
  const alone = !!target && damage.goesAlone(target)
  const label = `${name} ${healing ? 'healing' : 'damage'}, ${formula}${alone ? ', goes to the table on its own' : ''}`
  const hover = clsx(
    'transition-colors',
    healing ? 'hover:bg-primary/20' : 'hover:bg-damage/25',
  )
  if (onUse && target) {
    return (
      <RollButton
        target={target}
        onRoll={() => onUse()}
        onMenu={(anchor, at, point) =>
          damage.onMenu(anchor, at, point, { verb, onUse })
        }
        label={label}
        className={clsx(chip, hover)}
      >
        {formula}
      </RollButton>
    )
  }
  if (onUse) {
    return (
      <button
        type='button'
        aria-label={label}
        title={formula}
        onClick={() => onUse()}
        className={clsx(chip, hover)}
      >
        {formula}
      </button>
    )
  }
  if (!target) {
    return (
      <span className={chip} title={formula}>
        {formula}
      </span>
    )
  }
  return (
    <RollButton
      target={target}
      onRoll={damage.onRoll}
      onMenu={damage.onMenu}
      label={label}
      className={clsx(chip, hover)}
    >
      {formula}
    </RollButton>
  )
}
