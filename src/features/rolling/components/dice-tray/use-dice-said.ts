'use client'

import { useState } from 'react'
import { diceSaid } from './utils'
import type { DiceSaid, TrayDie } from './types'

/**
 * What the dice tray (v0.44) says as its dice are added and taken away, and only then: their whole
 * formula, the number added in it, "1d6 + 2", or once none are left, "No dice". The words always
 * hold the tray's formula, so that they never read one gone by; but where only the number added
 * steps, which the modifier says itself, they change unsaid, so that a step is never heard twice.
 * @param dice - The tray's dice, smallest first.
 * @param bonus - The number added to them.
 * @returns The words for the tray's live region, and whether their change is said.
 */
export function useDiceSaid(dice: readonly TrayDie[], bonus: number): DiceSaid {
  // The dice alone, the number added left out, which change only as the dice do.
  const picked = diceSaid(dice, 0)
  const [last, setLast] = useState<{
    picked: string
    bonus: number
    live: DiceSaid['live']
  }>({ picked, bonus, live: 'polite' })
  if (last.picked !== picked) setLast({ picked, bonus, live: 'polite' })
  else if (last.bonus !== bonus) setLast({ picked, bonus, live: 'off' })
  return { words: diceSaid(dice, bonus), live: last.live }
}
