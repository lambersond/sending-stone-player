import {
  BOX_NOTES,
  BOX_TITLE,
  GM_ROLLS_ROW,
  HELP_SECTIONS,
  PLAYER_ROWS,
} from './constants'
import type {
  BoxNote,
  BoxRow,
  HelpBox,
  HelpFacts,
  HelpSection,
  RowWords,
} from './types'

/** Help's words with the character's name in place of `{name}`. */
export function named(words: string, name: string): string {
  return words.replaceAll('{name}', name)
}

/**
 * Help's sections, with "Dice an item rolls later" only where the campaign's module asks a typing
 * player for those dice, from module 0.44.0, as its hello said last (`TableView['laterDice']`), at
 * either seat, whether or not the game polls now (H6 B): Help never describes what isn't there, and
 * its words never shift as the game stops polling.
 */
export function helpSections(laterDice: boolean): HelpSection[] {
  if (laterDice) return HELP_SECTIONS
  return HELP_SECTIONS.map(section => ({
    ...section,
    parts: section.parts.filter(part => !part.later),
  }))
}

/**
 * The "In this game" box (H2 B), only while the character plays in its campaign: at the player's
 * seat, what the campaign allows them now, with why something may be missing, and while the
 * Gamemaster's game isn't connected, that nothing is made there; at the Gamemaster's, where their
 * rolls here go, and what they may move and remove (H3 B).
 */
export function helpBox(facts: HelpFacts): HelpBox | undefined {
  if (!facts.playing) return undefined
  const title = named(BOX_TITLE, facts.name)
  if (facts.gm) {
    return { title, rows: gmRows(facts), notes: [{ text: BOX_NOTES.gm }] }
  }
  const notes: BoxNote[] = [{ text: BOX_NOTES.player }]
  if (!facts.view.live) notes.push({ text: BOX_NOTES.offline, warn: true })
  return { title, rows: playerRows(facts), notes }
}

/** A row saying its on or its off words. */
function row({ label, on: yes, off: no }: RowWords, on: boolean): BoxRow {
  return { label, says: on ? yes : no, on }
}

/**
 * A row about something this device sends the game, which reaches it only while this device's Send
 * to the table is on (the owner's round 3 decision 2, "Every row about something sent to the game
 * follows Send"): what the campaign allows while it's on; while it's off, the row's own words for
 * that (`unsent`), or else its off words, as nothing of it reaches the game from here.
 */
function sentRow(words: RowWords, on: boolean, send: boolean): BoxRow {
  if (send) return row(words, on)
  return { label: words.label, says: words.unsent ?? words.off, on: false }
}

/**
 * The player's rows, in the brief's order, each from the view their page already has: the rolls
 * and what else the game takes now, none while the character isn't one of its campaign's (as the
 * dice tray reads them); typing in their dice by their own switch; and the campaign's own switches.
 * Those about something this device sends the game follow its Send to the table (`sentRow`), as
 * the page does: its rolls, attacks, dice tray and End turn, the saves the game asks, answered here
 * only while it's on, and the dice their effects add and an item rolls later, asked only of a roll
 * sent. Those dice only while they type theirs in, the later ones only where the campaign's module
 * asks for them (H6 B); Wild Shape only for a sheet that has it.
 */
function playerRows({ view, typing, send }: HelpFacts): BoxRow[] {
  const kinds = view.connected ? (view.rollsToTable ?? []) : []
  const features = view.connected ? (view.rollFeatures ?? []) : []
  const sent = (words: RowWords, on: boolean) => sentRow(words, on, send)
  const typed = typing?.on === true
  const rows = [
    sent(PLAYER_ROWS.rolls, kinds.length > 0),
    sent(PLAYER_ROWS.attacks, kinds.includes('attack')),
    sent(PLAYER_ROWS.prompts, features.includes('prompts')),
    sent(PLAYER_ROWS.tray, kinds.includes('plainRoll')),
    sent(PLAYER_ROWS.endTurn, kinds.includes('endTurn')),
    typingRow(typing),
  ]
  if (typed)
    rows.push(sent(PLAYER_ROWS.effectDice, features.includes('effectDice')))
  if (typed && view.laterDice)
    rows.push(sent(PLAYER_ROWS.laterDice, kinds.includes('dice')))
  rows.push(
    row(PLAYER_ROWS.hitPoints, view.hitPoints === true),
    row(PLAYER_ROWS.moves, view.moves !== undefined),
    row(PLAYER_ROWS.removes, view.removes === true),
    row(PLAYER_ROWS.favorites, view.favorites === true),
    row(PLAYER_ROWS.effects, view.effects === true),
  )
  if (view.sheet?.wildShape || view.sheet?.form) {
    rows.push(row(PLAYER_ROWS.wildShape, view.wildShape === true))
  }
  return rows
}

/** Typing in their dice: on, allowed but off, which their Settings turn on, or not in this game. */
function typingRow(typing: HelpFacts['typing']): BoxRow {
  const { label, on, allowed, off } = PLAYER_ROWS.typing
  if (!typing) return { label, says: off, on: false }
  return { label, says: typing.on ? on : allowed, on: true }
}

/**
 * The Gamemaster's rows: where their rolls here go, made in the game only while their own Send to
 * the table is on here, and what they may move and remove.
 */
function gmRows({ view, name, send }: HelpFacts): BoxRow[] {
  const rolls = view.gm?.rolls ?? 'off'
  const where = rolls === 'made' && !send ? 'unsent' : rolls
  return [
    {
      label: GM_ROLLS_ROW.label,
      says: named(GM_ROLLS_ROW[where], name),
      on: where === 'made',
    },
    row(PLAYER_ROWS.moves, view.moves !== undefined),
    row(PLAYER_ROWS.removes, view.removes === true),
  ]
}
