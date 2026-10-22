import { noteRefusalWords } from './note-words'
import { seatWords, type SeatRole } from './seat-words'
import type { NoteBookKind, NoteOrderState, NoteRefusal } from '@/types/notes'

/*
 * What the journal says of a group's order and of a note moved to a chapter (round 0.35.0 §9.6), in
 * words, never in colour alone: where an order stands, what's said once one is saved, why one was
 * refused at once, who sees it, and where a note being put in order now is.
 */

/** An order's state, as its chip says it; nothing where it's the same here and in Foundry. */
export function orderStateWords(state: NoteOrderState): string | undefined {
  switch (state) {
    case 'waiting': {
      return 'Order waiting for the game'
    }
    case 'saving': {
      return 'Order saving to the game…'
    }
    case 'conflict': {
      return 'Order changed in Foundry'
    }
    case 'failed': {
      return 'Order not saved to the game'
    }
    default: {
      return undefined
    }
  }
}

/** What the journal says once an order is saved: when it reaches Foundry, while it can't now. */
export function orderSavedWords({
  live,
  orders,
  role,
}: {
  /** The game takes notes and is fetching them now. */
  live: boolean
  /** The campaign's module takes orders, 0.35.0 or later. */
  orders: boolean
  role: SeatRole
}): string {
  const { game } = seatWords(role)
  // A module before 0.35.0 never takes it, however long it's open: that's said first.
  if (!orders) {
    return `Order saved. It goes to Foundry once ${game} has Sending Stone 0.35.0 or later.`
  }
  if (!live) return `Order saved. It goes to Foundry when ${game} is next open.`
  return 'Order saved.'
}

/**
 * Why the app refused an order at once, or couldn't send it, as Reorder's footer says it: where a
 * note's words speak of text being edited, an order's speak of the order.
 * @param name - The book's character, for one no longer in the campaign.
 */
export function orderRefusalWords(
  refusal: NoteRefusal | 'network',
  name: string,
): string {
  switch (refusal) {
    case 'changed': {
      return 'The order changed while you were arranging it. Cancel to see the latest, then try again.'
    }
    case 'saving': {
      return 'The last order is still on its way to the game. Try again in a moment.'
    }
    case 'gone': {
      return 'That chapter isn’t there any more.'
    }
    case 'network': {
      return 'Sending Stone couldn’t be reached. Your order is still here: try again.'
    }
    case 'private': {
      return 'No player can see this party in Foundry, so its notes can’t be reordered.'
    }
    // A note's words ask to check its title and text, which an order hasn't.
    case 'invalid':
    case 'chapter': {
      return 'Sending Stone couldn’t read that order. Cancel to see the latest, then try again.'
    }
    default: {
      return noteRefusalWords(refusal, name)
    }
  }
}

/**
 * What the journal says once a note is moved.
 * @param chapter - The title of the chapter it went to; null where it left its chapter for none.
 */
export function movedWords(chapter: string | null): string {
  return chapter === null ? 'Moved out of its chapter.' : `Moved to ${chapter}.`
}

/**
 * Who sees the order, over the list being put in order.
 * @param name - The book's character or party.
 */
export function reorderLine(kind: NoteBookKind, name: string): string {
  return kind === 'party'
    ? `Everyone in ${name} sees the notes in this order, here and in Foundry.`
    : 'Your notes keep this order here and in Foundry.'
}

/**
 * What's announced as a note moves in the list.
 * @param place - Where it is now, from 1.
 * @param of - How many notes the list holds.
 */
export function movedTo(title: string, place: number, of: number): string {
  return `${title}, now ${place} of ${of}.`
}
