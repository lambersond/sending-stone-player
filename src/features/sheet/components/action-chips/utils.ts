import { joinParts } from '../../utils/join-parts'
import {
  actionTitle,
  castNote,
  forwardNote,
  verbOf,
} from '../action-entry/utils'
import { defaultPool, ordinal, slotPools } from '@/utils/action-groups'
import { castOf } from '@/utils/casts'
import { formulaTerms } from '@/utils/formulas'
import type { ActionRows } from '../action-entry/types'
import type { RollSource, SheetFormulaRoll } from '@/types/roll'
import type {
  SheetAction,
  SheetEnchant,
  SheetUses,
} from '@/types/sending-stone'

/** What a way an enchant activity enchants is called, or else the action's name. */
export function profileName(
  enchant: SheetEnchant,
  id: string,
  action: SheetAction,
): string {
  return (
    enchant.profiles.find(profile => profile.id === id)?.name ??
    actionTitle(action)
  )
}

/**
 * What an action's attack is, for the Gamemaster's game to make it: its item and attack activity.
 * None for an action whose attack the module didn't name, as before module 0.11.0.
 */
export function attackSource(action: SheetAction): RollSource | undefined {
  return action.attackId
    ? { kind: 'attack', item: action.id, activity: action.attackId }
    : undefined
}

/**
 * What using an action in the game does, as a check's menu says it, which spends whatever dnd5e
 * spends: such as "Uses Manacles (Bind)", and what it costs where the sheet says, such as "Casts
 * Maze · 8th-level slot", a spell cast from an item's charges, or an activity's that uses another.
 */
export function tableUseHint(
  action: SheetAction,
  rows: Pick<ActionRows, 'spellbook' | 'casts'>,
): string {
  const verb = verbOf(action) === 'Cast' ? 'Casts' : 'Uses'
  const pool =
    action.consumesSlot !== false && slotPools(action, rows.spellbook)
      ? defaultPool(action, rows.spellbook)
      : undefined
  let slot: string | undefined
  if (pool?.id === 'pact') slot = 'Pact slot'
  else if (pool?.level) slot = `${ordinal(pool.level)}-level slot`
  return (
    joinParts(
      `${verb} ${actionTitle(action)}`,
      castNote(castOf(action, rows.casts)),
      forwardNote(action.forward),
      slot,
    ) ?? ''
  )
}

/**
 * An activity's own formula as it's rolled: named for the action and what dnd5e calls it, such as
 * "Eternal Flame: Light radius", and, while the game may use the activity, for the game to roll it
 * too. Nothing for a formula the app can't read, or of an item not identified.
 */
export function formulaRollOf(
  action: SheetAction,
): SheetFormulaRoll | undefined {
  const own = action.rollFormula
  const terms = own && action.identified ? formulaTerms(own.formula) : undefined
  if (!own || !terms) return undefined
  const title = actionTitle(action)
  return {
    label: own.name ? `${title}: ${own.name}` : `${title} roll`,
    terms,
    ...(action.activity && {
      source: {
        kind: 'formula',
        item: action.id,
        activity: action.activity.id,
      },
    }),
  }
}

/**
 * Whether uses can be recharged from here: they recharge, they're an item's own or one of its
 * activities', not a resource's, and something of them is spent, as dnd5e rolls a recharge only
 * then.
 */
export function rechargeable(uses: SheetUses | null | undefined): boolean {
  const counter = uses?.counter
  return (
    !!uses?.recharge && !!counter && 'item' in counter && uses.value < uses.max
  )
}

/**
 * How a row's spent recharge is rolled, from module 0.36.0, where its Recharge chip shows: uses
 * that recharge, something spent of them, and the game taking a recharge rolled from here. None
 * otherwise, as with Send to the table off, or at a gone companion's pane, which takes nothing.
 */
export function rechargeOf(
  rows: Pick<ActionRows, 'recharges' | 'formula'>,
  uses: SheetUses | null | undefined,
): ((roll: SheetFormulaRoll) => void) | undefined {
  return rows.recharges && rechargeable(uses) ? rows.formula : undefined
}
