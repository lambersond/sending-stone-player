import { ROLL_KIND_INFO } from '@/constants/roll-kinds'
import { changes } from '@/utils/damage-modifiers'
import type { RechargeRoll } from '@/features/rolling/types'
import type {
  ActivityRef,
  FormulaSource,
  LocalCheck,
  LocalDamage,
  LocalFormula,
  RolledDice,
  RollRequestInput,
  RollSource,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
  TextLink,
} from '@/types/roll'

/*
 * The rolls the sheet sends to the Gamemaster's game (`useTableRolls`), as the game is asked to
 * make them: what each is, how it was rolled, and every die thrown, in the order the game reads
 * them.
 */

/**
 * A roll as the game is asked to make it: what it is, how it was rolled, and every die thrown,
 * the d20s first, then the dice of each term the player added, in order.
 */
export function toRollRequest(
  roll: SheetRoll,
  source: RollSource,
  check: LocalCheck,
): RollRequestInput {
  const extras = roll.extras ?? []
  return {
    kind: source.kind,
    ...('key' in source && { key: source.key }),
    ...('combatId' in source && { combatId: source.combatId }),
    // What the game asked for that it answers: a saving throw, or an ability or skill check
    // Midi-QOL asked for.
    ...('prompt' in source && source.prompt && { prompt: source.prompt }),
    // A saving throw or check a description calls for, which the game makes against the DC it
    // names.
    ...('text' in source &&
      source.text !== undefined &&
      source.link !== undefined && { text: source.text, link: source.link }),
    // A check an activity asks for, which the game makes against the activity, as its card does.
    ...(activityCheck(source) && {
      item: source.item,
      activity: source.activity,
    }),
    ...(source.kind === 'attack' && {
      item: source.item,
      activity: source.activity,
      ...(source.targets
        ? { targets: source.targets }
        : // the protocol's for no target
          { target: source.target ?? null }),
      ...(source.slot && { slot: source.slot }),
      ...(source.ammunition && { ammunition: source.ammunition }),
      ...(source.attackMode && { attackMode: source.attackMode }),
    }),
    mode: modeOf(check.advantage),
    explicit: roll.explicit === true,
    extras,
    dice: [
      { faces: 20, results: check.d20s },
      ...extras.flatMap((term, index) =>
        'sides' in term
          ? [{ faces: term.sides, results: check.extras[index].values }]
          : [],
      ),
    ],
    // Its player typed its dice in, from their own, from module 0.32.0.
    ...(check.typed && { typed: true as const }),
    // And from module 0.42.0, the dice its effects add that they typed in, after the dice of the
    // terms they added, none skipped; and that they rerolled at the table, as their feature says.
    ...(check.typed &&
      check.effectDice?.length && { effectDice: check.effectDice }),
    ...(check.typed &&
      check.rerolls === 'kept' && { rerolls: 'kept' as const }),
  }
}

/** Is a roll a check an activity asks for, the player's own, by its item and activity? */
export function activityCheck(
  source: RollSource,
): source is Extract<RollSource, { kind: 'skill' | 'tool' | 'ability' }> &
  ActivityRef {
  return (
    'check' in ROLL_KIND_INFO[source.kind] &&
    'activity' in source &&
    source.item !== undefined &&
    source.activity !== undefined
  )
}

/**
 * A hit die spent, or a formula rolled, as the game is asked to make it: the hit die's size, the
 * formula's item and activity, or the description's link it's in, or from module 0.44.0 a plain
 * roll's dice by size and its number added; and the dice of each of its terms, in order, each
 * term's first throw, as Foundry throws again itself any die it rerolls or explodes.
 */
export function toFormulaRequest(
  roll: SheetFormulaRoll,
  source: Exclude<FormulaSource, { kind: 'hitDice' }>,
  rolled: LocalFormula,
): RollRequestInput {
  return {
    kind: source.kind,
    ...formulaOrigin(source),
    mode: 0,
    explicit: false,
    extras: [],
    dice: roll.terms.flatMap((term, index) =>
      'sides' in term
        ? [{ faces: term.sides, results: rolled.terms[index]?.values ?? [] }]
        : [],
    ),
    ...typedFields(rolled),
  }
}

/**
 * Hit dice spent at once as the game is asked to spend them, from module 0.20.0: how many of each
 * size, the largest first, and each size's dice, as thrown, in the same order.
 */
export function toHitDiceRequest(
  source: Extract<FormulaSource, { kind: 'hitDice' }>,
  rolled: LocalFormula,
): RollRequestInput {
  return {
    kind: 'hitDice',
    hitDice: source.hitDice,
    mode: 0,
    explicit: false,
    extras: [],
    dice: source.hitDice.map(({ denomination }, index) => ({
      faces: Number(denomination.slice(1)),
      results: rolled.terms[index]?.values ?? [],
    })),
    ...typedFields(rolled),
  }
}

/**
 * Hit dice spent at once as a game before module 0.20.0 is asked to spend them: a hit die each, its
 * own die as thrown, the largest first, in the order thrown.
 */
export function toHitDieRequests(
  source: Extract<FormulaSource, { kind: 'hitDice' }>,
  rolled: LocalFormula,
): RollRequestInput[] {
  return source.hitDice.flatMap(({ denomination }, index) =>
    (rolled.terms[index]?.values ?? []).map(value => ({
      kind: 'hitDie' as const,
      denomination,
      mode: 0 as const,
      explicit: false,
      extras: [],
      dice: [{ faces: Number(denomination.slice(1)), results: [value] }],
      ...typedFields(rolled),
    })),
  )
}

/**
 * An action's damage or healing on its own, from module 0.36.0, as the game is asked to roll it:
 * no attack or use made, for the Gamemaster to apply from dnd5e's card. Its slot, attack mode and
 * ammunition, and whether it spends what its use would (`consume`), from module 0.41.0, only to a
 * game that takes them (round 0.41.0 §2.10: `choosing`).
 */
export function toAloneRequest(
  roll: SheetDamageRoll,
  damage: LocalDamage,
  alone: NonNullable<SheetDamageRoll['alone']>,
  { choosing, consume }: { choosing: boolean; consume: boolean },
): RollRequestInput {
  return {
    kind: 'itemDamage',
    item: alone.item,
    activity: alone.activity,
    ...(choosing && alone.slot && { slot: alone.slot }),
    ...(choosing && alone.attackMode && { attackMode: alone.attackMode }),
    ...(choosing && alone.ammunition && { ammunition: alone.ammunition }),
    ...(consume && { consume: true as const }),
    mode: 0,
    explicit: false,
    extras: [],
    dice: damageDice(roll, damage),
    ...damageTail(roll, damage, alone.critical),
  }
}

/**
 * A description's damage or healing, which the game reads from its own copy of it, as the game is
 * asked to roll it: changed as the player chose, and a critical hit's, as the world's rules make
 * one.
 */
export function toTextDamageRequest(
  roll: SheetDamageRoll,
  damage: LocalDamage,
  { text, link }: TextLink,
): RollRequestInput {
  return {
    kind: 'textDamage',
    text,
    link,
    mode: 0,
    explicit: false,
    extras: [],
    dice: damageDice(roll, damage),
    ...damageTail(roll, damage, roll.critical),
  }
}

/** An attack's or a use's damage, as the game is asked to roll it, by the attack's or use's id. */
export function toDamageRequest(
  roll: SheetDamageRoll,
  damage: LocalDamage,
  use: string,
): RollRequestInput {
  return {
    kind: 'damage',
    use,
    mode: 0,
    explicit: false,
    extras: [],
    dice: damageDice(roll, damage),
    ...damageTail(roll, damage),
  }
}

/**
 * A spent recharge rolled, from module 0.36.0, as the game is asked to roll it: dnd5e's own, with
 * the player's d6, for an item's own uses or one of its activities'.
 */
export function toRechargeRequest(
  { counter: { item, activity } }: RechargeRoll,
  rolled: LocalFormula,
): RollRequestInput {
  return {
    kind: 'recharge',
    item,
    ...(activity && { activity }),
    mode: 0,
    explicit: false,
    extras: [],
    dice: [{ faces: 6, results: rolled.terms[0]?.values ?? [] }],
    ...typedFields(rolled),
  }
}

/**
 * A typed roll's own fields, after its dice: that its player typed its dice in, from their own,
 * from module 0.32.0; and from module 0.42.0, that the dice typed are those kept once rerolled at
 * the table, as their feature says.
 */
function typedFields({
  typed,
  rerolls,
}: Pick<LocalFormula, 'typed' | 'rerolls'>): Pick<
  RollRequestInput,
  'typed' | 'rerolls'
> {
  return {
    ...(typed && { typed: true as const }),
    ...(typed && rerolls === 'kept' && { rerolls: 'kept' as const }),
  }
}

/**
 * Damage's own fields, after its dice: the kinds chosen, where any is; a critical hit's, where it's
 * sent as one; how the player changed it, where they did; and, typed, its rerolls made at the
 * table, as typed in, from module 0.42.0.
 */
function damageTail(
  { types, modifiers }: SheetDamageRoll,
  damage: LocalDamage,
  critical?: boolean,
): Pick<
  RollRequestInput,
  'types' | 'critical' | 'modifiers' | 'typed' | 'rerolls'
> {
  return {
    ...(types?.some(type => type !== null) && { types }),
    ...(critical && { critical: true as const }),
    ...(modifiers && changes(modifiers) && { modifiers }),
    ...typedFields(damage),
  }
}

/** What a formula rolled is, for the game to find it. */
function formulaOrigin(
  source: Exclude<FormulaSource, { kind: 'hitDice' }>,
): Partial<RollRequestInput> {
  switch (source.kind) {
    case 'hitDie': {
      return { denomination: source.denomination }
    }
    case 'formula': {
      return { item: source.item, activity: source.activity }
    }
    case 'textRoll': {
      return { text: source.text, link: source.link }
    }
    // From module 0.44.0: the dice picked, by size, and the number added.
    case 'plainRoll': {
      return { plainRoll: source.plainRoll }
    }
  }
}

/**
 * Damage's dice as thrown, part by part and term by term, for the game to roll them too: each
 * term's first throw, as Foundry throws again itself any die it rerolls or explodes.
 */
function damageDice(roll: SheetDamageRoll, damage: LocalDamage): RolledDice[] {
  return roll.parts.flatMap((part, index) =>
    part.terms.flatMap((term, at) =>
      'sides' in term
        ? [
            {
              faces: term.sides,
              results: damage.parts[index]?.terms[at]?.values ?? [],
            },
          ]
        : [],
    ),
  )
}

function modeOf(advantage: LocalCheck['advantage']): -1 | 0 | 1 {
  if (advantage === 'adv') return 1
  if (advantage === 'dis') return -1
  return 0
}
