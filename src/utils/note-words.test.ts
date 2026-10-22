/* eslint-disable unicorn/no-null -- a book with no journal in Foundry has null for it */
import {
  choicesWords,
  journalCounts,
  journalTitle,
  noteChoiceRefusalWords,
  noteReasonWords,
  noteRefusalWords,
  notesBanner,
  noteStateWords,
  savedWords,
  whoSeesNotes,
  whoSeesShort,
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

  it.each<[NoteRefusal | 'network', string]>([
    ['changed', 'It changed meanwhile: here’s how it stands now.'],
    [
      'saving',
      'Its last change is still on its way to the game. Try again in a moment.',
    ],
    ['network', 'Sending Stone couldn’t be reached. Try again in a moment.'],
    ['conflict', 'It was changed in Foundry too. Choose which to keep first.'],
    ['not-yours', 'Only its author can change it.'],
    ['unknown', 'Thorin is no longer one of the campaign’s characters.'],
    ['busy', 'Too many changes at once. Wait a moment.'],
  ])(
    'says why a delete or a choice was refused, %s, in words for no text being edited',
    (refusal, words) => {
      expect(noteChoiceRefusalWords(refusal, 'Thorin')).toBe(words)
    },
  )

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

  describe('an order kept for a module that takes notes but not orders (module 0.35.0)', () => {
    const waiting = {
      orders: false,
      groups: [{ chapterId: null, state: 'waiting' as const, stamp: 'g:1' }],
    }

    it('says so, after the banners for a character gone and a module too old to take notes, before the rest', () => {
      const words = { role: 'player' as const, name: 'Thorin' }
      const kept =
        'The new order is kept here for now. It reaches Foundry once your Gamemaster’s game connects with Sending Stone 0.35.0 or later.'
      expect(
        notesBanner(
          mockNotesView({ ...waiting, withheld: { reason: 'tooLarge' } }),
          words,
        ),
      ).toBe(kept)
      expect(
        notesBanner(
          mockNotesView({ ...waiting, withheld: { reason: 'private' } }),
          words,
        ),
      ).toBe(kept)
      expect(
        notesBanner(mockNotesView({ ...waiting, enabled: false }), words),
      ).toMatch(/^Notes are kept here for now/)
      expect(
        notesBanner(mockNotesView({ ...waiting, connected: false }), words),
      ).toMatch(/is no longer one of the campaign’s characters/)
      expect(
        notesBanner(mockNotesView(waiting), { role: 'gm', name: 'Thorin' }),
      ).toBe(
        'The new order is kept here for now. It reaches Foundry once your game connects with Sending Stone 0.35.0 or later.',
      )
    })

    it('says nothing of orders for a module that takes them, or with none waiting', () => {
      const words = { role: 'player' as const, name: 'Thorin' }
      expect(
        notesBanner(mockNotesView({ ...waiting, orders: true }), words),
      ).toBeUndefined()
      expect(
        notesBanner(
          mockNotesView({
            orders: false,
            groups: [{ chapterId: null, state: 'saving', stamp: 'g:1' }],
          }),
          words,
        ),
      ).toBeUndefined()
    })
  })

  it.each([
    ['personal', 'player', 'My Journal', 'You and your Gamemaster'],
    ['personal', 'gm', 'Thorin’s Journal', 'Thorin’s player and you'],
    ['party', 'player', 'Thorin’s Journal', 'Everyone in Thorin'],
    ['party', 'gm', 'Thorin’s Journal', 'Everyone in Thorin'],
  ] as const)(
    'names a %s journal for a %s, and who sees it in short',
    (kind, role, title, who) => {
      expect(journalTitle({ kind, role, name: 'Thorin' })).toBe(title)
      expect(whoSeesShort({ kind, role, name: 'Thorin' })).toBe(who)
    },
  )

  it.each([
    [0, 0, 'No notes yet'],
    [0, 3, '0 chapters · 3 notes'],
    [1, 1, '1 chapter · 1 note'],
    [2, 0, '2 chapters · 0 notes'],
  ])('counts %i chapters and %i notes', (chapters, notes, words) => {
    expect(journalCounts(chapters, notes)).toBe(words)
  })

  it('counts what waits on a choice', () => {
    expect(choicesWords(1)).toBe('1 needs a choice')
    expect(choicesWords(3)).toBe('3 need a choice')
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
