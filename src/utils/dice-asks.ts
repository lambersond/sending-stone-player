import { DICE_ASK_WAIT } from '@/constants/sending-stone'
import type { SheetSeat } from '@/types/character'
import type { DiceAskData, HeldDiceAsk } from '@/types/dice-asks'
import type { FoundrySnapshot } from '@/types/foundry-settings'
import type { DiceAnswerTerm, RollKind } from '@/types/roll'
import type { GameDiceAsk } from '@/types/sending-stone'
import type { TableDiceAsk } from '@/types/table'

/*
 * The dice of a later roll in a typed roll's run, which the game asks of its player before it
 * throws them (module 0.44.0): held as the module described them, until it says they closed, or
 * their wait runs out; shown to their player to type in; checked as they're answered; and how long
 * they held the roll whose run they're in, which isn't lost meanwhile.
 */

/**
 * When a dice ask was asked, and when its wait ends, by this app's clock: as for a Midi prompt,
 * counted from when the module sent it, by the envelope's time, as a hello may be the first to
 * carry one that has waited a while; never longer than the game waits. Where the envelope's time
 * is before it was asked, which one clock can't make it, it's counted from when it was asked.
 * @param sentAt - When the module sent it, by the game's clock.
 */
export function askTimes(
  ask: Pick<GameDiceAsk, 'askedAt' | 'expiresAt'>,
  sentAt: string,
  now: number,
): { askedAt: Date; expiresAt: Date } {
  const asked = Date.parse(ask.askedAt)
  const sent = Date.parse(sentAt)
  const from = Number.isNaN(sent) ? asked : Math.max(sent, asked)
  const within = (ms: number) => Math.max(0, Math.min(ms, DICE_ASK_WAIT))
  return {
    askedAt: new Date(now - within(from - asked)),
    expiresAt: new Date(now + within(Date.parse(ask.expiresAt) - from)),
  }
}

/** The module from which the game asks a typing player for the dice it rolls later: 0.44.0. */
const LATER_DICE_FROM = [0, 44, 0] as const

/**
 * Is the campaign's module one that asks a player typing in their dice for the dice an item rolls
 * later, wherever its Gamemaster's switches let it, as its hello said last (the campaign's stored
 * `foundry`), whether or not the game polls now: from module 0.44.0, under dnd5e 5 alone, as the
 * module checks it (PROTOCOL.md, "Dice the game rolls later"; later-dice.mjs, `dnd5e5`). Under
 * any other system, dnd5e 6 among them, it never asks, whatever the switches. Whether it asks now,
 * which the switches and its self-test decide, is the hello's `diceAsks`, never read here.
 */
export function asksLaterDice(
  foundry?: Pick<FoundrySnapshot, 'module' | 'system'> | null,
): boolean {
  const system = foundry?.system
  return (
    system?.id === 'dnd5e' &&
    Number.parseInt(String(system.version)) === 5 &&
    atLeast(foundry?.module?.version, LATER_DICE_FROM)
  )
}

/** Is a version, such as "0.44.0", this one or a later one, by its numbers? One without is not. */
function atLeast(
  version: string | null | undefined,
  from: readonly number[],
): boolean {
  const parts = String(version ?? '')
    .split('.')
    .map(part => Number.parseInt(part))
  for (const [index, least] of from.entries()) {
    const part = parts[index] ?? 0
    if (Number.isNaN(part)) return false
    if (part !== least) return part > least
  }
  return true
}

/**
 * Does a seat see the dice its game asks for, and answer them: its player's alone, never the
 * Gamemaster's, whose rolls open no run; while they type in their dice; and while the game takes
 * the answer now, as it does where it asks.
 * @param rollsToTable - What the seat's rolls the game takes now, as its view says.
 */
export function seesDiceAsks(
  seat: Pick<SheetSeat, 'role' | 'manualDice'>,
  rollsToTable: readonly RollKind[],
): boolean {
  return (
    seat.role === 'player' &&
    seat.manualDice === true &&
    rollsToTable.includes('dice')
  )
}

/** Is it waiting for its player now: open, its wait not over? */
function waiting(
  ask: Pick<HeldDiceAsk, 'expiresAt' | 'closedAt'>,
  now: number,
): boolean {
  return !ask.closedAt && ask.expiresAt.getTime() > now
}

/** The dice asks waiting for their player now, as their page is shown them, oldest first. */
export function toTableDiceAsks(
  held: Pick<
    HeldDiceAsk,
    'askId' | 'commandId' | 'data' | 'expiresAt' | 'closedAt'
  >[],
  now = Date.now(),
): TableDiceAsk[] {
  return held.flatMap(ask => {
    if (!waiting(ask, now)) return []
    const { label, purpose, again, critical, rolls } = ask.data as DiceAskData
    return [
      {
        id: ask.askId,
        command: ask.commandId,
        label,
        purpose,
        ...(again && { again }),
        ...(critical && { critical: true as const }),
        rolls,
        expiresAt: ask.expiresAt.toISOString(),
      },
    ]
  })
}

/** Is any of a roll's dice asks waiting for its player now? */
export function waitsOnDice(
  asks: Pick<HeldDiceAsk, 'expiresAt' | 'closedAt'>[],
  now = Date.now(),
): boolean {
  return asks.some(ask => waiting(ask, now))
}

/**
 * How long a roll's dice asks held it, in milliseconds: each from when it was asked until it
 * closed, its wait ran out, or now, whichever came first; the time two held it together counted
 * once.
 */
export function heldTime(
  asks: Pick<HeldDiceAsk, 'askedAt' | 'expiresAt' | 'closedAt'>[],
  now = Date.now(),
): number {
  const spans = asks
    .map(({ askedAt, expiresAt, closedAt }) => ({
      from: askedAt.getTime(),
      to: Math.min((closedAt ?? expiresAt).getTime(), now),
    }))
    .filter(({ from, to }) => to > from)
    .toSorted((a, b) => a.from - b.from)
  let held = 0
  let reached = -Infinity
  for (const { from, to } of spans) {
    if (to <= reached) continue
    held += to - Math.max(from, reached)
    reached = to
  }
  return held
}

/**
 * Does an answer fit what's asked: each entry one of its rolls' terms, named once, with a value
 * for each of its dice, each one of the die's faces? A term left out is the game's, so none at all
 * fits.
 */
export function answerFits(
  { rolls }: Pick<DiceAskData, 'rolls'>,
  answer: DiceAnswerTerm[],
): boolean {
  const named = new Set<string>()
  return answer.every(({ roll, term, results }) => {
    const asked = rolls[roll]?.terms[term]
    const key = `${roll}.${term}`
    if (!asked || named.has(key)) return false
    named.add(key)
    return (
      results.length === asked.number &&
      results.every(
        value => Number.isInteger(value) && value >= 1 && value <= asked.faces,
      )
    )
  })
}
