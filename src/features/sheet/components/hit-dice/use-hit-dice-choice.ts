import { useState, type FormEvent } from 'react'
import { mostOf } from './utils'
import { MOST_HIT_DICE } from '@/constants/sending-stone'
import type { HitDiceCount, HitDicePool } from '@/types/roll'

/**
 * How many hit dice of each size are chosen to spend at once, as `HitDiceMenu` offers them: the
 * size it opened for from 1, any other from none, where the character has more than one size; kept
 * within the least and as many as are left, no more than the most at once in all, and pulled back
 * should the sheet say fewer are left while it's open. `submit` spends them, once any are chosen.
 */
export function useHitDiceChoice({
  die,
  pools,
  onSpend,
}: {
  die: string
  pools: HitDicePool[]
  onSpend: (counts: HitDiceCount[]) => void
}) {
  const [chosen, setChosen] = useState<ReadonlyMap<string, number>>(
    () => new Map([[die, 1]]),
  )
  // One size alone is spent from 1; of several, any may be left at none.
  const single = pools.length === 1
  const least = single ? 1 : 0
  const counts = pools.map(pool => ({
    die: pool.die,
    count: chosen.get(pool.die) ?? 0,
  }))
  // No more than are left, should the sheet say fewer are while it's open; nor more again, should
  // it then say more are.
  const over = pools.some(
    pool => (chosen.get(pool.die) ?? 0) > Math.max(least, mostOf(pool)),
  )
  if (over) {
    setChosen(
      new Map(
        pools.map(pool => [
          pool.die,
          Math.min(chosen.get(pool.die) ?? 0, Math.max(least, mostOf(pool))),
        ]),
      ),
    )
  }
  const total = counts.reduce((all, { count }) => all + count, 0)
  // Whether one more of a size can be spent: one more is left, and there are fewer than the most
  // at once in all.
  const roomFor = (pool: HitDicePool) =>
    (chosen.get(pool.die) ?? 0) < mostOf(pool) && total < MOST_HIT_DICE
  // Kept within the least and as many as are left, no more than the most in all; its buttons stay
  // where they can't go further, so that focus isn't lost from one.
  const step = (pool: HitDicePool, by: number) => {
    const count = chosen.get(pool.die) ?? 0
    if (by > 0 ? !roomFor(pool) : count <= least) return
    setChosen(new Map(chosen).set(pool.die, count + by))
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (total === 0) return
    onSpend(counts.filter(({ count }) => count > 0))
  }
  return { chosen, single, least, counts, total, roomFor, step, submit }
}
