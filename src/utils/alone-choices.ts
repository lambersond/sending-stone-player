import { defaultPool, slotPools } from '@/utils/action-groups'
import type {
  DamagePreview,
  SheetAction,
  SheetSpellSection,
  TableDamagePlan,
} from '@/types/sending-stone'

/*
 * The choices of an action's damage on its own, from module 0.41.0: the spell slot it's rolled at,
 * the weapon's attack mode and its ammunition, and the plan of its dice they pick, by the one rule
 * the module sends its plans by, which the page, the server's check and the module share: a plan is
 * looked up by the picks that change its dice, a slot's level where it's above the spell's own, the
 * attack mode, the ammunition; the plan named by exactly those, else the row's own. Kept apart from
 * the page's rolling, damage-alone.ts, so that the server reads the same rule.
 */

/** What the player chose for damage on its own: the slot, the attack mode and the ammunition. */
export type AloneSelection = {
  slot?: string | null
  attackMode?: string
  ammunition?: string
}

/** The picks that change damage on its own's dice, by which its plan is looked up. */
export type AlonePicks = {
  level?: number
  attackMode?: string
  ammunition?: string
}

/** The row damage on its own is of, and the spellbook its slots are in. */
export type AloneRow = { action: SheetAction; spells: SheetSpellSection[] }

/** The dice damage on its own throws as picked, and a critical hit's where one is allowed. */
export type AlonePlan = {
  normal: DamagePreview
  critical: DamagePreview | null
}

/**
 * The picks that change damage on its own's dice: the chosen slot's level, where it's above the
 * spell's own, as a pact slot's often is; the attack mode, where it's one of the weapon's, which
 * the sheet lists only where it has more than one; the ammunition, where it's one of the weapon's.
 * Nothing else changes them.
 */
export function alonePicks(
  action: SheetAction,
  spells: SheetSpellSection[],
  selection: AloneSelection,
): AlonePicks {
  const { slot, attackMode, ammunition } = selection
  const pool = slot
    ? slotPools(action, spells)?.find(({ id }) => id === slot)
    : undefined
  const level = pool?.level ?? 0
  const higher = !!action.level && level > action.level
  const moded =
    !!attackMode &&
    !!action.attackModes?.some(({ value }) => value === attackMode)
  const fired =
    !!ammunition && !!action.ammunition?.some(({ id }) => id === ammunition)
  return {
    ...(higher && { level }),
    ...(moded && { attackMode }),
    ...(fired && { ammunition }),
  }
}

/**
 * The plan of damage on its own's dice, as picked: the one the game named by exactly these picks,
 * else the row's own, which is the spell's own level's, the weapon's first mode's, with no
 * ammunition, and any pick that throws the same dice, which the game leaves out.
 */
export function alonePlan(plan: TableDamagePlan, picks: AlonePicks): AlonePlan {
  const picked =
    Object.keys(picks).length > 0
      ? plan.choices?.find(
          entry =>
            entry.level === picks.level &&
            entry.attackMode === picks.attackMode &&
            entry.ammunition === picks.ammunition,
        )
      : undefined
  const { normal, critical } = picked ?? plan
  return { normal, critical }
}

/**
 * What damage on its own is rolled with, as the player chose it or by default, where the game sends
 * its choices: the slot always where the spell is cast with one, the chosen pool, else the one
 * dnd5e would pick, else, none being left, its own level's, so that its dice and what it spends are
 * at that slot's level, never the spell's own by mistake; the attack mode chosen, if any, none
 * otherwise, which the game rolls in the weapon's first; the ammunition chosen, else the first with
 * any left, else the first, as the game fires none unnamed. Nothing where the game sends no choices
 * for the row, which rolls as before module 0.41.0.
 */
export function aloneSelection(
  plan: TableDamagePlan,
  row: AloneRow,
  selection: AloneSelection = {},
): AloneSelection {
  if (!plan.choices) return {}
  const { action, spells } = row
  const pools = slotPools(action, spells)
  const slot = pools
    ? (selection.slot ??
      (
        defaultPool(action, spells) ??
        // None left: its own level's, as dnd5e would pick were none spent.
        defaultPool({ ...action, consumesSlot: false }, spells)
      )?.id)
    : undefined
  const ammunition =
    selection.ammunition ??
    (
      action.ammunition?.find(({ quantity }) => quantity > 0) ??
      action.ammunition?.[0]
    )?.id
  return {
    ...(slot && { slot }),
    ...(selection.attackMode && { attackMode: selection.attackMode }),
    ...(ammunition && { ammunition }),
  }
}
