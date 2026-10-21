/* eslint-disable unicorn/no-null -- a book with no journal in Foundry has null for it */
import {
  noteReasonWords,
  noteRefusalWords,
  notesBanner,
  noteStateWords,
  savedWords,
  whoSeesNotes,
} from './note-words'
import { mockNotesView } from '@/mocks/sending-stone'
import type { NoteReason, NoteRefusal, NoteState } from '@/types/notes'

describe('utils/note-words', () => {
  it.each<[NoteState, string | undefined]>([
    ['synced', undefined],
    ['waiting', 'Waiting for the game'],
    ['saving', 'Saving to the game…'],
    ['deleting', 'Deleted here, waiting for the game'],
    ['conflict', 'Changed in Foundry'],
    ['gone', 'Deleted in Foundry'],
    ['failed', 'Not saved to the game'],
  ])('names the state %s in words', (state, words) => {
    expect(noteStateWords(state)).toBe(words)
  })

  it.each<[NoteReason, string, string]>([
    [
      'off',
      'your Gamemaster’s game doesn’t take notes now',
      'your game doesn’t take notes now',
    ],
    [
      'invalid',
      'your Gamemaster’s game couldn’t read it',
      'your game couldn’t read it',
    ],
    [
      'unknown',
      'that character isn’t in the campaign any more',
      'that character isn’t in the campaign any more',
    ],
    [
      'private',
      'no player can see this party in Foundry',
      'no player can see this party in Foundry',
    ],
    [
      'not-member',
      'the character can’t see this party in Foundry now',
      'the character can’t see this party in Foundry now',
    ],
    [
      'not-yours',
      'only its author can change it',
      'only its author can change it',
    ],
    [
      'foundry-only',
      'it can only be changed in Foundry',
      'it can only be changed in Foundry',
    ],
    [
      'headings',
      'it has a # or ## heading, which only chapters and notes may be',
      'it has a # or ## heading, which only chapters and notes may be',
    ],
    ['full', 'the journal is full', 'the journal is full'],
    [
      'error',
      'something went wrong in your Gamemaster’s game',
      'something went wrong in your game',
    ],
    [
      'changed',
      'it was changed in Foundry meanwhile',
      'it was changed in Foundry meanwhile',
    ],
    [
      'gone',
      'it was deleted in Foundry meanwhile',
      'it was deleted in Foundry meanwhile',
    ],
  ])(
    'says why the game refused a change, %s, to the player and the Gamemaster',
    (reason, player, gm) => {
      expect(noteReasonWords(reason, 'player')).toBe(player)
      expect(noteReasonWords(reason, 'gm')).toBe(gm)
    },
  )

  it.each<[NoteRefusal | 'network', string]>([
    ['invalid', 'Check the title and the note.'],
    ['not-yours', 'Only its author can change it.'],
    [
      'changed',
      'It changed while you were editing. Your text is still here: copy what you need, then cancel to see the latest.',
    ],
    [
      'saving',
      'Your last change is still on its way to the game. Try again in a moment.',
    ],
    ['conflict', 'It was changed in Foundry too. Choose which to keep first.'],
    ['foundry-only', 'It can only be changed in Foundry.'],
    [
      'private',
      'No player can see this party in Foundry, so notes can’t be added.',
    ],
    ['unknown', 'Thorin is no longer one of the campaign’s characters.'],
    [
      'headings',
      'Use ### or more for headings: # and ## are the journal’s chapters and notes.',
    ],
    ['gone', 'That chapter isn’t there any more.'],
    [
      'full',
      'This journal is full: 300 notes, 50 chapters and a million characters at most.',
    ],
    ['busy', 'Too many changes at once. Wait a moment.'],
    ['network', 'Sending Stone couldn’t be reached. Your text is still here.'],
    ['chapter', 'Check the title and the note.'],
  ])('says why the app refused a change at once, %s', (refusal, words) => {
    expect(noteRefusalWords(refusal, 'Thorin')).toBe(words)
  })

  it('says who sees a book', () => {
    expect(
      whoSeesNotes({
        kind: 'personal',
        role: 'player',
        name: 'Thorin',
        journal: null,
      }),
    ).toBe('Only you and your Gamemaster see these.')
    expect(
      whoSeesNotes({
        kind: 'personal',
        role: 'player',
        name: 'Thorin',
        journal: "Thorin's notes",
      }),
    ).toBe(
      "Only you and your Gamemaster see these. In Foundry they’re in “Thorin's notes”.",
    )
    expect(
      whoSeesNotes({
        kind: 'personal',
        role: 'gm',
        name: 'Thorin',
        journal: "Thorin's notes",
      }),
    ).toBe('Only Thorin’s player and you see these.')
    expect(
      whoSeesNotes({
        kind: 'party',
        role: 'player',
        name: 'The Iron Company',
        journal: null,
      }),
    ).toBe('Everyone in The Iron Company sees these, here and in Foundry.')
  })

  it('shows one banner, the first that applies', () => {
    const words = { role: 'player' as const, name: 'Thorin' }
    expect(notesBanner(mockNotesView(), words)).toBeUndefined()
    expect(
      notesBanner(
        mockNotesView({
          connected: false,
          enabled: false,
          withheld: { reason: 'private' },
        }),
        words,
      ),
    ).toBe(
      'Thorin is no longer one of the campaign’s characters, so these notes can’t be changed.',
    )
    expect(
      notesBanner(
        mockNotesView({ enabled: false, withheld: { reason: 'tooLarge' } }),
        words,
      ),
    ).toBe(
      'Notes are kept here for now. They reach Foundry once your Gamemaster’s game connects with Sending Stone 0.34.0 or later.',
    )
    expect(
      notesBanner(mockNotesView({ enabled: false }), {
        role: 'gm',
        name: 'Thorin',
      }),
    ).toBe(
      'Notes are kept here for now. They reach Foundry once your game connects with Sending Stone 0.34.0 or later.',
    )
    expect(
      notesBanner(mockNotesView({ withheld: { reason: 'tooLarge' } }), words),
    ).toBe(
      "“Thorin's notes (Erebor)” is too large to send from Foundry, so changes made there don’t show here.",
    )
    expect(
      notesBanner(
        mockNotesView({ journal: null, withheld: { reason: 'tooLarge' } }),
        words,
      ),
    ).toBe(
      'The journal is too large to send from Foundry, so changes made there don’t show here.',
    )
    expect(
      notesBanner(
        mockNotesView({ kind: 'party', withheld: { reason: 'private' } }),
        { role: 'gm', name: 'The Iron Company' },
      ),
    ).toBe(
      'No player can see The Iron Company in Foundry, so its notes aren’t shared.',
    )
  })

  it('says a note is saved, and when it reaches Foundry while the game is closed', () => {
    expect(savedWords(true, 'player')).toBe('Saved.')
    expect(savedWords(false, 'player')).toBe(
      'Saved. It goes to Foundry when your Gamemaster’s game is next open.',
    )
    expect(savedWords(false, 'gm')).toBe(
      'Saved. It goes to Foundry when your game is next open.',
    )
  })
})
