import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { Effecting, Spending } from './types'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * An effect a made roll spent, removed, once, where the player may remove it, as the Effects tab's
 * Delete… does, its line kept just before the roll's (`at`); gone already, or not the player's to
 * remove, nothing is sent; where another change of it is on its way, it's tried again as that ends.
 * @param handled - The effects each roll removed, or left, by the roll's id and the effect's.
 */
function removeSpent(
  effecting: Effecting,
  handled: Set<string>,
  roll: string,
  id: string,
  at: number,
) {
  const key = `${roll}\n${id}`
  if (handled.has(key)) return
  const effect = effecting.effectOf(id)
  const choice = effect && effecting.choiceFor(effect)
  // Gone already, or not the player's to remove: nothing to send.
  if (!effect || !choice?.ops.includes('delete')) {
    handled.add(key)
    return
  }
  // Another change of it on its way: tried again once that ends.
  if (choice.waiting) return
  if (effecting.send(effect, 'delete', at - 1) !== undefined) {
    handled.add(key)
  }
}

/**
 * Once the game has made a roll a die offered was added to, each effect it spent that's still on
 * the sheet is removed, once, where the player may remove it, its line kept just before the
 * roll's, beneath it, so that the roll's verdict and any damage it's owed stay the latest. Where it
 * may not be removed, it's left, and the roll says to ask the Gamemaster.
 * @param spending - Each roll a die offered was added to, by its id (`useSpentSet`).
 */
export function useSpentRemovals({
  spending,
  rolls,
  states,
  effecting,
}: Readonly<{
  spending: RefObject<Map<string, Spending>>
  rolls: readonly LocalRoll[]
  states: ReadonlyMap<string, TableRollState>
  effecting: Effecting
}>): void {
  // The effects each roll removed, or left, by the roll's id and the effect's: each once.
  const handled = useRef(new Set<string>())
  useLayoutEffect(() => {
    for (const [roll, { spends, at }] of spending.current) {
      // Not one taken with nothing to follow it by, which the game may not have made: its effect
      // is held spent (`useSpentSet`), as for one that took too long.
      const state = states.get(roll)
      if (state?.status !== 'done' || state.unfollowed) continue
      for (const { effect: id } of spends) {
        removeSpent(effecting, handled.current, roll, id, at)
      }
    }
  }, [rolls, states, effecting, spending])
}
