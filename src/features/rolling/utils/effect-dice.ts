import { readModifier } from '@/utils/dice-modifiers'
import { formatExtraTerm, type ExtraDice } from '@/utils/roll-modifiers'
import type { RollSource } from '@/types/roll'
import type { CharacterSheet, SheetEffectDie } from '@/types/sending-stone'
import type { TableAsk, TablePrompt } from '@/types/table'

/*
 * The dice a character's effects add to its d20 rolls, or take from them, such as Bless's d4 or
 * Bane's, as module 0.42.0 lists them on its sheet: which of them a roll is asked for, for a player
 * typing in their dice, as dnd5e adds them to it; and from module 0.42.1, the dice a player may add
 * once a roll fails, as Bardic Inspiration's, offered apart; and the words the dice dialog says
 * them in. And, for a typed roll whose rerolls its player makes at the table, its terms without
 * them.
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
 * The keys module 0.42.1 writes on a die an effect adds, or offers. The sheet's schema drops an
 * entry with any other; one stored by a later build of this app, before it was rolled back, is
 * passed over here.
 */
const EFFECT_DIE_KEYS = new Set([
  'name',
  'effect',
  'faces',
  'count',
  'sign',
  'on',
  'offer',
])

/** Whether a die says nothing more than module 0.42.1 does. */
const known = (die: SheetEffectDie) =>
  Object.keys(die).every(key => EFFECT_DIE_KEYS.has(key))

/**
 * The dice the character's effects add to this roll, or take from it, in the sheet's order: each
 * whose rolls are among those it is, and that says nothing more than module 0.42.1 does, as a later
 * module's die the game doesn't add itself would. Never a die the sheet offers, which the game
 * doesn't add either, and which would otherwise be asked, to be skipped, on every roll it's on:
 * those are `offersFor`'s. None for a roll the game doesn't make, or a sheet that lists none.
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
      die.offer !== true &&
      known(die) &&
      die.on.some(token => tokens.has(token)),
  )
}

/**
 * What adding a die the sheet offers spends: the effect it uses up, by the sheet's id for it; that
 * effect's own name, such as "Inspired"; and the offer's, such as "Bardic Inspiration", or "Bardic
 * Inspiration (Vex)" beside another bard's.
 */
export type OfferSpend = { effect: string; name: string; offer: string }

/**
 * A die the sheet offers a roll, from module 0.42.1, which the game doesn't add, for its player to
 * add once the roll fails, as the 2024 Bardic Inspiration's: the die, and what adding it spends.
 */
export type SheetOffer = { die: SheetEffectDie; spends: OfferSpend }

/**
 * The dice the sheet offers this roll, in the sheet's order, from module 0.42.1: each marked
 * `offer`, whose rolls are among those it is, and that says nothing more than module 0.42.1 does.
 * None for a roll the game doesn't make; nor for an answer to a prompt that isn't held, or that
 * Midi-QOL asks, which refuses anything added to its roll; dnd5e's card's takes it.
 * @param prompts - The prompts the table is asked, where the roll may answer one of them.
 */
export function offersFor(
  sheet: Pick<CharacterSheet, 'effectDice' | 'effects'> | null | undefined,
  request: EffectRoll,
  prompts: readonly (EffectPrompt & Pick<TablePrompt, 'id'>)[] = [],
): SheetOffer[] {
  const { source } = request
  const offered = (sheet?.effectDice ?? []).filter(
    die => die.offer === true && known(die),
  )
  if (!source || offered.length === 0) return []
  const prompt = 'prompt' in source ? source.prompt : undefined
  const answers =
    prompt === undefined ? undefined : prompts.find(({ id }) => id === prompt)
  if (prompt !== undefined && (!answers || answers.source !== undefined)) {
    return []
  }
  const tokens = new Set(
    rollTokens(source, { prompt: answers, ask: request.ask }),
  )
  const effects = (sheet?.effects ?? []).flatMap(section => section.effects)
  return offered
    .filter(die => die.on.some(token => tokens.has(token)))
    .map(die => ({
      die,
      spends: {
        effect: die.effect,
        name: effects.find(({ id }) => id === die.effect)?.name ?? die.name,
        offer: die.name,
      },
    }))
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
