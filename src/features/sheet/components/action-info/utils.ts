import { joinParts } from '../../utils/join-parts'
import { ordinal } from '@/utils/action-groups'
import { rechargeWords } from '@/utils/creature-words'
import { itemSpellOf } from '@/utils/sheet-actions'
import type { ActivityInfo } from './types'
import type {
  SheetAction,
  SheetActivity,
  SheetCast,
  SheetCastFrom,
  SheetSpell,
  SheetSpellSection,
  SheetUses,
} from '@/types/sending-stone'

/**
 * The spell an activity casts, as the Spells tab lists it under the activity's item: the copy the
 * module names, from 0.17.0; or else where it can be told which.
 */
export function spellOf(
  { activity, item }: ActivityInfo,
  spellbook: SheetSpellSection[],
): SheetSpell | undefined {
  const named =
    typeof activity.spellId === 'string'
      ? spellbook
          .flatMap(section => section.spells)
          .find(spell => spell.id === activity.spellId)
      : undefined
  if (named) return named
  return itemSpellOf(spellbook, item.id, {
    name: activity.name,
    text: activity.cast?.text,
    casts: activity.type === 'cast',
    resolved: !!activity.cast,
  })
}

/**
 * An activity's own facts, from module 0.17.0: what a reaction is taken in answer to, and how long
 * what it does lasts, where its spell doesn't say.
 */
export function ownFacts(
  activity: SheetActivity,
  spell: SheetSpell | undefined,
): { label: string; value: string }[] {
  const { trigger, duration } = activity
  return [
    ...(typeof trigger === 'string' && trigger
      ? [{ label: 'Trigger', value: trigger }]
      : []),
    ...(typeof duration === 'string' && duration && !spell?.duration
      ? [{ label: 'Duration', value: duration }]
      : []),
  ]
}

/** An activity's own description's hash, which dnd5e 6 gives it; none before. */
export function textOf(activity: SheetActivity): string | undefined {
  return typeof activity.text === 'string' && activity.text
    ? activity.text
    : undefined
}

/**
 * The facts of a spell an item casts, after whom it's cast at, as the Spells tab has them: its
 * duration and components, the level it's cast at where that's above its own, and how many of the
 * item's charges it costs. Only the cost, where the spell isn't known.
 */
export function spellFacts(
  spell: SheetSpell | undefined,
  cast: SheetCast | null | undefined,
): { label: string; value: string }[] {
  const facts: [string, string | false | null | undefined][] = [
    ['Duration', spell?.duration],
    ['Components', spell && componentsOf(spell)],
    [
      'Cast at',
      spell &&
        cast &&
        cast.level > spell.level &&
        `${ordinal(cast.level)} level`,
    ],
    ['Cost', cast && castCost(cast)],
  ]
  return facts.flatMap(([label, value]) => (value ? [{ label, value }] : []))
}

/**
 * An action that casts a spell, how it's cast, its range and its target falling back to the
 * spell's own where it has none of its own.
 */
export function castAs(action: SheetAction, spell: SheetSpell): SheetAction {
  return {
    ...action,
    activation: action.activation ?? spell.activation,
    range: action.range ?? spell.range,
    target: action.target ?? spell.target,
  }
}

/** What a spell is: its level and its school, such as "Cantrip · Evocation". */
export function spellKind(
  spell: Pick<SheetSpell, 'level' | 'school'>,
): string | undefined {
  return joinParts(
    spell.level === 0 ? 'Cantrip' : `Level ${spell.level}`,
    spell.school,
  )
}

/** A spell's components, with its materials, such as "V, S, M (a pinch of soot)". */
export function componentsOf(
  spell: Pick<SheetSpell, 'components' | 'materials'>,
): string {
  return [spell.components, spell.materials && `(${spell.materials})`]
    .filter(Boolean)
    .join(' ')
}

/** How many of an item's charges a spell cast from it costs, such as "1 charge"; none for none. */
export function castCost(cast: SheetCast): string | undefined {
  if (!cast.charges) return undefined
  return chargesOf(cast.charges)
}

/** So many of an item's charges, such as "1 charge" or "3 charges". */
export function chargesOf(count: number): string {
  return count === 1 ? '1 charge' : `${count} charges`
}

/** Why the item a spell is cast from can't cast it now: it needs attuning, or else it can't. */
export function whyNot(castFrom: SheetCastFrom): string {
  return castFrom.attune ? 'Needs attuning' : 'Can’t be cast now'
}

/**
 * When uses come back, as their facts say it: a recharge as dnd5e's stat block says it, from
 * module 0.36.0, such as "Recharge 5–6", in place of "Recharge [5+]"; else as the sheet has it.
 */
export function recoveryOf(uses: SheetUses): string | null {
  return uses.recharge ? rechargeWords(uses.recharge) : uses.recovery
}
