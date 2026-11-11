import { DAMAGE_TYPE_LABELS } from '@/constants/dnd5e'
import { typedSoFar } from '@/features/rolling/utils/entry-terms'
import { leftToTheGame } from '@/features/rolling/utils/tray-words'
import type { AskTerm } from '@/features/rolling/types'
import type { DiceEntry } from '@/types/dice-entry'
import type { DiceAnswerTerm, LocalFormula } from '@/types/roll'
import type { DiceAskRoll } from '@/types/sending-stone'
import type { TableDiceAsk } from '@/types/table'

/*
 * The dice the game asks a typing player for, from module 0.44.0, as the dice dialog asks for them:
 * every term of every roll it lists, each the player may skip for the game to roll; what they
 * typed, as the answer the game takes, term by term; and the roll the tray keeps of it.
 */

/** What an ask with no label of its own is called. */
const UNNAMED = 'Dice the game asks for'

/**
 * What an ask is called, wherever it's shown: its label, such as "Ice Knife: Shard Explosion", or
 * where the module gave none, what it is.
 */
export function askName({ label }: Pick<TableDiceAsk, 'label'>): string {
  return label || UNNAMED
}

/** A roll's kind of damage or healing, as dnd5e's card names it, else its flavor, if any. */
function kindOf(roll: DiceAskRoll): string | undefined {
  const { type } = roll
  return type && Object.hasOwn(DAMAGE_TYPE_LABELS, type)
    ? DAMAGE_TYPE_LABELS[type]
    : roll.flavor
}

/** Every term of every roll an ask lists, in the order the game throws them. */
function termsOf(ask: TableDiceAsk): AskTerm[] {
  return ask.rolls.flatMap((roll, rollAt) => {
    const kind = kindOf(roll)
    return roll.terms.map(({ faces, number }, termAt) => {
      const dice = `${number}d${faces}`
      return {
        roll: rollAt,
        term: termAt,
        faces,
        count: number,
        label: kind ? `${dice} ${kind}` : dice,
        name: kind ?? askName(ask),
      }
    })
  })
}

/** A roll's formula, as Foundry writes it, without the flavors it gives its terms, as "[cold]". */
function formulaOf({ formula }: DiceAskRoll): string {
  return formula.replaceAll(/\[[^\]]*\]/g, '')
}

/** Whether a roll's formula is more than the dice asked of it, spaces aside: "2d6 + 3", "1d4x". */
function addsToItsDice(roll: DiceAskRoll): boolean {
  const dice = roll.terms.map(({ number, faces }) => `${number}d${faces}`)
  return formulaOf(roll).replaceAll(/\s/g, '') !== dice.join('+')
}

/**
 * The rolls as the game makes them, where one is more than its dice asked, such as a number it
 * adds, or a die it throws itself: "Rolled as 3d6 Cold, 1d4 + 1d6 + 2 Fire."
 */
function formulaNote(ask: TableDiceAsk): string | undefined {
  if (!ask.rolls.some(roll => addsToItsDice(roll))) return undefined
  const rolls = ask.rolls.map(roll => {
    const kind = kindOf(roll)
    return kind ? `${formulaOf(roll)} ${kind}` : formulaOf(roll)
  })
  return `Rolled as ${rolls.join(', ')}.`
}

/**
 * What's said under the dialog's subtitle: of a die thrown again, why; else the game's formulas,
 * where they add to the dice asked, and that a critical hit's dice are counted twice.
 */
function noteOf(ask: TableDiceAsk): string | undefined {
  if (ask.again === 'explode') {
    return 'Your die exploded: roll it again and type in what it shows.'
  }
  if (ask.again === 'reroll') {
    return 'Your die is rerolled: roll it again and type in what it shows.'
  }
  const critical = ask.critical && 'A critical hit: its dice are counted twice.'
  const notes = [formulaNote(ask), critical].filter(Boolean)
  return notes.length > 0 ? notes.join(' ') : undefined
}

/**
 * The dice dialog's entry for an ask: its label as its title, its formulas as its note where they
 * add to its dice, each term of each roll a group of boxes the player may skip for the game to
 * roll, the time left to answer, and closing it lets the game roll them all. Its total is the dice
 * typed so far: the game adds what its formulas add.
 * @param signal - Aborted once the ask is answered or closed elsewhere: the dialog then closes.
 */
export function askEntry(ask: TableDiceAsk, signal?: AbortSignal): DiceEntry {
  const note = noteOf(ask)
  return {
    title: askName(ask),
    subtitle: 'The game asks for these dice',
    cancelLabel: 'Let the game roll',
    terms: termsOf(ask).map(({ faces, count, label, name }) => ({
      sides: faces,
      count,
      label,
      skippable: true,
      name,
    })),
    total: values =>
      typedSoFar(values)
        .flat()
        .reduce((sum, value) => sum + value, 0),
    until: ask.expiresAt,
    ...(signal && { signal }),
    ...(note && { note }),
    skippedWords: () => 'not counting the dice the game rolls',
  }
}

/**
 * The answer an ask is sent: each term the player typed, by its roll's place and its own, with its
 * values; a term skipped left out, for the game to roll. None typed, or none given, as where the
 * player let the game roll, leaves it every die.
 * @param values - What the dialog gave, term by term: none for a term skipped.
 */
export function answerOf(
  ask: TableDiceAsk,
  values: number[][] = [],
): DiceAnswerTerm[] {
  return termsOf(ask).flatMap(({ roll, term }, at) => {
    const results = values[at] ?? []
    return results.length > 0 ? [{ roll, term, results }] : []
  })
}

/**
 * What the tray keeps of an answer, as a formula rolled: the ask's label, each term with the dice
 * typed, or left to the game, and what the dice typed came to, the game's total in its place once
 * it says, as it adds what its formulas add and throws what was left to it. Of a die thrown again,
 * the die typed alone, and why it was thrown again: the game's total is its whole roll's, which
 * that roll's own line says.
 */
export function answeredRoll(
  ask: TableDiceAsk,
  values: number[][] = [],
): Omit<LocalFormula, 'kind' | 'id' | 'at'> {
  const terms = termsOf(ask).map(({ label }, at) => {
    const text = at === 0 ? label : `+${label}`
    const typed = values[at] ?? []
    const value = typed.reduce((sum, each) => sum + each, 0)
    return typed.length > 0
      ? { text, values: typed, value }
      : { text: leftToTheGame(text), values: [], value: 0 }
  })
  return {
    label: askName(ask),
    total: terms.reduce((sum, { value }) => sum + value, 0),
    healing: ask.purpose === 'healing',
    terms,
    ...(ask.again ? { again: ask.again } : { gameTotal: true }),
    typed: true,
  }
}

/** What an ask's dice are, in words, as its banner says them: such as "2d6 Cold" or "1d4, 1d6". */
export function diceWords(ask: TableDiceAsk): string {
  return termsOf(ask)
    .map(({ label }) => label)
    .join(', ')
}
