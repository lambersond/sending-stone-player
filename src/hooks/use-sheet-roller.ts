'use client'

import { useCallback, useState } from 'react'
import {
  CUSTOM_COLORSET_KEY,
  executeRoll,
  themeToBoxConfig,
  toDiceBoxNotation,
  type Advantage,
  type RollResult,
} from '@lambersond/3d-dice-core'
import { useDiceRenderer } from '@lambersond/3d-dice-react'

/** The dice, in the app's jade. */
const DICE_THEME = themeToBoxConfig({
  colorset: CUSTOM_COLORSET_KEY,
  material: 'glass',
  customColor: '#00805a',
})

/** How long the dice may tumble before the result is shown regardless, in milliseconds. */
export const ANIMATION_TIMEOUT = 15_000

/** How many of this page's rolls are kept. */
export const ROLL_HISTORY = 20

/** A d20 roll from the character's sheet, such as a skill check or a saving throw. */
export type SheetRoll = {
  /** What is rolled, such as "Perception check". */
  label: string
  modifier: number
  advantage?: Advantage
}

/** A roll as this page keeps it. */
export type LocalRoll = {
  id: string
  label: string
  total: number
  modifier: number
  advantage?: Advantage
  /** Every d20 thrown: two with advantage or disadvantage. */
  d20s: number[]
  /** The d20 that counts. */
  natural: number
  at: number
}

/**
 * Rolls checks and saves from the player's character sheet, tumbling 3D dice across the screen.
 * Each result is revealed once the dice land on it, and kept on this page only: nothing is sent
 * to Foundry, or anywhere else. Must be used within a DiceRendererProvider.
 */
export function useSheetRoller() {
  const renderer = useDiceRenderer()
  const [rolls, setRolls] = useState<LocalRoll[]>([])
  const [inFlight, setInFlight] = useState(0)

  const roll = useCallback(
    async ({ label, modifier, advantage }: SheetRoll) => {
      const result = executeRoll({
        pools: [{ sides: 20, count: 1 }],
        modifier,
        advantage,
      })
      setInFlight(count => count + 1)
      try {
        // The animation is only decoration: if it fails or never settles, the result stands.
        if (renderer.isReady) {
          await within(
            renderer.roll(toDiceBoxNotation(result), { theme: DICE_THEME }),
            ANIMATION_TIMEOUT,
          )
        }
      } catch (error) {
        console.error('Dice animation failed', error)
      } finally {
        setInFlight(count => count - 1)
      }
      setRolls(kept =>
        [toLocalRoll(label, result), ...kept].slice(0, ROLL_HISTORY),
      )
    },
    [renderer],
  )

  return { roll, rolls, rolling: inFlight > 0 }
}

function toLocalRoll(label: string, result: RollResult): LocalRoll {
  const [d20] = result.pools
  return {
    id: result.id,
    label,
    total: result.total,
    modifier: result.modifier,
    advantage: result.advantage,
    d20s: d20.rolls[0],
    natural: d20.kept[0],
    at: result.at,
  }
}

/** Wait for a promise, but no longer than this many milliseconds. */
async function within(promise: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise(resolve => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
