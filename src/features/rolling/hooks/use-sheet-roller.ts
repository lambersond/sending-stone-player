'use client'

import { useCallback, useState } from 'react'
import {
  CUSTOM_COLORSET_KEY,
  executeRoll,
  themeToBoxConfig,
  toDiceBoxNotation,
  type DiePool,
  type DieSides,
  type ExecuteRollOptions,
  type RollResult,
} from '@lambersond/3d-dice-core'
import { useDiceRenderer } from '@lambersond/3d-dice-react'
import {
  effectTermLabel,
  skippedWords,
  withoutRerolls,
} from '@/features/rolling/utils/effect-dice'
import {
  d20Count,
  d20Label,
  ELVEN_DIE,
  ELVEN_LABEL,
  ELVEN_LINE,
  typedResult,
} from '@/features/rolling/utils/typed-dice'
import {
  criticalParts,
  EVERY_DIE_TWICE,
  withModifiers,
} from '@/utils/damage-modifiers'
import { throwTerm } from '@/utils/dice-modifiers'
import { formatExtraTerm } from '@/utils/roll-modifiers'
import type { DiceEntryTerm, EnterDice } from '@/types/dice-entry'
import type {
  SheetRoll,
  LocalCheck,
  SheetDamageRoll,
  LocalDamage,
  SheetFormulaRoll,
  LocalFormula,
  TypedRolls,
  LocalRoll,
  LocalUse,
  LocalMove,
  LocalAsk,
  LocalExtra,
  ExtraDice,
  ExtraTerm,
  WildShapeLogged,
  SheetOffer,
  RollSource,
} from '@/types/roll'
import type { SheetEffectDie, EffectOp, PrepareOp } from '@/types/sending-stone'

/** The dice, in the app's jade. */
const DICE_THEME = themeToBoxConfig({
  colorset: CUSTOM_COLORSET_KEY,
  material: 'glass',
  customColor: '#00805a',
})

/** How long the dice may tumble before the result is shown regardless, in milliseconds. */
export const ANIMATION_TIMEOUT = 15_000

/** How many of this page's rolls are kept. */
export const ROLL_HISTORY = 20

/**
 * The most terms a roll may add, as the roll request's schema holds them (`MAX_EXTRAS`), which the
 * dice offered, from module 0.42.1, are added among: said again here, and pinned to it by a test,
 * so that this page's bundle takes none of the server's schemas.
 */
export const MOST_EXTRAS = 10

/** The rolls that are checks, which pass a DC, rather than save against it. */
const CHECKS = new Set<RollSource['kind']>(['skill', 'tool', 'ability'])

/** A random source that lands every die on its highest face, for damage at its highest. */
const HIGHEST = () => 1 - Number.EPSILON

/**
 * Said under the dice dialog's subtitle of damage or a formula whose dice reroll, where the game
 * keeps the dice typed as the player kept them at the table (module 0.42.0).
 */
export const REROLL_NOTE =
  'Reroll at the table as your feature says, and type in the die you keep.'

/** A die an effect adds, as the player typed it: no values where it was skipped. */
type TypedEffect = { die: SheetEffectDie; values: number[] }

/** A die offered, as the player typed it: no values where they left it out. */
type TypedOffer = { offer: SheetOffer; values: number[] }

/** How many uses and asks this page has kept, for their ids. */
let uses = 0

/**
 * Rolls checks, saves, attacks and damage from the player's character sheet, tumbling 3D dice
 * across the screen. Each result is revealed once the dice land on it, and kept on this page, as
 * are the spells and features used, which throw no dice. While the player types in their own
 * dice (module 0.32.0), each roll asks for them once its dice are known, in place of throwing any,
 * and is kept at once, with nothing to animate. Must be used within a DiceRendererProvider.
 * @param onThrown - Told of each check or save as its dice are thrown, before they land, with
 * what they came to: to have the Gamemaster's game make it too.
 * @param onDamageThrown - The same, for damage.
 * @param onFormulaThrown - The same, for a hit die or a formula.
 * @param typedRolls - While the player types in their own dice, from module 0.42.0: the dice
 * effects add to each roll, asked for after the player's own, and whether the dice typed are kept
 * as rerolled at the table; and from 0.42.1, whether each roll goes to the game, for Elven
 * Accuracy's third d20 to be skipped, and the dice the sheet offers it, which the player may add.
 * @returns With `roll`, `rollDamage` and `rollFormula`, each resolving true once its roll is kept,
 * or false where the player cancelled typing its dice in.
 */
export function useSheetRoller(
  onThrown?: (roll: SheetRoll, check: LocalCheck) => void,
  onDamageThrown?: (roll: SheetDamageRoll, damage: LocalDamage) => void,
  onFormulaThrown?: (roll: SheetFormulaRoll, rolled: LocalFormula) => void,
  /** While the player types in their own dice: asks for them, once a roll's dice are known. */
  enter?: EnterDice,
  typedRolls?: TypedRolls,
) {
  const renderer = useDiceRenderer()
  const [rolls, setRolls] = useState<LocalRoll[]>([])
  const [inFlight, setInFlight] = useState(0)

  // Throws the dice already rolled, then keeps what they came to; or, for dice the player typed
  // in, which they threw themselves, keeps it at once.
  const land = useCallback(
    async (thrown: RollResult, kept: LocalRoll, animate = true) => {
      if (!animate) {
        setRolls(earlier => keeping(earlier, kept))
        return
      }
      setInFlight(count => count + 1)
      try {
        // The animation is only decoration: if it fails or never settles, the result stands.
        if (renderer.isReady && thrown.pools.length > 0) {
          await within(
            renderer.roll(toDiceBoxNotation(thrown), { theme: DICE_THEME }),
            ANIMATION_TIMEOUT,
          )
        }
      } catch (error) {
        console.error('Dice animation failed', error)
      } finally {
        setInFlight(count => count - 1)
      }
      setRolls(earlier => keeping(earlier, kept))
    },
    [renderer],
  )

  const roll = useCallback(
    async (request: SheetRoll): Promise<boolean> => {
      const { label, modifier, advantage, extras = [] } = request
      // Extra dice are rolled on their own, since advantage applies only to the check's d20,
      // and thrown with it.
      const dice = extras.filter(term => 'sides' in term)
      const pools = dice.map(({ count, sides }) => ({ count, sides }))
      let result: RollResult
      let extra: RollResult | undefined
      let typedEffects: TypedEffect[] = []
      // The dice offered that the player added, from module 0.42.1, in order.
      let added: SheetOffer[] = []
      let typed = false
      // Elven Accuracy's third d20 skipped, from 0.42.1, for the game to roll.
      let thirdSkipped = false
      if (enter) {
        // The player's own d20s; then, from 0.42.1, Elven Accuracy's third with advantage, where
        // dnd5e gives the attack it, on a line of its own, which they may skip for the game to roll
        // where the roll goes to the game, unless it adds a d20 of theirs, whose value the game
        // would give the third throw; then each die they added. The d20s typed so far, the third
        // among them, count for what the higher of them shows, or the lower, and nothing while
        // none is. Then, from module 0.42.0, each die the character's effects add, or take away,
        // such as Bless's d4, which they may skip for the game to roll. Last, from module 0.42.1,
        // each die the sheet offers, such as Bardic Inspiration's, left out until they add it once
        // the roll fails: as many as the roll's own extras leave room for, as it's sent among them.
        const elven =
          ELVEN_LINE && advantage === 'adv' && request.elvenAccuracy === true
        const skips =
          elven &&
          (typedRolls?.sends?.(request) ?? false) &&
          !dice.some(term => term.sides === 20)
        const count = d20Count(
          advantage,
          request.elvenAccuracy === true && !ELVEN_LINE,
        )
        const effects = typedRolls?.effectsFor(request) ?? []
        const offers = (typedRolls?.offersFor?.(request) ?? []).slice(
          0,
          Math.max(0, MOST_EXTRAS - extras.length),
        )
        // The terms by their places: the d20s, Elven Accuracy's third, the player's own dice, the
        // effects', then the offers'.
        const lead = elven ? 2 : 1
        const firstEffect = lead + dice.length
        // Each term's values as the roll's: Elven Accuracy's third among the d20s, as one more of
        // them, or none where it's skipped; the player's own dice; the effects'; the offers'.
        const split = (values: number[][]) => {
          const [group = [], ...after] = values
          const third = elven ? (after.shift() ?? []) : []
          return {
            d20s: [...group, ...third],
            third,
            own: after.slice(0, dice.length),
            effects: effects.map((die, at) => ({
              die,
              values: after[dice.length + at] ?? [],
            })),
            offers: offers.map((offer, at): TypedOffer => ({
              offer,
              values: after[dice.length + effects.length + at] ?? [],
            })),
          }
        }
        // An offer added is thrown as one more of the player's own dice, after theirs, as it's
        // sent: so it's counted, and kept, as any die they add.
        const typedCheck = ({
          d20s,
          own,
          effects: typedOnes,
          offers: offered,
        }: ReturnType<typeof split>) => {
          const adding = offered.filter(({ values }) => values.length > 0)
          const thrown = [
            ...pools,
            ...adding.map(({ offer }) => ({
              count: offer.die.count,
              sides: offer.die.faces,
            })),
          ]
          return {
            result: typedResult([{ sides: 20, count: 1 }], [d20s], {
              advantage,
              modifier,
            }),
            extra:
              thrown.length > 0
                ? typedResult(thrown, [
                    ...own,
                    ...adding.map(({ values }) => values),
                  ])
                : undefined,
            effects: typedOnes,
            added: adding.map(({ offer }) => offer),
          }
        }
        const elvenTerm: DiceEntryTerm[] = elven
          ? [
              {
                sides: 20,
                count: 1,
                label: ELVEN_LABEL,
                name: ELVEN_DIE.name,
                ...(skips && { skippable: true as const }),
              },
            ]
          : []
        const values = await enter({
          title: label,
          terms: [
            { sides: 20, count, label: d20Label(advantage, count) },
            ...elvenTerm,
            ...dice.map(term => ({
              sides: term.sides,
              count: term.count,
              label: formatExtraTerm(term),
            })),
            ...effects.map(die => ({
              sides: die.faces,
              count: die.count,
              label: effectTermLabel(die),
              skippable: true as const,
              name: die.name,
            })),
            ...offers.map(({ die }) => ({
              sides: die.faces,
              count: die.count,
              label: effectTermLabel(die),
              name: die.name,
              offered: true as const,
            })),
          ],
          total: values => {
            const soFar = split(typedSoFar(values))
            const shown = typedCheck({
              ...soFar,
              d20s: soFar.d20s.length > 0 ? soFar.d20s : [0],
            })
            return withEffects(
              toLocalRoll(
                label,
                shown.result,
                [...extras, ...offerTerms(shown.added)],
                shown.extra,
              ),
              shown.effects,
            ).total
          },
          until: request.until,
          signal: request.signal,
          ...((effects.length > 0 || skips) && {
            skippedWords: (skipped: number[]) =>
              skippedWords(
                skipped.flatMap(
                  (at): Pick<SheetEffectDie, 'name' | 'faces' | 'count'>[] => {
                    const die =
                      elven && at === 1 ? ELVEN_DIE : effects[at - firstEffect]
                    return die ? [die] : []
                  },
                ),
              ),
          }),
        })
        if (!values) return false
        const kept = split(values)
        ;({ result, extra, effects: typedEffects, added } = typedCheck(kept))
        thirdSkipped = elven && kept.third.length === 0
        typed = true
      } else {
        result = executeRoll({
          pools: [{ sides: 20, count: 1 }],
          modifier,
          advantage,
        })
        extra =
          pools.length > 0 ? executeRoll({ pools, modifier: 0 }) : undefined
      }
      const thrown = extra
        ? { ...result, pools: [...result.pools, ...extra.pools] }
        : result
      // The dice offered that the player added, from module 0.42.1, go to the game as the last of
      // the roll's extras, as Modify Roll's added dice do: kept so, named by what offers them.
      const offered = offerTerms(added)
      const asked: SheetRoll =
        offered.length > 0
          ? { ...request, extras: [...extras, ...offered] }
          : request
      const check = withEffects(
        withOffers(
          toLocalRoll(label, result, [...extras, ...offered], extra),
          extras.length,
          added,
        ),
        typedEffects,
      )
      if (added.length > 0) check.spends = added.map(({ spends }) => spends)
      // Elven Accuracy's third d20 skipped is the game's, as an effect's die skipped is: the total
      // here leaves it out.
      if (thirdSkipped) check.skipped = true
      if (typed) check.typed = true
      // Its d20, as typed, is the one kept, such as a Halfling's 1 they rerolled at the table.
      if (typed && typedRolls?.keptRerolls) check.rerolls = 'kept'
      const { source } = request
      if (request.dc !== undefined) check.dc = request.dc
      if (source && 'text' in source && source.text) {
        check.described = true
        // Against its DC, which the game may know where the description keeps it from the player.
        if (CHECKS.has(source.kind)) check.verdict = 'check'
      }
      // A check an activity asks for is passed or failed against its DC, as the game says, as is
      // one Midi-QOL asks for.
      if (
        source &&
        ('activity' in source || 'prompt' in source) &&
        CHECKS.has(source.kind)
      ) {
        check.verdict = 'check'
      }
      onThrown?.(asked, check)
      await land(thrown, check, !typed)
      return true
    },
    [land, onThrown, enter, typedRolls],
  )

  const rollDamage = useCallback(
    async (request: SheetDamageRoll): Promise<boolean> => {
      const {
        label,
        critical = false,
        healing = false,
        exact = false,
        modifiers,
        perDie = 1,
      } = request
      // Changed as the player chose: the game's dice take as many more for each die added as it
      // throws for each; those rolled here are doubled after, for a critical hit, or made a
      // critical hit's as the world's rules make one, where they're given, or as dnd5e makes one
      // by default, where it adds anything; with what it adds, either way.
      const changed = withModifiers(
        request.parts,
        modifiers,
        exact ? perDie : 1,
      )
      const { criticalAdds } = request
      const rule = critical
        ? (request.criticalRule ?? (criticalAdds && EVERY_DIE_TWICE))
        : undefined
      const parts = rule ? criticalParts(changed, rule, criticalAdds) : changed
      // As dnd5e rolls a critical hit by default: twice the dice, the same numbers added. Dice
      // the game gave, or made as its rules make them, are thrown as they are.
      const doubled = critical && !exact && !rule
      const dice = parts.flatMap(({ terms }) =>
        terms.filter(term => 'sides' in term),
      )
      const maximized = modifiers?.maximize === true
      const pools = dice.map(({ count, sides }) => ({
        count: doubled ? count * 2 : count,
        sides,
      }))
      const flags = { critical, healing, doubled, maximized }
      // The player's own dice, every one the app would throw; but none at their highest, which the
      // game makes so itself, nor of damage whose dice only the game knows. From module 0.42.0,
      // where the game keeps the dice typed as rerolled at the table, each die typed is the one
      // kept: a reroll asks for nothing, and only a die exploded leaves its total to the game.
      if (enter && !maximized && dice.length > 0) {
        const kept = typedRolls?.keptRerolls === true
        const typedDamage = (values: number[][]) => {
          const none = noRethrows()
          const result = typedResult(pools, values)
          const damage = toLocalDamage(
            label,
            parts,
            result,
            flags,
            none.more,
            kept,
          )
          return { result, damage, asked: none.asked }
        }
        const values = await enter({
          title: label,
          terms: damageEntryTerms(parts, doubled),
          total: values => typedDamage(typedSoFar(values)).damage.total,
          ...(kept &&
            dice.some(term => rerolls(term)) && { note: REROLL_NOTE }),
        })
        if (!values) return false
        const { result, damage, asked } = typedDamage(values)
        damage.typed = true
        if (kept) damage.rerolls = 'kept'
        if (request.text) damage.described = true
        if (rule?.altered || asked() || request.gameTotal) {
          damage.gameTotal = true
        }
        onDamageThrown?.({ ...request, parts }, damage)
        await land(result, damage, false)
        return true
      }
      const options = maximized ? { rng: HIGHEST } : undefined
      const result = executeRoll({ pools, modifier: 0 }, options)
      // The dice Foundry would throw again, rerolled or exploded, thrown after the first throw.
      const again = rethrows(options)
      const damage = toLocalDamage(label, parts, result, flags, again.more)
      if (request.text) damage.described = true
      if (
        rule?.altered ||
        damage.parts.some(part => rethrown(part.terms)) ||
        request.gameTotal
      ) {
        damage.gameTotal = true
      }
      onDamageThrown?.({ ...request, parts }, damage)
      await land(again.with(result), damage)
      return true
    },
    [land, onDamageThrown, enter, typedRolls],
  )

  const rollFormula = useCallback(
    async (request: SheetFormulaRoll): Promise<boolean> => {
      // A formula is a set of one, thrown once.
      const sets = request.sets ?? [{ terms: request.terms, times: 1 }]
      // Every set's dice in one throw, each set's terms' dice thrown as many times as it is.
      const pools = sets.flatMap(({ terms, times }) =>
        terms.flatMap(term =>
          'sides' in term
            ? [{ count: term.count * times, sides: term.sides }]
            : [],
        ),
      )
      // The player's own dice, each set's as many times as it's thrown; from module 0.42.0, kept
      // as rerolled at the table where the game keeps them so, as damage's are.
      if (enter && pools.length > 0) {
        const kept = typedRolls?.keptRerolls === true
        const typedFormula = (values: number[][]) => {
          const none = noRethrows()
          const result = typedResult(pools, values)
          const rolled = toLocalFormula(request, sets, result, none.more, kept)
          return { result, rolled, asked: none.asked }
        }
        const rerolling = sets.some(({ terms }) =>
          terms.some(term => 'sides' in term && rerolls(term)),
        )
        const values = await enter({
          title: request.label,
          terms: formulaEntryTerms(request, sets),
          total: values => typedFormula(typedSoFar(values)).rolled.total,
          ...(kept && rerolling && { note: REROLL_NOTE }),
        })
        if (!values) return false
        const { result, rolled, asked } = typedFormula(values)
        rolled.typed = true
        if (kept) rolled.rerolls = 'kept'
        if (asked()) rolled.gameTotal = true
        onFormulaThrown?.(request, rolled)
        await land(result, rolled, false)
        return true
      }
      const result = executeRoll({ pools, modifier: 0 })
      // The dice Foundry would throw again, rerolled or exploded, thrown after the first throw:
      // only a formula thrown once has any, never hit dice.
      const again = rethrows()
      const rolled = toLocalFormula(request, sets, result, again.more)
      onFormulaThrown?.(request, rolled)
      await land(again.with(result), rolled)
      return true
    },
    [land, onFormulaThrown, enter, typedRolls],
  )

  // Keeps a spell or feature used, first among the rolls.
  const logUse = useCallback(
    (label: string, spell: boolean, itemCast?: boolean): LocalUse => {
      const used: LocalUse = {
        kind: 'use',
        id: `use-${Date.now()}-${++uses}`,
        label,
        spell,
        ...(itemCast && { itemCast }),
        at: Date.now(),
      }
      setRolls(earlier => keeping(earlier, used))
      return used
    },
    [],
  )

  // Keeps an enchantment ended, first among the rolls, as a use is.
  const logEnd = useCallback((label: string): LocalUse => {
    const ended: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label,
      spell: false,
      ending: true,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, ended))
    return ended
  }, [])

  // Keeps charges spent, or Heroic Inspiration used or gained, first among the rolls, as a use is;
  // and from module 0.42.1, a spell slot spent or restored.
  const logCharge = useCallback(
    (
      label: string,
      change: Pick<LocalUse, 'spent' | 'inspiration' | 'slot'>,
    ): LocalUse => {
      const changed: LocalUse = {
        kind: 'use',
        id: `use-${Date.now()}-${++uses}`,
        label,
        spell: false,
        ...(change.spent !== undefined && { spent: change.spent }),
        ...(change.inspiration && { inspiration: change.inspiration }),
        ...(change.slot && { slot: change.slot }),
        at: Date.now(),
      }
      setRolls(earlier => keeping(earlier, changed))
      return changed
    },
    [],
  )

  // Keeps items or coins moved, from module 0.31.0, first among the rolls, as a use is.
  const logMove = useCallback((move: LocalMove): LocalUse => {
    const moved: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label: move.things,
      spell: false,
      move,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, moved))
    return moved
  }, [])

  // Keeps a favorite added or removed, from module 0.37.0, first among the rolls, as a use is.
  const logFavorite = useCallback(
    (label: string, op: 'add' | 'remove'): LocalUse => {
      const favorited: LocalUse = {
        kind: 'use',
        id: `use-${Date.now()}-${++uses}`,
        label,
        spell: false,
        favorite: op,
        at: Date.now(),
      }
      setRolls(earlier => keeping(earlier, favorited))
      return favorited
    },
    [],
  )

  // Keeps a spell prepared or unprepared, from module 0.42.1, first among the rolls, as a use is.
  const logPrepare = useCallback((label: string, op: PrepareOp): LocalUse => {
    const prepared: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label,
      spell: false,
      prepare: op,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, prepared))
    return prepared
  }, [])

  // Keeps one of the character's own effects turned off, on or deleted, from module 0.39.0, first
  // among the rolls, as a use is; or from 0.42.1, where it's made for a roll, as Inspired is once
  // the roll its Bardic Inspiration was added to is made, at a time just before that roll's, so
  // that it's kept beneath it, the roll still the latest.
  const logEffect = useCallback(
    (label: string, op: EffectOp, at = Date.now()): LocalUse => {
      const changed: LocalUse = {
        kind: 'use',
        id: `use-${Date.now()}-${++uses}`,
        label,
        spell: false,
        effect: op,
        at,
      }
      setRolls(earlier => keeping(earlier, changed))
      return changed
    },
    [],
  )

  // Keeps Wild Shape used from here, from module 0.40.0, first among the rolls, as a use is.
  const logWildShape = useCallback((wildShape: WildShapeLogged): LocalUse => {
    const shaped: LocalUse = {
      kind: 'use',
      id: `use-${Date.now()}-${++uses}`,
      label: 'Wild Shape',
      spell: false,
      wildShape,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, shaped))
    return shaped
  }, [])

  // Keeps the table asked for a saving throw or check, first among the rolls.
  const logAsk = useCallback((label: string): LocalAsk => {
    const asked: LocalAsk = {
      kind: 'ask',
      id: `ask-${Date.now()}-${++uses}`,
      label,
      at: Date.now(),
    }
    setRolls(earlier => keeping(earlier, asked))
    return asked
  }, [])

  return {
    roll,
    rollDamage,
    rollFormula,
    logUse,
    logEnd,
    logCharge,
    logMove,
    logFavorite,
    logPrepare,
    logEffect,
    logWildShape,
    logAsk,
    rolls,
    rolling: inFlight > 0,
  }
}

/**
 * A d20 roll with the dice its effects add that the player typed in, from module 0.42.0: each
 * after the player's own extras, so that those keep their places, which the game's dice are read
 * by, named by what adds it, such as "Bless +1d4", and added to the total, or taken from it, by
 * its sign, as the app's own dice of the roll are all added; and the dice as the game is sent them.
 * A die skipped is the game's: neither among them nor in the total, which says so.
 */
function withEffects(check: LocalCheck, effects: TypedEffect[]): LocalCheck {
  if (effects.length === 0) return check
  const typed = effects.filter(({ values }) => values.length > 0)
  const added = typed.map(({ die, values }) => ({
    text: `${die.name} ${formatExtraTerm({ sign: die.sign, count: die.count, sides: die.faces })}`,
    values,
    value: die.sign * values.reduce((sum, value) => sum + value, 0),
  }))
  return {
    ...check,
    extras: [...check.extras, ...added],
    total: added.reduce((total, { value }) => total + value, check.total),
    ...(typed.length > 0 && {
      effectDice: typed.map(({ die, values }) => ({
        faces: die.faces,
        sign: die.sign,
        results: values,
      })),
    }),
    ...(typed.length < effects.length && { skipped: true as const }),
  }
}

/** The dice offered that the player added, from module 0.42.1, as the roll's extras send them. */
function offerTerms(added: readonly SheetOffer[]): ExtraTerm[] {
  return added.map(({ die }) => ({
    sign: 1,
    count: die.count,
    sides: die.faces,
  }))
}

/**
 * A d20 roll with the dice offered that the player added, from module 0.42.1, such as Bardic
 * Inspiration's: among its extras already, after the player's own, as the game is sent them; each
 * named by what offers it, as "Bardic Inspiration +1d6", as an effect's die is.
 * @param from - Where they start among the extras: after the player's own.
 */
function withOffers(
  check: LocalCheck,
  from: number,
  added: readonly SheetOffer[],
): LocalCheck {
  if (added.length === 0) return check
  return {
    ...check,
    extras: check.extras.map((extra, at) => {
      const offer = at >= from ? added[at - from] : undefined
      return offer
        ? { ...extra, text: `${offer.die.name} ${extra.text}` }
        : extra
    }),
  }
}

function toLocalRoll(
  label: string,
  result: RollResult,
  extras: ExtraTerm[],
  extra: RollResult | undefined,
): LocalCheck {
  const [d20] = result.pools
  // The extra dice's pools are in the order their terms were written.
  const pools = [...(extra?.pools ?? [])]
  const added = extras.map(term => {
    const values = 'sides' in term ? (pools.shift()?.kept ?? []) : []
    const amount =
      'sides' in term
        ? values.reduce((sum, value) => sum + value, 0)
        : term.flat
    return {
      text: formatExtraTerm(term),
      values,
      value: term.sign * amount,
    }
  })
  return {
    kind: 'check',
    id: result.id,
    label,
    total: added.reduce((total, { value }) => total + value, result.total),
    modifier: result.modifier,
    advantage: result.advantage,
    d20s: d20.rolls[0],
    natural: d20.kept[0],
    extras: added,
    at: result.at,
  }
}

/**
 * A hit die spent, or a formula rolled, as this page keeps it, from its dice as thrown: each set's
 * pools in the order their sets and terms were written, each with every time's dice, the first's
 * first.
 * @param more - Throws the dice Foundry would throw again, rerolled or exploded.
 * @param rerollsKept - Its dice were typed as kept once rerolled at the table (module 0.42.0).
 */
function toLocalFormula(
  request: SheetFormulaRoll,
  sets: NonNullable<SheetFormulaRoll['sets']>,
  result: RollResult,
  more: More,
  rerollsKept = false,
): LocalFormula {
  const { label, healing = false, minimum } = request
  const pools = [...result.pools]
  const thrown = sets.map(({ terms }) =>
    terms.map(term => ('sides' in term ? (pools.shift()?.kept ?? []) : [])),
  )
  // Only a formula thrown once has dice thrown again, never hit dice.
  const kept: LocalExtra[] = request.sets
    ? setTerms(sets, thrown)
    : request.terms.map((term, index) => {
        const text = damageTerm(term, {
          first: index === 0,
          doubled: false,
        })
        if (!('sides' in term)) {
          return { text, values: [], value: term.sign * term.flat }
        }
        const done = landTerm(term, thrown[0][index], more, rerollsKept)
        return { text, ...done.extra, value: term.sign * done.amount }
      })
  const sum = kept.reduce((total, { value }) => total + value, 0)
  const totals = request.sets
    ? formulaTotals(sets, thrown, minimum)
    : [minimum === undefined ? sum : Math.max(minimum, sum)]
  const total = totals.reduce((all, each) => all + each, 0)
  return {
    kind: 'formula',
    id: result.id,
    label,
    total,
    healing,
    terms: kept,
    ...(total !== sum && { minimum }),
    ...(totals.length > 1 && { times: totals.length }),
    ...(request.source?.kind === 'textRoll' && { described: true }),
    ...(rethrown(kept) && { gameTotal: true }),
    // Thrown or typed in, a recharge's d6 is titled by what it recharges, as the game answers.
    ...(request.recharge && {
      recharge: { name: request.label.replace(/ recharge$/, '') },
    }),
    at: result.at,
  }
}

/**
 * What each time each set is thrown came to, at least its least, as hit dice spent at once each
 * give back at least 1.
 * @param thrown - Each set's dice, term by term, every time's together, the first's first.
 */
function formulaTotals(
  sets: NonNullable<SheetFormulaRoll['sets']>,
  thrown: number[][][],
  minimum: number | undefined,
): number[] {
  return sets.flatMap(({ terms, times }, set) =>
    Array.from({ length: times }, (_, time) => {
      let sum = 0
      for (const [index, term] of terms.entries()) {
        const amount =
          'sides' in term
            ? thrown[set][index]
                .slice(time * term.count, (time + 1) * term.count)
                .reduce((sum, value) => sum + value, 0)
            : term.flat
        sum += term.sign * amount
      }
      return minimum === undefined ? sum : Math.max(minimum, sum)
    }),
  )
}

/** What's typed in so far, each term's dice as typed, those not yet left out. */
function typedSoFar(values: (number | undefined)[][]): number[][] {
  return values.map(term =>
    term.filter((value): value is number => value !== undefined),
  )
}

/**
 * Damage's dice for the player to type in: each term's, its count doubled where the app doubles
 * it, named as the tray writes it, with its part's kind, such as "2d6 Slashing" or "−1d4".
 */
function damageEntryTerms(
  parts: SheetDamageRoll['parts'],
  doubled: boolean,
): DiceEntryTerm[] {
  let first = true
  return parts.flatMap(({ terms, type }) =>
    terms.flatMap(term => {
      const text = damageTerm(term, { first, doubled })
      first = false
      if (!('sides' in term)) return []
      return [
        {
          sides: term.sides,
          count: doubled ? term.count * 2 : term.count,
          label: type ? `${text} ${type}` : text,
        },
      ]
    }),
  )
}

/**
 * A formula's dice for the player to type in: each term's, as the tray writes it; or, thrown in
 * sets, as hit dice spent at once are, each set's term's every time's together, such as "2d10".
 */
function formulaEntryTerms(
  request: SheetFormulaRoll,
  sets: NonNullable<SheetFormulaRoll['sets']>,
): DiceEntryTerm[] {
  if (!request.sets) {
    return request.terms.flatMap((term, index) =>
      'sides' in term
        ? [
            {
              sides: term.sides,
              count: term.count,
              label: damageTerm(term, { first: index === 0, doubled: false }),
            },
          ]
        : [],
    )
  }
  const terms: DiceEntryTerm[] = []
  for (const { terms: each, times } of sets) {
    for (const term of each) {
      if (!('sides' in term)) continue
      const count = term.count * times
      terms.push({
        sides: term.sides,
        count,
        label: damageTerm(
          { ...term, count },
          { first: terms.length === 0, doubled: false },
        ),
      })
    }
  }
  return terms
}

/**
 * Throws so many more of a die, for one Foundry rerolls or explodes, which `throwTerm` asks for one
 * at a time.
 */
type More = (sides: DieSides) => (count: number) => number[]

/**
 * No dice thrown again: the player's are typed in, and Foundry throws its rerolls itself. Whether
 * any was asked for says the game's total counts, once it says.
 */
function noRethrows() {
  let asked = false
  const none = (): number[] => {
    asked = true
    return []
  }
  const more: More = () => none
  return { more, asked: () => asked }
}

/**
 * The dice thrown again, rerolled or exploded, after the first throw: `more` throws them, as the
 * first throw was, and `with` adds them to it, to be thrown with it, as extra dice are.
 */
function rethrows(options?: ExecuteRollOptions) {
  const pools: DiePool[] = []
  const more: More = sides => count => {
    const thrown = executeRoll(
      { pools: [{ sides, count }], modifier: 0 },
      options,
    )
    pools.push(...thrown.pools)
    return thrown.pools[0]?.kept ?? []
  }
  return {
    more,
    with: (result: RollResult): RollResult =>
      pools.length > 0
        ? { ...result, pools: [...result.pools, ...pools] }
        : result,
  }
}

/**
 * A term of dice as it landed: what its dice count for, as Foundry works out any modifiers they
 * have, such as 2d6r<=2's reroll, which throws more after; its first throw, and every die thrown
 * where it has modifiers.
 * @param rerollsKept - Its dice were typed as kept once rerolled at the table, from module 0.42.0:
 * without its rerolls, which the game drops too, and with the rest, as what it explodes or counts
 * at least.
 */
function landTerm(
  term: ExtraDice,
  values: number[],
  more: More,
  rerollsKept = false,
): { amount: number; extra: Pick<LocalExtra, 'values' | 'thrown'> } {
  const landing = rerollsKept ? withoutRerolls(term) : term
  if (!landing.modifiers?.length) {
    return {
      amount: values.reduce((sum, value) => sum + value, 0),
      extra: { values },
    }
  }
  const thrown = throwTerm(landing, values, more(term.sides))
  return {
    amount: thrown.total,
    extra: { values, thrown: thrown.dice },
  }
}

/** Does a term reroll any of its dice, such as 2d6r<=2? */
function rerolls(term: ExtraDice): boolean {
  return withoutRerolls(term) !== term
}

/** Was any die of these terms rerolled or exploded, which Foundry throws again itself? */
function rethrown(terms: LocalExtra[]): boolean {
  return terms.some(({ thrown }) =>
    thrown?.some(die => die.rerolled || die.exploded),
  )
}

function toLocalDamage(
  label: string,
  parts: SheetDamageRoll['parts'],
  result: RollResult,
  {
    critical,
    healing,
    doubled,
    maximized,
  }: {
    critical: boolean
    healing: boolean
    doubled: boolean
    maximized: boolean
  },
  more: More,
  rerollsKept = false,
): LocalDamage {
  // The dice's pools are in the order their terms were written.
  const pools = [...result.pools]
  let first = true
  const kept = parts.map(({ terms, type }) => {
    const done = terms.map((term): LocalExtra => {
      const text = damageTerm(term, { first, doubled })
      first = false
      if (!('sides' in term)) {
        return { text, values: [], value: term.sign * term.flat }
      }
      const landed = landTerm(
        term,
        pools.shift()?.kept ?? [],
        more,
        rerollsKept,
      )
      return { text, ...landed.extra, value: term.sign * landed.amount }
    })
    return {
      type,
      total: done.reduce((sum, { value }) => sum + value, 0),
      terms: done,
    }
  })
  // As dnd5e's card adds damage up: each kind's parts together, each kind at least 0, then every
  // kind; each part's own total as it came.
  const kinds = new Map<string | null, number>()
  for (const { type, total } of kept) {
    kinds.set(type, (kinds.get(type) ?? 0) + total)
  }
  return {
    kind: 'damage',
    id: result.id,
    label,
    total: [...kinds.values()].reduce(
      (sum, kind) => sum + Math.max(0, kind),
      0,
    ),
    critical,
    healing,
    ...(maximized && { maximized }),
    parts: kept,
    at: result.at,
  }
}

/**
 * Sets thrown at once, as hit dice spent at once, term by term: each set's dice, every time's
 * together, such as 2d10, then +1d8, in order; then all of their numbers added up, such as +9,
 * where they come to any.
 */
function setTerms(
  sets: NonNullable<SheetFormulaRoll['sets']>,
  thrown: number[][][],
): LocalExtra[] {
  const dice: LocalExtra[] = []
  let flat = 0
  for (const [set, { terms, times }] of sets.entries()) {
    for (const [index, term] of terms.entries()) {
      if (!('sides' in term)) {
        flat += term.sign * term.flat * times
        continue
      }
      const values = thrown[set][index]
      dice.push({
        text: damageTerm(
          { ...term, count: term.count * times },
          { first: dice.length === 0, doubled: false },
        ),
        values,
        value: term.sign * values.reduce((sum, value) => sum + value, 0),
      })
    }
  }
  if (flat === 0) return dice
  return [
    ...dice,
    {
      text: damageTerm(
        { sign: flat < 0 ? -1 : 1, flat: Math.abs(flat) },
        { first: dice.length === 0, doubled: false },
      ),
      values: [],
      value: flat,
    },
  ]
}

/**
 * A term of a damage roll as thrown: 1d8 first, then +4 or −1d4, its dice doubled on a crit, with
 * what Foundry does with them, such as 2d6r<=2.
 */
function damageTerm(
  term: ExtraTerm,
  { first, doubled }: { first: boolean; doubled: boolean },
): string {
  let sign = first ? '' : '+'
  if (term.sign < 0) sign = '−'
  if ('flat' in term) return `${sign}${term.flat}`
  const count = doubled ? term.count * 2 : term.count
  return `${sign}${count}d${term.sides}${term.modifiers?.join('') ?? ''}`
}

/**
 * The rolls kept, and another, newest first by when each was thrown rather than when its dice
 * landed: a roll thrown while the dice of one before it still tumble is the latest, should they
 * land after it.
 */
function keeping(earlier: LocalRoll[], roll: LocalRoll): LocalRoll[] {
  return [roll, ...earlier]
    .toSorted((a, b) => b.at - a.at)
    .slice(0, ROLL_HISTORY)
}

/** Wait for a promise, but no longer than this many milliseconds. */
async function within(promise: Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise(resolve => {
    timer = setTimeout(resolve, ms)
  })
  try {
    await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}
