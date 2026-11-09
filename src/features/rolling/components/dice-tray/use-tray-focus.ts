'use client'

import { useRef, type RefCallback } from 'react'
import { focusOnRemoving } from './utils'
import type { TrayButton, TrayDie } from './types'
import type { DieSides } from '@lambersond/3d-dice-core'

const keyOf = ({ button, sides }: TrayButton) => `${button}-${sides}`

/**
 * Keyboard focus kept in the dice tray (v0.44) as the last die of a size is taken away, which
 * takes its chip and both its buttons with it: moved first to the button `focusOnRemoving` says,
 * which is on the page already, and stays.
 * @param dice - The tray's dice, smallest first, as its chips show them.
 * @param remove - Takes one die of a size away.
 * @returns The refs of each size's Add and of each chip's One fewer, and `remove`, which moves
 *   focus off a chip about to go before taking its die away.
 */
export function useTrayFocus(
  dice: readonly TrayDie[],
  remove: (sides: DieSides) => void,
) {
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const keep =
    (to: TrayButton): RefCallback<HTMLButtonElement> =>
    node => {
      const key = keyOf(to)
      if (node) buttons.current.set(key, node)
      return () => {
        buttons.current.delete(key)
      }
    }
  return {
    addRef: (sides: DieSides) => keep({ button: 'add', sides }),
    fewerRef: (sides: DieSides) => keep({ button: 'fewer', sides }),
    remove: (sides: DieSides) => {
      const to = focusOnRemoving(dice, sides)
      if (to) buttons.current.get(keyOf(to))?.focus()
      remove(sides)
    },
  }
}
