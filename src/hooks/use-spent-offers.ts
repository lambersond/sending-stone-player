'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { Effects } from '@/components/character-sheet/effect-controls'
import type { LocalRoll } from '@/hooks/use-sheet-roller'
import type { TableRollState } from '@/hooks/use-table-rolls'

/**
 * The ways a roll's way to the game ends without it made, which spend no die offered that the
 * player added to it: it may be offered again.
 */
const UNSPENT = new Set<TableRollState['status']>([
  'failed',
  'expired',
  'lost',
  'refused',
])

/**
 * The dice offered that the player added to their rolls, from module 0.42.1, such as Bardic
 * Inspiration's, which the 2024 rules spend as they're rolled. Each roll's spends what it was added
 * to from the moment it's sent, unless its way ends with it not made: `spent` holds the effects
 * spent so, by the sheet's ids for them, which are offered again on no roll of this page while
 * they're on the sheet. And once the game has made the roll, each effect it spent that's still on
 * the sheet is removed, once, where the player may remove it, as the Effects tab's Delete… does,
 * its line kept just before the roll's, beneath it, so that the roll's verdict and any damage it's
 * owed stay the latest. Where it may not be removed, it's left, and the roll says to ask the
 * Gamemaster; where another change of it is on its way, it's tried again as that ends.
 * @param spent - Kept up to date with the effects spent, read as each roll is asked for.
 * @param rolls - The pane's own rolls, newest first.
 * @param states - Each roll's way to the game, by its id.
 * @param effecting - The pane's effect controls: the effects on the sheet, what may be done to
 *   each, and the delete, logged among the rolls.
 */
export function useSpentOffers({
  spent,
  rolls,
  states,
  effecting,
}: Readonly<{
  spent: RefObject<ReadonlySet<string>>
  rolls: readonly LocalRoll[]
  states: ReadonlyMap<string, TableRollState>
  effecting: Pick<Effects, 'effectOf' | 'choiceFor' | 'send'>
}>): void {
  // The effects each roll removed, or left, by the roll's id and the effect's: each once.
  const handled = useRef(new Set<string>())

  // Before the page is drawn, so that a roll asked for after it, and the words under a roll made,
  // never find the spent effect as it was.
  useLayoutEffect(() => {
    spent.current = new Set(
      rolls.flatMap(roll => {
        if (roll.kind !== 'check' || !roll.spends) return []
        const status = states.get(roll.id)?.status
        if (status && UNSPENT.has(status)) return []
        return roll.spends.map(({ effect }) => effect)
      }),
    )
  }, [spent, rolls, states])

  useLayoutEffect(() => {
    for (const roll of rolls) {
      if (roll.kind !== 'check' || !roll.spends) continue
      if (states.get(roll.id)?.status !== 'done') continue
      for (const { effect: id } of roll.spends) {
        const key = `${roll.id}\n${id}`
        if (handled.current.has(key)) continue
        const effect = effecting.effectOf(id)
        const choice = effect && effecting.choiceFor(effect)
        // Gone already, or not the player's to remove: nothing to send.
        if (!effect || !choice?.ops.includes('delete')) {
          handled.current.add(key)
          continue
        }
        // Another change of it on its way: tried again once that ends.
        if (choice.waiting) continue
        if (effecting.send(effect, 'delete', roll.at - 1) !== undefined) {
          handled.current.add(key)
        }
      }
    }
  }, [rolls, states, effecting])
}
