'use client'

import { useState } from 'react'
import { diceSaid } from './utils'
import type { TrayDie } from './types'

/**
 * What the dice tray (v0.44) says as its dice are added and taken away, and only then: their whole
 * formula, the number added in it, "1d6 + 2", or once none are left, "No dice". The words are kept
 * as they were while only the number added steps, which the modifier says itself, so that a step
 * is never heard twice.
 * @param dice - The tray's dice, smallest first.
 * @param bonus - The number added to them.
 * @returns The words for the tray's live region.
 */
export function useDiceSaid(dice: readonly TrayDie[], bonus: number): string {
  // The dice alone, the number added left out, which change only as the dice do.
  const picked = diceSaid(dice, 0)
  const [said, setSaid] = useState({ picked, words: diceSaid(dice, bonus) })
  if (said.picked !== picked) setSaid({ picked, words: diceSaid(dice, bonus) })
  return said.words
}
