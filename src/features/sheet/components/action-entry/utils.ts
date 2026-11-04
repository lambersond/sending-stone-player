import { HeartPulse, Swords } from 'lucide-react'
import { aloneRollOf } from '../../utils/damage-alone'
import { enchantOf } from '../../utils/enchantments'
import { joinParts } from '../../utils/join-parts'
import { castCost, chargesOf, spellKind } from '../action-info/utils'
import { spellOrigin } from '../description-actions/utils'
import { damageRollOf } from '@/features/rolling/utils/damage-due'
import { outOfSlots, slotPools } from '@/utils/action-groups'
import { alonePicks, alonePlan, aloneSelection } from '@/utils/alone-choices'
import { rechargeWords } from '@/utils/creature-words'
import {
  damageChanges,
  diceTakenAway,
  unmaximizable,
} from '@/utils/damage-modifiers'
import { formulaTerms } from '@/utils/formulas'
import { activityAction, spellAction } from '@/utils/sheet-actions'
import type { DamageTarget, OtherActivity, UseActions } from './types'
import type { AloneChoice } from '../../utils/types'
import type { DescriptionOrigin } from '../description-actions/types'
import type { DueDamage, MenuItem, RollChoice } from '@/features/rolling/types'
import type { AloneRow, DamageModifiers } from '@/types/roll'
import type {
  TableDamagePlan,
  SheetActivity,
  SheetCast,
  SheetForward,
  SheetSpell,
  SheetSpellSection,
  SheetUses,
  SheetAction,
} from '@/types/sending-stone'

/**
 * An action's name for its rolls: an item's, and the activity it's listed for, where it isn't the
 * item's first, such as "Staff (Silvery Barbs)".
 */
export function actionTitle(
  action: Pick<SheetAction, 'name' | 'activityName'>,
): string {
  return action.activityName
    ? `${action.name} (${action.activityName})`
    : action.name
}

/**
 * What using an action in the game is called: casting, for a spell, or one an item casts, but for
 * one of a spell's activities used after it's cast, without spending a slot or the item's uses,
 * such as Spirit Guardians' save each turn; and casting, for a spell cast through an activity that
 * uses another, such as its free casting.
 */
export function verbOf(action: SheetAction): 'Cast' | 'Use' {
  // A spell cast through an activity that uses another, such as its free casting, spends no slot,
  // but is cast all the same.
  if (action.forward) return action.type === 'spell' ? 'Cast' : 'Use'
  if (action.consumesSlot === false) return 'Use'
  return action.type === 'spell' || !!action.cast ? 'Cast' : 'Use'
}

/** What an item is, for a type other than a spell. */
const KINDS: Record<string, string> = {
  weapon: 'Weapon',
  equipment: 'Equipment',
  consumable: 'Consumable',
  feat: 'Feature',
  tool: 'Tool',
  loot: 'Loot',
}

/**
 * An action as it's shown, worked out once for a row: its damage or healing and their kinds, for a
 * spell cast with slots, which it can be cast with and whether any are left; and, while the
 * Gamemaster's game takes spells and features, which of its chips use it there: its saving throw's
 * and damage's, for an activity that calls for one or deals it, or else one of its own.
 */
export function viewOf(
  action: SheetAction,
  spellbook: SheetSpellSection[],
  using?: UseActions,
) {
  const healing =
    action.damage.length > 0 && action.damage.every(part => part.healing)
  const pools = slotPools(action, spellbook)
  const formula = action.damage.map(part => part.formula).join(' + ')
  const use =
    using && action.activity && action.identified ? action.activity : undefined
  const save = !!use && use.type === 'save' && !!action.save
  // An enchant activity is used through a chip of its own, as a utility is, its damage rolled here.
  // Damage this device sends on its own, from module 0.36.0, goes so rather than using it.
  const damage =
    !!use &&
    use.type !== 'utility' &&
    use.type !== 'enchant' &&
    !!formula &&
    !action.attackId &&
    !(using?.sendsAlone && action.tableDamage)
  const onUse =
    using &&
    ((modifiers?: DamageModifiers) =>
      modifiers ? using.onUse(action, modifiers) : using.onUse(action))
  return {
    healing,
    formula,
    target: damageTarget(action, healing),
    types: [
      ...new Set(action.damage.flatMap(part => (part.type ? [part.type] : []))),
    ],
    pools,
    spent: outOfSlots(action, pools),
    /** What the chips do in the game, if anything. */
    uses: {
      save: save ? onUse : undefined,
      damage: damage ? onUse : undefined,
      chip: use && !save && !damage ? onUse : undefined,
    },
  }
}

/**
 * An action's other activities, after its first, which the action is, each with itself as an
 * action of its own, rolled and used as that activity alone. After each Cast, the action itself
 * where it's one, come the other activities of its spell, as the Spells tab lists the spell under
 * the item, while the item can cast it: those used after it's cast, such as Hex's Bonus Hex Damage,
 * each named for the spell too, and used as the copy's. So do those of a Cast that says nothing of
 * how it's cast, such as one whose spell summons first. None is ever one of the action's own.
 */
export function otherActivities(
  action: SheetAction,
  spellbook: SheetSpellSection[],
): OtherActivity[] {
  const own = (action.activities ?? []).slice(1).flatMap(activity => [
    {
      activity,
      action: activityAction(action, activity),
      name: activity.name,
    },
    ...(activity.type === 'cast'
      ? spellActivities(activity.spellId, spellbook)
      : []),
  ])
  return [...spellActivities(action.spellId, spellbook), ...own].map(other => ({
    ...other,
    key: `${other.action.id}:${other.activity.id}`,
  }))
}

/**
 * The other activities of a spell an item casts, after its first, which its Cast is, as the copy of
 * it the Spells tab lists under the item has them; none while the item can't cast it.
 */
function spellActivities(
  spellId: string | null | undefined,
  spellbook: SheetSpellSection[],
): Omit<OtherActivity, 'key'>[] {
  if (!spellId) return []
  const copy = spellbook
    .flatMap(section => section.spells)
    .find(spell => spell.id === spellId && spell.castFrom?.usable !== false)
  const spell = copy && spellAction(copy)
  if (!spell) return []
  return (spell.activities ?? []).slice(1).map(activity => {
    const used = activityAction(spell, activity)
    return { activity, action: used, name: used.name, spellId }
  })
}

/** The kinds of activity the app rolls or uses; others, such as a summoning, are Foundry's. */
const FROM_APP = new Set(['attack', 'save', 'damage', 'heal', 'utility'])

/**
 * Is this an activity the app rolls or uses: one of a kind it does, or one the module says it can
 * roll or use, such as a spell a staff casts?
 */
export function usedFromApp(activity: SheetActivity): boolean {
  return (
    FROM_APP.has(activity.type) || !!(activity.attackId || activity.activity)
  )
}

/**
 * Is an activity shown faded: one used only in Foundry, a spell cast from charges not left, as
 * `castOf` says how it's cast, or one that uses another without the uses left it spends?
 */
export function dimmed(
  activity: SheetActivity,
  cast: SheetCast | null | undefined,
): boolean {
  return (
    !usedFromApp(activity) ||
    cast?.short === true ||
    activity.forward?.short === true
  )
}

/**
 * An activity's uses, beside it: none for a spell cast from its item's charges, or one that uses
 * another with the item's own uses, such as a spell's free casting, which are shown by the item
 * already.
 */
export function ownUses(
  activity: SheetActivity,
  parent: SheetAction,
): SheetAction['uses'] | undefined {
  const { uses } = activity
  const same =
    !!uses &&
    !!parent.uses &&
    uses.value === parent.uses.value &&
    uses.max === parent.uses.max
  return (activity.cast || activity.forward) && same ? undefined : uses
}

/**
 * What a spell cast from an item costs, as `castOf` says how it's cast, such as "1 charge"; for one
 * cast higher for more, what it may cost of what's left, such as "1–3 charges"; or that the item
 * hasn't enough left. Nothing for one that costs none, or a formula.
 */
export function castNote(
  cast: SheetCast | null | undefined,
): string | undefined {
  if (!cast?.charges) return undefined
  if (!cast.levels) return cast.short ? 'No charges left' : castCost(cast)
  const left = cast.levels.filter(({ short }) => !short)
  if (left.length === 0) return 'No charges left'
  const counts = left.flatMap(({ charges }) =>
    charges === null ? [] : [charges],
  )
  if (counts.length === 0) return castCost(cast)
  const [low, high] = [Math.min(...counts), Math.max(...counts)]
  return low === high ? chargesOf(low) : `${low}–${high} charges`
}

/**
 * What an activity that uses another spends, such as a spell's free casting, as `forward` says:
 * such as "1 use", or that not as many are left. Nothing for one that spends none, or what the
 * sheet can't count, such as a formula.
 */
export function forwardNote(
  forward: SheetForward | undefined,
): string | undefined {
  if (!forward?.charges) return undefined
  if (forward.short) return 'No uses left'
  return forward.charges === 1 ? '1 use' : `${forward.charges} uses`
}

/** How many more activities an action has than it shows while it's closed, such as "3 more". */
export function moreNote(count: number): string | undefined {
  return count > 0 ? `${count} more` : undefined
}

/**
 * How an action is activated, but where its section of the Actions tab says it already, as one
 * action does under Actions, or a reaction under Reactions.
 */
function activationIn(
  action: Pick<SheetAction, 'activation' | 'activationType'>,
  section?: string,
): string | null | undefined {
  return section && action.activationType === section
    ? undefined
    : action.activation
}

/**
 * What the count an action's row shows is called, as the game's chat names it once it's spent:
 * one of the item's activities' own by the activity too, as the row is, such as "Staff of Stars
 * (Starry Wisp)"; the item's own, or a resource's, by the item, whichever of its activities the
 * row is listed for, such as "Channel Divinity", not "Channel Divinity (Divine Sense)".
 */
export function usesName(
  action: Pick<SheetAction, 'name' | 'activityName'>,
  uses: SheetUses,
): string {
  const { counter } = uses
  return counter && 'item' in counter && counter.activity
    ? actionTitle(action)
    : action.name
}

/**
 * Is an action with more than one activity first one the app can't use, such as Flaming Sphere's
 * summoning, with the rest beneath it?
 */
export function firstInFoundry(action: SheetAction): boolean {
  const [first] = action.activities ?? []
  return !!first && !usedFromApp(first)
}

/**
 * What to say of one of an action's activities beneath it: how it's used and how far it reaches,
 * where that differs from the action, its kinds of damage, and whether it's out of slots, or used
 * only in Foundry.
 */
export function activityDetail(
  activity: SheetActivity,
  parent: SheetAction,
  spent: boolean,
  {
    section,
    range = true,
    cast,
  }: {
    /** The section of the Actions tab it's listed in. */
    section?: string
    /** Whether to say how far it reaches, which a table has a column for. */
    range?: boolean
    /** For a spell cast from an item, how, as `castOf` says. */
    cast?: SheetCast | null
  } = {},
): (string | false | null | undefined)[] {
  return [
    activity.activation !== parent.activation &&
      activationIn(activity, section),
    range && activity.range !== parent.range && activity.range,
    [
      ...new Set(
        activity.damage.flatMap(part => (part.type ? [part.type] : [])),
      ),
    ].join(', '),
    castNote(cast),
    forwardNote(activity.forward),
    spent && 'No slots left',
    !usedFromApp(activity) && 'Used in Foundry',
  ]
}

/**
 * Does an action roll something beside its uses, which in a narrow list folds them away until it
 * opens: an attack, a saving throw, damage or healing, an enchantment, a check or a formula? Not a
 * plain Use, which leaves room for them.
 */
export function foldsUses(
  action: SheetAction,
  view: ReturnType<typeof viewOf>,
): boolean {
  return (
    action.toHit !== null ||
    !!action.save ||
    !!view.formula ||
    (!!view.uses.chip && !!enchantOf(action.activity)) ||
    !!action.check ||
    !!action.rollFormula
  )
}

/**
 * Where the description an action opens to is from, as what's rolled from it is named: the spell
 * an item is listed for, and the item, such as "Starry Wisp (Worn Bardic Eternal Flame)"; a spell
 * and the item it's cast from, if any; or else the item.
 */
export function originOf(
  action: SheetAction,
  spell?: SheetSpell,
): DescriptionOrigin {
  const { cast } = action
  if (cast?.text) {
    const name =
      spell?.name ??
      action.activityName ??
      action.activities?.[0]?.name ??
      action.name
    return {
      name: spellOrigin({
        name,
        castFrom: { name: action.castFrom?.name ?? action.name },
      }),
      item: action.id,
    }
  }
  if (action.type === 'spell') {
    return { name: spellOrigin(action), item: action.id }
  }
  return { name: action.name, item: action.id }
}

/**
 * What an action is, over its facts: for an item listed for a spell it casts, the spell's level,
 * and its school where the Spells tab lists it, and whom it's cast from; or else a spell's level,
 * or the item's type.
 */
export function metaOf(
  action: SheetAction,
  spell?: SheetSpell,
): string | undefined {
  const { cast } = action
  if (!cast?.text) {
    return joinParts(kindOf(action), !action.identified && 'Not identified')
  }
  const from = action.castFrom?.name ?? action.name
  if (spell) {
    return joinParts(
      spellKind(spell),
      cast.concentration && 'Concentration',
      `From ${from}`,
    )
  }
  return joinParts(
    cast.level === 0 ? 'Cantrip' : `Level ${cast.level} spell`,
    cast.concentration && 'Concentration',
    `Cast from ${from}`,
  )
}

/** What an action is: a spell's level, or else the item's type. */
function kindOf(action: SheetAction): string | undefined {
  if (action.type === 'spell') {
    return joinParts(
      action.level === 0 ? 'Cantrip' : `Level ${action.level ?? '?'} spell`,
      action.concentration && 'Concentration',
    )
  }
  return joinParts(KINDS[action.type], action.concentration && 'Concentration')
}

/**
 * An action's damage or healing, read for rolling: each part's formula as dice and numbers, its
 * dice with what Foundry does with them, such as Great Weapon Fighting's 2d6r<=2. Unset when
 * there's none, or a formula is beyond reading, such as one with a function in it. From module
 * 0.36.0, where the game plans it on its own, its item and activity and that plan too.
 */
function damageTarget(
  action: SheetAction,
  healing: boolean,
): DamageTarget | undefined {
  if (action.damage.length === 0) return undefined
  const parts: DamageTarget['parts'] = []
  for (const part of action.damage) {
    // A part with no formula throws nothing, as before.
    const terms = part.formula.trim() === '' ? [] : formulaTerms(part.formula)
    if (!terms) return undefined
    parts.push({ terms, type: part.type })
  }
  // Its attack's activity, or else the one its row uses.
  const activity = action.attackId ?? action.activity?.id
  return {
    label: `${actionTitle(action)} ${healing ? 'healing' : 'damage'}`,
    parts,
    healing,
    formula: action.damage.map(part => part.formula).join(' + '),
    ...(action.attackId && {
      source: { item: action.id, activity: action.attackId },
    }),
    ...(action.tableDamage &&
      activity && {
        alone: { item: action.id, activity, plan: action.tableDamage },
        // Its row, for its choices, from module 0.41.0.
        action,
      }),
  }
}

/**
 * Damage on its own as the row the picker showed has it once its choices are picked, from module
 * 0.41.0: rolled from the plans the game sends for it then, as its chips were drawn from them; as
 * it was where the row has none.
 */
export function pickedTarget(
  target: DamageTarget,
  row: SheetAction,
): DamageTarget {
  const plan = row.tableDamage
  if (!target.alone || !plan) return target
  return { ...target, action: row, alone: { ...target.alone, plan } }
}

/**
 * Damage on its own's plan as picked, from module 0.41.0: where the game takes its choices and
 * sends the row's, the plan they pick, else the plan as it came.
 */
export function pickedPlan(
  plan: TableDamagePlan,
  row: AloneRow | undefined,
  choice: AloneChoice,
): TableDamagePlan {
  return row
    ? alonePlan(
        plan,
        alonePicks(row.action, row.spells, aloneSelection(plan, row, choice)),
      )
    : plan
}

/**
 * The menu that asks which kind damage on its own is rolled as, where its plan offers a choice:
 * titled with what's rolled and how, such as "Fire Breath 6d6 · Critical hit", each kind a way to
 * roll it, critical or at its highest as chosen.
 * @param what - What's rolled: the action's name and the dice the plan picked.
 */
export function aloneKindMenu(
  what: string,
  kinds: { key: string; label: string }[],
  {
    critical,
    maximum,
    healing,
  }: { critical: boolean; maximum: boolean; healing?: boolean },
): { title: string; items: MenuItem<string>[] } {
  const how = [critical && 'Critical hit', maximum && 'Maximum']
    .filter(Boolean)
    .map(word => ` · ${word}`)
    .join('')
  let adjective = ''
  if (critical) adjective = 'critical '
  else if (maximum) adjective = 'maximum '
  return {
    title: `${what}${how}`,
    items: kinds.map(({ key, label }) => ({
      id: key,
      label: healing
        ? `Roll ${adjective}${label}`
        : `Roll ${adjective}${label} damage`,
      icon: healing ? HeartPulse : Swords,
      tint: healing ? 'text-primary' : 'text-damage',
    })),
  }
}

/**
 * What a damage chip's menu offers, of what dice, where it isn't using its spell or feature:
 * for damage due on an attack, as the game will throw it, a critical hit's dice as it doubled
 * them, its highest only where its formula takes no die away nor explodes one, and only where it
 * takes damage changed; for damage on its own, as `aloneMenu` has it; else a critical hit's, but
 * for healing, and its dice changed. None where it would offer nothing.
 * @param due - The damage due on its attack, if any.
 * @param alone - Whether it goes to the table on its own.
 */
export function damageMenuChoices(
  target: DamageTarget,
  {
    modifies,
    due,
    alone,
  }: { modifies: boolean; due?: DueDamage; alone: boolean },
) {
  if (due) {
    if (!modifies) return
    const game = damageRollOf(target.label, due)
    const choices = damageChanges(
      game.parts,
      game.fixed,
      diceTakenAway(due.damage) || unmaximizable(due.damage),
    )
    return choices.length > 0
      ? { parts: game.parts, perDie: game.perDie, choices }
      : undefined
  }
  if (target.alone?.plan && alone) return aloneMenu(target, modifies)
  const changed: RollChoice[] = damageChanges(target.parts)
  const choices: RollChoice[] = target.healing
    ? changed
    : ['critical', ...changed]
  return choices.length > 0 ? { parts: target.parts, choices } : undefined
}

/**
 * What damage on its own's menu offers, as the game will throw it: a critical hit's only where it
 * makes one, never of healing; its highest and its dice changed only where it takes damage changed.
 */
function aloneMenu(target: DamageTarget, modifies: boolean) {
  const { alone } = target
  const plan = alone?.plan
  if (!alone || !plan) return
  const game = aloneRollOf(
    target.label.replace(/ (damage|healing)$/, ''),
    alone,
  )
  const choices: RollChoice[] = [
    ...(plan.critical && !target.healing ? (['critical'] as const) : []),
    ...(modifies && game
      ? damageChanges(
          game.parts,
          game.fixed,
          diceTakenAway(plan.normal) || unmaximizable(plan.normal),
        )
      : []),
  ]
  if (!game || choices.length === 0) return
  return { parts: game.parts, perDie: game.perDie, choices }
}

/**
 * What an action's row says under its name: a note, such as the item an activity is one of; the
 * activity it's listed for; how it's activated, but where its section says it already, and its
 * reach; its kinds of damage; what casting it from an item, or using another, costs; whether it's
 * out of slots, or first used only in Foundry; while it's closed, how many more activities it
 * has; and what recharges its uses.
 * @param more - How many more activities it has than it shows: none while it's open.
 */
export function entryDetail(
  action: SheetAction,
  {
    note,
    section,
    view,
    cast,
    more,
    uses,
  }: {
    note?: string
    section?: string
    view: ReturnType<typeof viewOf>
    cast: SheetCast | null | undefined
    more: number
    uses: SheetUses | null | undefined
  },
): string | undefined {
  return joinParts(
    note,
    action.activityName,
    activationIn(action, section),
    action.range,
    view.types.join(', '),
    castNote(cast),
    forwardNote(action.forward),
    view.spent && 'No slots left',
    firstInFoundry(action) && 'Used in Foundry',
    moreNote(more),
    // What recharges its uses, as dnd5e's stat block says it, in place of "Recharge [5+]".
    uses?.recharge ? rechargeWords(uses.recharge) : undefined,
  )
}
