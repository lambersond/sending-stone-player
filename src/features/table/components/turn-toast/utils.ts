import { NOT_MADE } from '@/constants/lifecycle'
import { currentCombatant } from '@/features/table/utils/combat'
import {
  actingLine,
  endTurnWords,
  HOLD_HINT,
  newlyNotMade,
  reasonSentence,
  refusalKey,
  TURN_TOAST_FOR,
  TURN_UNDO_FOR,
  turnFragment,
  turnSendingLine,
} from '@/features/table/utils/end-turn'
import type {
  Card,
  CardBody,
  CardNext,
  CardStep,
  Sent,
  ToastInputs,
  ToastSeen,
} from '@/features/table/types'
import type { EndedTurn } from '@/types/roll'
import type { SeatRole } from '@/types/seats'
import type { TableCombat } from '@/types/table'

/** Whether the page shows this turn now: its combat, started, at its round and combatant. */
export function showsTurn(
  combat: TableCombat | undefined,
  turn: EndedTurn,
): boolean {
  return (
    combat?.started === true &&
    combat.id === turn.combatId &&
    combat.round === turn.round &&
    combat.currentId === turn.combatantId
  )
}

/**
 * Whether Undo's card has done its work: the page shows the turn it takes back, as the panel's
 * heading does, whatever Undo's way says by now. The table's poll and the checks of Undo's way run
 * apart, and the game moves the turn before it answers, so the panel can show the turn back a
 * check before Undo's way says it's made: the card goes with the panel, never a check later.
 */
export function takenBack(
  card: CardBody,
  combat: TableCombat | undefined,
): boolean {
  return card.kind === 'taking' && showsTurn(combat, card.turn)
}

/** Who acts as the page shows the combat: by name, and whether it's the viewer's own character. */
export function actingOf(
  combat: TableCombat | undefined,
): { name: string; mine: boolean } | undefined {
  if (!combat?.started) return undefined
  const current = currentCombatant(combat)
  return current && { name: current.name, mine: current.side === 'me' }
}

/** How long a card shows, from when it's shown; none for one that follows a press or a way. */
export function lastsOf(card: Card): number | undefined {
  if (card.kind === 'ended') return card.undo ? TURN_UNDO_FOR : TURN_TOAST_FOR
  if (card.kind === 'refused' || card.kind === 'kept') return TURN_TOAST_FOR
  return undefined
}

/** A card's words, and the line under them, as the seat reads them. */
export function wordsOf(
  card: Card,
  sent: Sent | undefined,
  role: SeatRole,
): { words: string; line?: string } {
  const words = endTurnWords(card.turn)
  switch (card.kind) {
    case 'holding': {
      return { words: words.ending, line: HOLD_HINT }
    }
    case 'sending': {
      const way = sent?.turn === card.turn ? sent.way : undefined
      return {
        words: words.ending,
        line: turnSendingLine(way ?? { status: 'sending' }, role),
      }
    }
    case 'ended': {
      return { words: words.ended, line: card.line }
    }
    case 'refused': {
      const fragment = turnFragment(card.key, role)
      return {
        words: `${words.notEnded}.`,
        line: fragment && reasonSentence(fragment),
      }
    }
    case 'taking': {
      return { words: words.takingBack }
    }
    case 'kept': {
      const fragment = turnFragment(card.key, role)
      return {
        words: words.notTakenBack,
        line: fragment && reasonSentence(fragment),
      }
    }
  }
}

/**
 * The card a hold's took the place of, shown again as a new one for what was left of its time, as
 * the hold sent nothing; none where its time was up.
 * @param remaining - What's left of the time of the card that lasts, by its number.
 */
function uncovered(
  back: Card | undefined,
  remaining: { serial: number; ms: number } | undefined,
): CardNext {
  if (!back) return undefined
  const lasts = lastsOf(back)
  if (lasts === undefined) return { make: back }
  const left = remaining?.serial === back.serial ? remaining.ms : lasts
  if (left <= 0) return undefined
  return { make: back, ms: left }
}

/**
 * A hold past half a second says it's ending the turn, taking the place of the card shown. Let go
 * early, drifted or stopped, it goes at once, silently, and the card it took the place of, such as
 * the last End Turn's with Undo, comes back where it's still to be shown.
 */
function holdStep(
  card: Card | undefined,
  was: ToastSeen,
  now: ToastInputs,
  covered: Card | undefined,
  remaining: { serial: number; ms: number } | undefined,
): Omit<CardStep, 'tell'> {
  if (now.held && !was.held && now.turn) {
    return {
      next: { make: { kind: 'holding', turn: now.turn } },
      cover: true,
      uncover: false,
    }
  }
  if (!now.held && was.held && card?.kind === 'holding') {
    return { next: uncovered(covered, remaining), cover: false, uncover: true }
  }
  return { next: card && { card }, cover: false, uncover: false }
}

/**
 * What the End Turn sent last says: a hold's on its way; the game made it, with who acts now, or
 * with Undo while that's offered, told once, as the page shows the combat moved on; or it wasn't
 * made, which the toast says for a hold's, or for the button's where the combat isn't shown.
 * @param told - The End Turns whose ending has been told, by their ids.
 */
function wayStep(
  next: CardNext,
  was: ToastSeen,
  now: ToastInputs,
  told: ReadonlySet<string>,
): { next: CardNext; tell?: string } {
  const { sent, via, combat, offer } = now
  let step: { next: CardNext; tell?: string } = { next }
  if (sent && sent.turn !== was.sent?.turn && via === 'hold') {
    step = { next: { make: { kind: 'sending', turn: sent.turn } } }
  }
  const id = sent?.way.status === 'done' ? sent.way.requestId : undefined
  if (sent && id && !told.has(id) && !showsTurn(combat, sent.turn)) {
    const undo = offer?.requestId === id
    const left = undo ? offer.left : actingOf(combat)
    step = {
      next: {
        make: {
          kind: 'ended',
          id,
          turn: sent.turn,
          line: left && actingLine(left),
          undo,
        },
      },
      tell: id,
    }
  }
  if (newlyNotMade(was.sent, sent) && (via === 'hold' || !now.combatShown)) {
    step = {
      ...step,
      next: {
        make: { kind: 'refused', turn: sent.turn, key: refusalKey(sent.way) },
      },
    }
  }
  return step
}

/**
 * What Undo's way says: the card goes as the page shows the turn taken back, or says Undo wasn't
 * made; and once Undo is no longer offered, as the page shows another turn, the card offering it
 * goes, silently.
 */
function undoStep(next: CardNext, now: ToastInputs): CardNext {
  const body = next && ('card' in next ? next.card : next.make)
  if (body?.kind === 'taking') {
    if (takenBack(body, now.combat)) return undefined
    const { undone } = now
    if (undone?.for === body.id && NOT_MADE.has(undone.status)) {
      return {
        make: { kind: 'kept', turn: body.turn, key: refusalKey(undone) },
      }
    }
  }
  if (body?.kind === 'ended' && body.undo && now.offer?.requestId !== body.id) {
    return undefined
  }
  return next
}

/**
 * The toast's card from one render to the next: what happened since the last render, in the order
 * it did; the last card made shows.
 * @param was - What was last seen of the hold and the End Turn sent last.
 * @param kept - The End Turns told, the card a hold's took the place of, and what's left of the
 *   time of the card that lasts.
 */
export function nextCard(
  card: Card | undefined,
  was: ToastSeen,
  now: ToastInputs,
  kept: {
    told: ReadonlySet<string>
    covered?: Card
    remaining?: { serial: number; ms: number }
  },
): CardStep {
  const hold = holdStep(card, was, now, kept.covered, kept.remaining)
  const way = wayStep(hold.next, was, now, kept.told)
  return { ...hold, next: undoStep(way.next, now), tell: way.tell }
}
