import { useLayoutEffect, useRef, type RefObject } from 'react'
import { NOT_MADE } from '@/constants/lifecycle'
import type { Spending } from '../types'
import type { Effects } from '@/features/sheet/components/effect-controls/types'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * Whether a roll's way ended without it made, so that the die offered it spends nothing: it may be
 * offered again. Not a roll that took the game too long, which may still be made once the
 * Gamemaster answers, and which the page goes on following (`LATE_FOLLOW`): its die stays spent
 * until it's made, or, where it never is, for as long as the page is open, as the safer of the two
 * mistakes, a die never offered twice.
 */
function unspent({ status, reason }: TableRollState): boolean {
  return NOT_MADE.has(status) && !(status === 'failed' && reason === 'timeout')
}

/**
 * Each roll a die offered was added to, by its id, from the moment it's among the rolls (the
 * returned ref): kept after the roller lets it go, as it keeps only its newest rolls, of every
 * kind, so that the die stays spent while its effect is on the sheet however many rolls, uses or
 * changes follow, and the effect is still removed once the roll is made. Let go once every effect
 * it spent has left the sheet, as nothing then offers it. `spentRef` holds the effects spent, by
 * the sheet's ids for them, unless the roll's way ends with it not made; kept up to date before
 * the page is drawn, so that a roll asked for after it, and the words under a roll made, never
 * find the spent effect as it was.
 */
export function useSpentSet({
  spent: spentRef,
  rolls,
  states,
  effecting,
}: Readonly<{
  spent: RefObject<ReadonlySet<string>>
  rolls: readonly LocalRoll[]
  states: ReadonlyMap<string, TableRollState>
  effecting: Pick<Effects, 'effectOf'>
}>): RefObject<Map<string, Spending>> {
  const spending = useRef(new Map<string, Spending>())
  useLayoutEffect(() => {
    const kept = spending.current
    for (const roll of rolls) {
      if (roll.kind !== 'check' || !roll.spends || kept.has(roll.id)) continue
      kept.set(roll.id, { spends: roll.spends, at: roll.at })
    }
    for (const [id, { spends }] of kept) {
      if (spends.every(({ effect }) => !effecting.effectOf(effect))) {
        kept.delete(id)
      }
    }
    spentRef.current = new Set(
      [...kept].flatMap(([id, { spends }]) => {
        const state = states.get(id)
        if (state && unspent(state)) return []
        return spends.map(({ effect }) => effect)
      }),
    )
  }, [spentRef, rolls, states, effecting])
  return spending
}
