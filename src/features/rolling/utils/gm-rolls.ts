import { NO_GM_ROLLS } from '@/features/rolling/constants'
import { partly } from '@/features/rolling/utils/roll-states'
import type { GmRolls } from '@/features/rolling/types'
import type {
  GmRollView,
  LocalGmRoll,
  LocalRoll,
  TableRollState,
} from '@/types/roll'
import type { TableCombat } from '@/types/table'

/**
 * The page's own rolls and the Gamemaster's as the character together (#156), newest first by when
 * each was made, or for the Gamemaster's, heard of, and their ways to the game.
 */
export function withGmRolls(
  rolls: readonly LocalRoll[],
  states: ReadonlyMap<string, TableRollState>,
  gm: GmRolls,
): { rolls: LocalRoll[]; states: ReadonlyMap<string, TableRollState> } {
  if (gm.rolls.length === 0) return { rolls: [...rolls], states }
  return {
    rolls: [...rolls, ...gm.rolls].toSorted((a, b) => b.at - a.at),
    states: new Map([...states, ...gm.states]),
  }
}

/**
 * The names of an area attack's targets of the Gamemaster's (#156), by their ids, as the player's
 * own view of the combat names them: only ever names its player may see, as that view leaves out
 * those hidden from players, never names the Gamemaster's page saw. None of a target that view
 * doesn't hold, nor of an attack at one target, which says nothing of whom.
 */
function namesOf(
  attack: GmRollView['attack'],
  combat?: TableCombat,
): Record<string, string> | undefined {
  const targets = attack?.targets ?? []
  if (!combat || targets.length < 2) return undefined
  const names = targets.flatMap(({ combatId, combatantId }) => {
    const combatant =
      combatId === combat.id
        ? combat.combatants.find(({ id }) => id === combatantId)
        : undefined
    return combatant ? [[combatantId, combatant.name] as const] : []
  })
  return names.length > 0 ? Object.fromEntries(names) : undefined
}

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
 * When this page first heard of each of the Gamemaster's rolls the view has, those new to it now:
 * none it no longer has, which never come back, as they only grow older.
 */
export function heardOf(
  held: ReadonlyMap<string, number>,
  views: readonly GmRollView[],
): ReadonlyMap<string, number> {
  const now = Date.now()
  return new Map(views.map(({ id }) => [id, held.get(id) ?? now]))
}
