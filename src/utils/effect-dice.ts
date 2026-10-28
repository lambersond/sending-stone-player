import { readModifier } from '@/utils/dice-modifiers'
import { formatExtraTerm, type ExtraDice } from '@/utils/roll-modifiers'
import type { RollSource } from '@/types/roll'
import type { CharacterSheet, SheetEffectDie } from '@/types/sending-stone'
import type { TableAsk, TablePrompt } from '@/types/table'

/*
 * The dice a character's effects add to its d20 rolls, or take from them, such as Bless's d4 or
 * Bane's, as module 0.42.0 lists them on its sheet: which of them a roll is asked for, for a player
 * typing in their dice, as dnd5e adds them to it; and the words the dice dialog says them in. And,
 * for a typed roll whose rerolls its player makes at the table, its terms without them.
 */

/** What a prompt a saving throw answers asks, as far as the dice effects add to it go. */
export type EffectPrompt = Pick<TablePrompt, 'type' | 'source'>

/** What a description's link a saving throw is made from asks: a save, or a concentration check. */
export type EffectAsk = Pick<TableAsk, 'type'>

/**
 * A roll as the dice dialog is asked for it: what it is, for the game to make it too; and for a
 * saving throw a description's link calls for, what that link asks, which only the page showing
 * the description knows.
 */
export type EffectRoll = { source?: RollSource; ask?: EffectAsk }

/**
 * The rolls a roll is, as a sheet's dice of effects name those they're on: every roll of its kind,
 * and it by its key, such as "save" and "save.dex". A concentration check, from a description's
 * link or a prompt, dnd5e's card's or Midi-QOL's, is a saving throw and a concentration check both:
 * the game makes each with dnd5e's concentration check, Midi-QOL's too, and that adds
 * concentration's own bonus to it.
 * @param prompt - What the prompt it answers asks, if it answers one, whoever asks it.
 * @param ask - What the description's link it's made from asks, if it's made from one.
 */
export function rollTokens(
  source: RollSource,
  { prompt, ask }: { prompt?: EffectPrompt; ask?: EffectAsk } = {},
): string[] {
  switch (source.kind) {
    case 'attack': {
      return ['attack']
    }
    case 'save': {
      const tokens = ['save', `save.${source.key}`]
      const concentration = prompt
        ? prompt.type === 'concentration'
        : source.link !== undefined && ask?.type === 'concentration'
      return concentration ? [...tokens, 'concentration'] : tokens
    }
    case 'death': {
      return ['death']
    }
    case 'ability': {
      return ['check', `check.${source.key}`]
    }
    case 'skill': {
      return ['skill', `skill.${source.key}`]
    }
    case 'tool': {
      return ['tool', `tool.${source.key}`]
    }
    case 'initiative': {
      return ['initiative']
    }
  }
}

/**
 * The keys module 0.42.0 writes on a die an effect adds. The sheet's schema drops an entry with any
 * other; one stored by a later build of this app, before it was rolled back, is passed over here.
 */
const EFFECT_DIE_KEYS = new Set([
  'name',
  'effect',
  'faces',
  'count',
  'sign',
  'on',
])

/**
 * The dice the character's effects add to this roll, or take from it, in the sheet's order: each
 * whose rolls are among those it is, and that says nothing more than module 0.42.0 does, as a later
 * module's die the game doesn't add itself would. None for a roll the game doesn't make, or a
 * sheet that lists none.
 * @param prompts - The prompts the table is asked, where the roll may answer one of them.
 */
export function effectDiceFor(
  sheet: Pick<CharacterSheet, 'effectDice'> | null | undefined,
  request: EffectRoll,
  prompts: readonly (EffectPrompt & Pick<TablePrompt, 'id'>)[] = [],
): SheetEffectDie[] {
  const { source } = request
  const dice = sheet?.effectDice ?? []
  if (!source || dice.length === 0) return []
  const answers =
    'prompt' in source && source.prompt !== undefined
      ? prompts.find(({ id }) => id === source.prompt)
      : undefined
  const tokens = new Set(
    rollTokens(source, { prompt: answers, ask: request.ask }),
  )
  return dice.filter(
    die =>
      Object.keys(die).every(key => EFFECT_DIE_KEYS.has(key)) &&
      die.on.some(token => tokens.has(token)),
  )
}

/**
 * A term as its player rerolled it at the table, and typed in the dice they kept: without the
 * rerolls Foundry would make, as `r<=2` or `rr<3`, which the game drops too, and with everything
 * else, such as what it explodes, keeps or counts at least.
 */
export function withoutRerolls<
  T extends Pick<ExtraDice, 'sides' | 'modifiers'>,
>(term: T): T {
  if (!term.modifiers?.length) return term
  const modifiers = term.modifiers.filter(
    text => readModifier(text, term.sides)?.kind !== 'reroll',
  )
  return modifiers.length === term.modifiers.length
    ? term
    : { ...term, modifiers }
}

/** A die an effect adds, as the dice dialog heads it: such as "Bless: +1d4" or "Bane: −1d4". */
export function effectTermLabel(
  die: Pick<SheetEffectDie, 'name' | 'faces' | 'count' | 'sign'>,
): string {
  const term = formatExtraTerm({
    sign: die.sign,
    count: die.count,
    sides: die.faces,
  })
  return `${die.name}: ${term}`
}

/** A die an effect adds, said as a player rolls it: "d4", or for two of them, "2d4". */
export function dieWords(die: Pick<SheetEffectDie, 'faces' | 'count'>): string {
  return `${die.count > 1 ? die.count : ''}d${die.faces}`
}

/**
 * What a typed total leaves out, said after it, of the dice of effects skipped for the game to
 * roll: one by its effect, as "not counting Bless’s d4"; more by how many dice, as "not counting 2
 * dice the game rolls". Nothing for none.
 */
export function skippedWords(
  dice: readonly Pick<SheetEffectDie, 'name' | 'faces' | 'count'>[],
): string {
  if (dice.length === 0) return ''
  if (dice.length === 1) {
    const [die] = dice
    return `not counting ${die.name}’s ${dieWords(die)}`
  }
  const count = dice.reduce((all, die) => all + die.count, 0)
  return `not counting ${count} dice the game rolls`
}
