import { useState, useMemo } from 'react'
import { heardOf, namesOf } from '@/features/rolling/utils/gm-rolls'
import { partly } from '@/features/rolling/utils/roll-states'
import type { GmRolls } from '@/features/rolling/types'
import type { GmRollView, LocalGmRoll, TableRollState } from '@/types/roll'
import type { TableCombat } from '@/types/table'

/** None of the Gamemaster's rolls, the same each time, for what's worked out from them to keep. */
const NO_GM_ROLLS: readonly GmRollView[] = []

/**
 * The rolls the campaign's Gamemaster made as the player's character (#156), as the player's view
 * tells them, to show among the player's own: each as a roll of this page's, apart from its own by
 * its id, and its way to the game, as the player's own are followed, with the game's result; but
 * never the damage that follows one, which the Gamemaster rolls, so that it waits for nothing. An
 * area attack's targets are named as the player's own view of the combat names them (`namesOf`).
 * @param heard - When this page first heard of each, by this device's clock (`useGmRolls`), to
 *   place it among the player's own by; else it's placed by when it was sent.
 * @param combat - The combat as the player's view has it, which names the targets.
 */
export function gmRollsOf(
  views: readonly GmRollView[] = NO_GM_ROLLS,
  heard?: ReadonlyMap<string, number>,
  combat?: TableCombat,
): GmRolls {
  const rolls = views.map((view): LocalGmRoll => ({
    kind: 'gm',
    id: `gm:${view.id}`,
    label: view.label,
    rolled: view.kind,
    at: heard?.get(view.id) ?? Date.parse(view.at),
    ...(view.healing && { healing: true }),
    // A spell slot's, from module 0.42.1, says whether it was spent or restored.
    ...(view.slotOp && { slotOp: view.slotOp }),
  }))
  const states = new Map(
    views.map(view => {
      const { status, reason, visible, total, attack, outcome, healed } = view
      const { spent, enchantment, d20, critical } = view
      const names = namesOf(attack, combat)
      const state: TableRollState = {
        status,
        ...(reason !== undefined && { reason }),
        ...(visible !== undefined && { visible }),
        ...(total !== undefined && { total }),
        ...(attack && { attack }),
        ...(names && { targetNames: names }),
        ...(outcome && { outcome }),
        ...(healed !== undefined && { healed }),
        ...(spent && { spent }),
        ...(enchantment && { enchantment }),
        ...(d20 && { d20 }),
        ...(critical && { critical }),
        ...partly({ status, spent }),
        // Worded as the player's own recharges and damage on its own are, from module 0.36.0.
        ...(view.kind === 'recharge' && { recharge: true as const }),
        ...(view.kind === 'itemDamage' && { alone: true as const }),
        requestId: view.id,
      }
      return [`gm:${view.id}`, state] as const
    }),
  )
  return { rolls, states }
}

/**
 * The rolls the campaign's Gamemaster made as the player's character (#156), as `gmRollsOf` has
 * them, each placed among the player's own by when this page first heard of it, by this device's
 * clock, as theirs are: never by when the server says it was sent, as this device's clock may be
 * behind the server's or ahead of it. So one heard of after the player rolled is newer than their
 * roll, and one heard of before it older. Those the page opens with are heard of as it opens, in
 * the order the view has them, as are those one look at the table brings. An area attack's targets
 * are named as the player's view of the combat names them now.
 */
export function useGmRolls(
  views: readonly GmRollView[] = NO_GM_ROLLS,
  combat?: TableCombat,
): GmRolls {
  const [heard, setHeard] = useState(() => heardOf(new Map(), views))
  let known = heard
  // Those the view brings, heard of now: the page renders again at once with them.
  if (views.some(({ id }) => !heard.has(id))) {
    known = heardOf(heard, views)
    setHeard(known)
  }
  return useMemo(() => gmRollsOf(views, known, combat), [views, known, combat])
}
