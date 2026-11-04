'use client'

import { type RefObject } from 'react'
import { useSpentRemovals } from './use-spent-removals'
import { useSpentSet } from './use-spent-set'
import type { Effects } from '@/features/sheet/components/effect-controls/types'
import type { LocalRoll, TableRollState } from '@/types/roll'

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
 * @param rolls - The pane's own rolls, newest first: those that spent a die offered are kept here
 *   for as long as the page is open, as the roller keeps only its newest.
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
  const spending = useSpentSet({ spent, rolls, states, effecting })
  useSpentRemovals({ spending, rolls, states, effecting })
}
