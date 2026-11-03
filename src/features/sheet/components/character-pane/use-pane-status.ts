import { useEffect, useMemo } from 'react'
import { SETTLED } from '@/constants/lifecycle'
import { useGmRolls } from '@/features/rolling/hooks/use-gm-rolls'
import { needsPlayer } from '@/features/rolling/utils/damage-due'
import { withGmRolls } from '@/features/rolling/utils/gm-rolls'
import type { PaneRoller, PaneTable } from './types'
import type { GmRollView } from '@/types/roll'
import type { TableCombat } from '@/types/table'

/**
 * The pane's rolls as shown (`shown`): the Gamemaster's rolls as the character (#156) among the
 * player's own, wherever they're shown, with nothing to roll after them; their area attacks'
 * targets named as this page's own combat names them, which never holds one hidden from players.
 * Where several panes share the Character pane (module 0.36.0), it says whether any of its rolls
 * waits for its player, as damage to roll, which its tab marks while it's hidden (`onPending`);
 * and whether any is still on its way to the game, while the page must keep it mounted, so as not
 * to lose it (`onBusy`).
 */
export function usePaneStatus({
  rolls,
  table,
  gmRolls,
  combat,
  onPending,
  onBusy,
}: Readonly<{
  rolls: PaneRoller['rolls']
  table: PaneTable
  gmRolls?: GmRollView[]
  combat?: TableCombat
  onPending?: (pending: boolean) => void
  onBusy?: (busy: boolean) => void
}>) {
  const fromGm = useGmRolls(gmRolls, combat)
  const shown = useMemo(
    () => withGmRolls(rolls, table.states, fromGm),
    [rolls, table.states, fromGm],
  )
  const pending = shown.rolls.some(roll =>
    needsPlayer(roll, shown.states.get(roll.id)),
  )
  const busy = [...table.states.values()].some(
    ({ status }) => !SETTLED.has(status),
  )
  useEffect(() => {
    onPending?.(pending)
  }, [pending, onPending])
  useEffect(() => {
    onBusy?.(busy)
  }, [busy, onBusy])
  return shown
}
