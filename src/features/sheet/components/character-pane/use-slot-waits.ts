import { useCallback } from 'react'
import { EFFECT_SETTLE } from '@/constants/sending-stone'
import { useSettle } from '@/features/sheet/hooks/use-settle'
import type { SentSlot } from './types'
import type { TableRollState } from '@/types/roll'
import type { TableSheet } from '@/types/table'

/**
 * Whether each pool of the character's spell slots waits for the game, by the pool's id, from
 * module 0.42.1, as one of their effects' controls waits (`useEffectControls`): once one of its
 * slots is sent, while nothing is heard of it, for up to `EFFECT_SETTLE` from the send; while it's
 * on its way to the game, however long that takes; once made, until the sheet shows the pool at
 * another count than the one it was sent from, for up to `EFFECT_SETTLE` from the send; and never
 * once it was refused, failed or lost, so that it can be tried again.
 * @param spells - The sheet's spellbook, whose sections hold each pool's count.
 */
export function useSlotWaits(
  states: ReadonlyMap<string, TableRollState>,
  spells: TableSheet['spells'],
) {
  const { sent, last, waitingOf } = useSettle<SentSlot & { pool: string }>({
    states,
    settleMs: EFFECT_SETTLE,
    missing: 'waiting',
    agrees: useCallback(
      ({ pool, from }) =>
        spells.find(({ id }) => id === pool)?.slots?.value !== from,
      [spells],
    ),
  })
  const waiting = useCallback(
    (pool: string): boolean => waitingOf(last(pool)),
    [last, waitingOf],
  )
  const sentFrom = useCallback(
    (pool: string, slot: SentSlot) => sent(pool, { ...slot, pool }),
    [sent],
  )
  return { waiting, sent: sentFrom }
}
