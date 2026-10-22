import { seatWords, type SeatRole } from './seat-words'
import type {
  NoteBookKind,
  NoteReason,
  NoteRefusal,
  NoteState,
  NotesView,
} from '@/types/notes'

/*
 * What the Notes section says of a book and its notes (round 0.34.0 §9.4-§9.7), in words, never
 * in colour alone: who sees them, why they can't reach Foundry now, where each note stands, why
 * the game refused a change, and why the app refused one at once.
 */

/** A note's state, as its chip says it; nothing for one the same here and in Foundry. */
export function noteStateWords(state: NoteState): string | undefined {
  switch (state) {
    case 'waiting': {
      return 'Waiting for the game'
    }
    case 'saving': {
      return 'Saving to the game…'
    }
    case 'deleting': {
      return 'Deleted here, waiting for the game'
    }
    case 'conflict': {
      return 'Changed in Foundry'
    }
    case 'gone': {
      return 'Deleted in Foundry'
    }
    case 'failed': {
      return 'Not saved to the game'
    }
    default: {
      return undefined
    }
  }
}

/**
 * Why the game refused a change, as a clause after "Not saved to {game}:" (§3.6): the
 * Gamemaster's own game is "your game", the player's "your Gamemaster’s game".
 */
export function noteReasonWords(reason: NoteReason, role: SeatRole): string {
  const { game } = seatWords(role)
  switch (reason) {
    case 'off': {
      return `${game} doesn’t take notes now`
    }
    case 'invalid': {
      return `${game} couldn’t read it`
    }
    case 'unknown': {
      return 'that character isn’t in the campaign any more'
    }
    case 'private': {
      return 'no player can see this party in Foundry'
    }
    case 'not-member': {
      return 'the character can’t see this party in Foundry now'
    }
    case 'not-yours': {
      return 'only its author can change it'
    }
    case 'foundry-only': {
      return 'it can only be changed in Foundry'
    }
    case 'headings': {
      return 'it has a # or ## heading, which only chapters and notes may be'
    }
    case 'full': {
      return 'the journal is full'
    }
    case 'changed': {
      return 'it was changed in Foundry meanwhile'
    }
    case 'gone': {
      return 'it was deleted in Foundry meanwhile'
    }
    default: {
      return `something went wrong in ${game}`
    }
  }
}

/**
 * Why the app refused a change at once, or couldn't send it, as the editor and the problem panel
 * say it (§9.7).
 * @param name - The book's character, for one no longer in the campaign.
 */
export function noteRefusalWords(
  refusal: NoteRefusal | 'network',
  name: string,
): string {
  switch (refusal) {
    case 'not-yours': {
      return 'Only its author can change it.'
    }
    case 'changed': {
      return 'It changed while you were editing. Your text is still here: copy what you need, then cancel to see the latest.'
    }
    case 'saving': {
      return 'Your last change is still on its way to the game. Try again in a moment.'
    }
    case 'conflict': {
      return 'It was changed in Foundry too. Choose which to keep first.'
    }
    case 'foundry-only': {
      return 'It can only be changed in Foundry.'
    }
    case 'private': {
      return 'No player can see this party in Foundry, so notes can’t be added.'
    }
    case 'unknown': {
      return `${name} is no longer one of the campaign’s characters.`
    }
    case 'headings': {
      return 'Use ### or more for headings: # and ## are the journal’s chapters and notes.'
    }
    case 'gone': {
      return 'That chapter isn’t there any more.'
    }
    case 'full': {
      return 'This journal is full: 300 notes, 50 chapters and a million characters at most.'
    }
    case 'busy': {
      return 'Too many changes at once. Wait a moment.'
    }
    case 'network': {
      return 'Sending Stone couldn’t be reached. Your text is still here.'
    }
    default: {
      return 'Check the title and the note.'
    }
  }
}

/**
 * Why the app refused a Delete or a problem panel's choice, or couldn't send it, as the section's
 * status line says it: the editor's words, but where those speak of text still being edited, as
 * none is then, they say how things stand. The book is read again after a refusal, so the list
 * already shows it as it is now.
 * @param name - The book's character, for one no longer in the campaign.
 */
export function noteChoiceRefusalWords(
  refusal: NoteRefusal | 'network',
  name: string,
): string {
  switch (refusal) {
    case 'changed': {
      return 'It changed meanwhile: here’s how it stands now.'
    }
    case 'saving': {
      return 'Its last change is still on its way to the game. Try again in a moment.'
    }
    case 'network': {
      return 'Sending Stone couldn’t be reached. Try again in a moment.'
    }
    default: {
      return noteRefusalWords(refusal, name)
    }
  }
}

/** Who sees a book, under its heading (§9.4 item 1). */
export function whoSeesNotes({
  kind,
  role,
  name,
  journal,
}: {
  kind: NoteBookKind
  role: SeatRole
  /** The book's character or party. */
  name: string
  /** The journal's name in Foundry, once it has one. */
  journal: string | null | undefined
}): string {
  if (kind === 'party') {
    return `Everyone in ${name} sees these, here and in Foundry.`
  }
  if (role === 'gm') return `Only ${name}’s player and you see these.`
  const seen = 'Only you and your Gamemaster see these.'
  return journal ? `${seen} In Foundry they’re in “${journal}”.` : seen
}

/**
 * The one banner a book shows, the first that applies (§9.4 item 2): its character gone from the
 * campaign, a module too old to take notes, a journal too large to send, or a party no player may
 * see.
 */
export function notesBanner(
  view: NotesView,
  { role, name }: { role: SeatRole; name: string },
): string | undefined {
  if (!view.connected) {
    return `${name} is no longer one of the campaign’s characters, so these notes can’t be changed.`
  }
  if (!view.enabled) {
    return `Notes are kept here for now. They reach Foundry once ${seatWords(role).game} connects with Sending Stone 0.34.0 or later.`
  }
  if (view.withheld?.reason === 'tooLarge') {
    // Foundry may hold a journal back before the app has ever been told its name.
    const journal = view.journal ? `“${view.journal}”` : 'The journal'
    return `${journal} is too large to send from Foundry, so changes made there don’t show here.`
  }
  if (view.withheld?.reason === 'private') {
    return `No player can see ${name} in Foundry, so its notes aren’t shared.`
  }
  return undefined
}

/** What the status line says once a note is saved: when it reaches Foundry, while it can't now. */
export function savedWords(live: boolean, role: SeatRole): string {
  return live
    ? 'Saved.'
    : `Saved. It goes to Foundry when ${seatWords(role).game} is next open.`
}
