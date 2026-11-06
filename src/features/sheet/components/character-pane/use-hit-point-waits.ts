import { useCallback } from 'react'
import { EFFECT_SETTLE } from '@/constants/sending-stone'
import { useSettle } from '@/features/sheet/hooks/use-settle'
import { checkHitPoints } from '@/utils/hit-points'
import type { SentHitPoints } from './types'
import type { TableRollState } from '@/types/roll'
import type { TableSheet } from '@/types/table'

/** The one key the hit points are waited for by: the pane's actor has one pool of them. */
const HIT_POINTS = 'hp'

/**
 * Whether the hit points wait for the game, from module 0.44.0, as a pool of spell slots waits
 * (`useSlotWaits`): once a change is sent, while nothing is heard of it, for up to `EFFECT_SETTLE`
 * from the send; while it's on its way to the game, however long that takes; once made, until the
 * sheet no longer shows a number it was sent from, for up to `EFFECT_SETTLE` from the send; and
 * never once it was refused, failed or lost, so that it can be tried again.
 * @param hp - The sheet's hit points, as the pane has them now.
 */
export function useHitPointWaits(
  states: ReadonlyMap<string, TableRollState>,
  hp: TableSheet['hp'],
) {
  const { sent, last, waitingOf } = useSettle<SentHitPoints>({
    states,
    settleMs: EFFECT_SETTLE,
    missing: 'waiting',
    agrees: useCallback(
      ({ from }) => checkHitPoints({ op: 'set', from }, { hp }) !== undefined,
      [hp],
    ),
  })
  const sentFrom = useCallback(
    (hitPoints: SentHitPoints) => sent(HIT_POINTS, hitPoints),
    [sent],
  )
  return { waiting: waitingOf(last(HIT_POINTS)), sent: sentFrom }
}
