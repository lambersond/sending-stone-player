'use client'

import clsx from 'clsx'
import { HitPoints } from './hit-points'
import { HEALTH_TONES, HEALTH_WORDS } from '@/features/table/constants'
import type { TableCombatant } from '@/types/table'

/**
 * What a seat is shown of how hurt a combatant is: its hit points where it may see them, the
 * party's or, from module 0.50.0, another creature's where its Gamemaster shows them; else, for
 * another creature, how hurt it is, in a word; else nothing.
 */
export function CombatantHealth({
  combatant,
}: Readonly<{ combatant: TableCombatant }>) {
  if (combatant.hp) return <HitPoints hp={combatant.hp} />
  if (!combatant.health) return null
  return (
    <span
      className={clsx('text-sm font-semibold', HEALTH_TONES[combatant.health])}
    >
      <span className='sr-only'>Health </span>
      {HEALTH_WORDS[combatant.health]}
    </span>
  )
}
