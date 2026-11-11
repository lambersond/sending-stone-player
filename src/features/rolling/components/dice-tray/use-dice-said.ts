'use client'

import { useState } from 'react'
import { diceSaid } from './utils'
import type { DiceSaid, Live, TrayDie } from './types'

/**
 * What the dice tray (v0.44) says as its dice are added and taken away, and only then: their whole
 * formula, the number added in it, "1d6 + 2", or once none are left, "No dice". The words always
 * hold the tray's formula, so that they never read one gone by; but where only the number added
 * steps, which the modifier says itself, they change unsaid, so that a step is never heard twice.
 * Nor is a clear: the dice and the number added going at once, the formula says "No dice" and the
 * modifier's "+0" follows unsaid, as the dice library's tray clears both together.
 * @param dice - The tray's dice, smallest first.
 * @param bonus - The number added to them.
 * @returns The words for the tray's live region, whether their change is said, and whether the
 *   modifier's own output says its change.
 */
export function useDiceSaid(dice: readonly TrayDie[], bonus: number): DiceSaid {
  // The dice alone, the number added left out, which change only as the dice do.
  const picked = diceSaid(dice, 0)
  const [last, setLast] = useState<{
    picked: string
    bonus: number
    live: Live
    modifier: Live
  }>({ picked, bonus, live: 'polite', modifier: 'polite' })
  if (last.picked !== picked) {
    const modifier = last.bonus === bonus ? 'polite' : 'off'
    setLast({ picked, bonus, live: 'polite', modifier })
  } else if (last.bonus !== bonus) {
    setLast({ picked, bonus, live: 'off', modifier: 'polite' })
  }
  return {
    words: diceSaid(dice, bonus),
    live: last.live,
    modifier: last.modifier,
  }
}
