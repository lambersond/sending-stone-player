/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the seats and Prisma use null for none */
import { NextRequest } from 'next/server'
import {
  noteDeleteResponse,
  notePatchResponse,
  notePreviewResponse,
  notesPostResponse,
  notesResponse,
  notesSeat,
  type NotesPlace,
} from './notes-routes'
import { getCharacter } from '@/db/characters'
import {
  changeNote,
  createNote,
  deleteNote,
  getNotesStatus,
  getNotesView,
  previewNote,
  resolveNote,
} from '@/db/notes'
import { partyNotesAccess } from '@/db/party'
import { notePlayersSeen } from '@/db/roll-requests'
import { getGmSeat } from '@/db/seats'
import { getCurrentUser } from '@/lib/session'
import { mockNotesView } from '@/mocks/sending-stone'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/seats', () => ({
  ...jest.requireActual('@/db/seats'),
  getGmSeat: jest.fn(),
}))
jest.mock('@/db/party', () => ({
  ...jest.requireActual('@/db/party'),
  partyNotesAccess: jest.fn(),
}))
jest.mock('@/db/roll-requests', () => ({ notePlayersSeen: jest.fn() }))
jest.mock('@/db/notes', () => ({
  changeNote: jest.fn(),
  createNote: jest.fn(),
  deleteNote: jest.fn(),
  getNotesStatus: jest.fn(),
  getNotesView: jest.fn(),
  previewNote: jest.fn(),
  resolveNote: jest.fn(),
}))

const URL = 'https://player.example/api/characters/char-1/notes'
const NOTE = 'goblinCaveNote01'

/** Thorin, his player's character in the campaign. */
const thorin = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}

/** Thorin's player at his own book. */
const place: NotesPlace = {
  seat: { role: 'player', userId: 'user-1', actorId: 'thorin', name: 'Thorin' },
  book: {
    campaignId: 'c1',
    kind: 'personal',
    actorId: 'thorin',
    private: false,
  },
}
const gmPlace: NotesPlace = {
  seat: { role: 'gm', userId: 'gm-1', actorId: null, name: 'Gamemaster' },
  book: place.book,
}

/** A request with a JSON body, or what's given. */
const request = (
  body?: unknown,
  { query = '', type = 'application/json', method = 'POST' } = {},
) =>
  new NextRequest(`${URL}${query}`, {
    method,
    headers: { 'Content-Type': type },
    ...(body !== undefined && {
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  })

/** An answer's status, its body as JSON where it has one, and whether it's never cached. */
const read = async (response: Response) => {
  const text = response.status === 204 ? '' : await response.text()
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
    cached: response.headers.get('Cache-Control') !== 'no-store',
  }
}

describe('lib/notes-routes', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(thorin)
    jest.mocked(getNotesStatus).mockResolvedValue({ version: 3, live: true })
    jest.mocked(getNotesView).mockResolvedValue(mockNotesView())
  })

  describe('notesSeat', () => {
    it('answers 401 signed out', async () => {
      jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

      const answer = await notesSeat({
        kind: 'personal',
        role: 'player',
        character: 'char-1',
      })

      expect(answer).toBeInstanceOf(Response)
      expect((answer as Response).status).toBe(401)
    })

    it('puts a player at their own character’s book, as that character, from the address alone', async () => {
      await expect(
        notesSeat({ kind: 'personal', role: 'player', character: 'char-1' }),
      ).resolves.toEqual(place)
      expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    })

    it.each([
      ['another player’s character', undefined],
      ['a character in no campaign', { ...thorin, campaignId: null }],
      ['a character not chosen yet', { ...thorin, actorId: null }],
    ])('answers 404 for %s, saying no more', async (_name, character) => {
      jest.mocked(getCharacter).mockResolvedValue(character)

      const answer = (await notesSeat({
        kind: 'personal',
        role: 'player',
        character: 'char-1',
      })) as Response

      expect(answer.status).toBe(404)
      expect(await answer.text()).toBe('')
    })

    it('puts the campaign’s Gamemaster at a character’s book as the Gamemaster, 404 for another’s campaign', async () => {
      jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
      jest.mocked(getGmSeat).mockResolvedValue({
        name: 'Thorin',
        gameUrl: thorin.gameUrl,
        campaignTitle: thorin.campaignTitle,
        campaignId: 'c1',
        actorId: 'thorin',
        role: 'gm',
        userId: 'gm-1',
        characterId: null,
      })

      await expect(
        notesSeat({
          kind: 'personal',
          role: 'gm',
          campaign: 'c1',
          actor: 'thorin',
        }),
      ).resolves.toEqual(gmPlace)
      expect(getGmSeat).toHaveBeenCalledWith('gm-1', 'c1', 'thorin')

      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(getGmSeat).mockResolvedValue(undefined)
      const refused = (await notesSeat({
        kind: 'personal',
        role: 'gm',
        campaign: 'c2',
        actor: 'thorin',
      })) as Response
      expect(refused.status).toBe(404)
    })

    it('puts a player who may see the party at its book, checked now, and 404 where they may not', async () => {
      jest.mocked(partyNotesAccess).mockResolvedValue({
        campaignId: 'c1',
        groupId: 'company',
        private: false,
        writer: 'thorin',
      })

      await expect(
        notesSeat({
          kind: 'party',
          role: 'player',
          character: 'char-1',
          group: 'company',
        }),
      ).resolves.toEqual({
        seat: place.seat,
        book: {
          campaignId: 'c1',
          kind: 'party',
          actorId: 'company',
          private: false,
        },
      })
      expect(partyNotesAccess).toHaveBeenCalledWith(
        {
          role: 'player',
          campaignId: 'c1',
          actorId: 'thorin',
          characterId: 'char-1',
          name: 'Thorin',
        },
        'company',
      )

      // The book is as private as the party is said to be now, whoever is at it.
      jest.mocked(partyNotesAccess).mockResolvedValue({
        campaignId: 'c1',
        groupId: 'company',
        private: true,
        writer: 'thorin',
      })
      await expect(
        notesSeat({
          kind: 'party',
          role: 'player',
          character: 'char-1',
          group: 'company',
        }),
      ).resolves.toMatchObject({ book: { private: true } })

      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(partyNotesAccess).mockResolvedValue(undefined)
      const refused = (await notesSeat({
        kind: 'party',
        role: 'player',
        character: 'char-1',
        group: 'company',
      })) as Response
      expect(refused.status).toBe(404)
    })

    it('puts the Gamemaster at a party’s book, a private one too, and 404 for another’s', async () => {
      jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
      jest.mocked(partyNotesAccess).mockResolvedValue({
        campaignId: 'c1',
        groupId: 'hidden',
        private: true,
        writer: null,
      })

      await expect(
        notesSeat({
          kind: 'party',
          role: 'gm',
          campaign: 'c1',
          group: 'hidden',
        }),
      ).resolves.toEqual({
        seat: gmPlace.seat,
        book: {
          campaignId: 'c1',
          kind: 'party',
          actorId: 'hidden',
          private: true,
        },
      })
      expect(partyNotesAccess).toHaveBeenCalledWith(
        { role: 'gm', campaignId: 'c1', userId: 'gm-1' },
        'hidden',
      )

      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(partyNotesAccess).mockResolvedValue(undefined)
      const refused = (await notesSeat({
        kind: 'party',
        role: 'gm',
        campaign: 'c2',
        group: 'hidden',
      })) as Response
      expect(refused.status).toBe(404)
    })
  })

  describe('notesResponse', () => {
    it('gives the book as the seat sees it, never cached, noting its player present', async () => {
      const answer = await read(await notesResponse(request(), place))

      expect(answer).toEqual({
        status: 200,
        body: mockNotesView(),
        cached: false,
      })
      expect(getNotesView).toHaveBeenCalledWith(place.seat, place.book)
      expect(notePlayersSeen).toHaveBeenCalledWith('c1')
    })

    it('notes no one present at the Gamemaster’s', async () => {
      await notesResponse(request(), gmPlace)

      expect(notePlayersSeen).not.toHaveBeenCalled()
    })

    it('answers 204 while neither the version nor the liveness changed', async () => {
      const unchanged = await notesResponse(
        request(undefined, { query: '?version=3&live=1', method: 'GET' }),
        place,
      )
      expect(unchanged.status).toBe(204)
      expect(unchanged.headers.get('Cache-Control')).toBe('no-store')
      expect(getNotesView).not.toHaveBeenCalled()

      for (const query of ['?version=2&live=1', '?version=3&live=0']) {
        const changed = await notesResponse(
          request(undefined, { query, method: 'GET' }),
          place,
        )
        expect(changed.status).toBe(200)
      }
    })

    it('answers 404 where the campaign is gone', async () => {
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(getNotesStatus).mockResolvedValue(undefined)
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(getNotesView).mockResolvedValue(undefined)

      await expect(
        notesResponse(
          request(undefined, { query: '?version=3&live=1', method: 'GET' }),
          place,
        ),
      ).resolves.toHaveProperty('status', 404)
      await expect(notesResponse(request(), place)).resolves.toHaveProperty(
        'status',
        404,
      )
    })
  })

  describe('notesPostResponse', () => {
    it('adds a note, 201 with its id made on the server and its stamp', async () => {
      jest
        .mocked(createNote)
        .mockResolvedValue({ ok: true, id: NOTE, stamp: 'w:a.0' })

      const answer = await read(
        await notesPostResponse(
          request({ role: 'entry', title: ' Wolves ', body: 'Three.' }),
          place,
        ),
      )

      expect(answer).toEqual({
        status: 201,
        body: { id: NOTE, stamp: 'w:a.0' },
        cached: false,
      })
      expect(createNote).toHaveBeenCalledWith(place.seat, place.book, {
        role: 'entry',
        title: 'Wolves',
        body: 'Three.',
        chapterId: null,
      })
    })

    it('never takes the note’s id, or whose it is, from the body: 400', async () => {
      for (const crafted of [
        { role: 'entry', title: 'a', id: 'craftedNoteId001' },
        { role: 'entry', title: 'a', noteId: 'craftedNoteId001' },
        { role: 'entry', title: 'a', actorId: 'vex' },
      ]) {
        const answer = await read(
          await notesPostResponse(request(crafted), place),
        )
        expect(answer).toEqual({
          status: 400,
          body: { reason: 'invalid' },
          cached: false,
        })
      }
      expect(createNote).not.toHaveBeenCalled()
    })

    it('answers 415 for anything but JSON, 413 for too much, 400 for what isn’t a note', async () => {
      expect(
        await read(
          await notesPostResponse(request('{}', { type: 'text/plain' }), place),
        ),
      ).toMatchObject({ status: 415, cached: false })
      expect(
        await read(
          await notesPostResponse(
            request({ role: 'entry', title: 'a', body: 'é'.repeat(33_000) }),
            place,
          ),
        ),
      ).toEqual({ status: 413, body: { reason: 'invalid' }, cached: false })
      expect(
        await read(await notesPostResponse(request('{not json'), place)),
      ).toEqual({ status: 400, body: { reason: 'invalid' }, cached: false })
      expect(
        await read(
          await notesPostResponse(request({ role: 'entry', title: '' }), place),
        ),
      ).toEqual({
        status: 400,
        body: { reason: 'invalid', field: 'title' },
        cached: false,
      })
      expect(createNote).not.toHaveBeenCalled()
    })

    it('says why the app’s own checks refused it, with the lines of headings', async () => {
      jest.mocked(createNote).mockResolvedValue({
        ok: false,
        status: 422,
        reason: 'headings',
        lines: [1],
      })

      expect(
        await read(
          await notesPostResponse(
            request({ role: 'entry', title: 'a', body: '#loot' }),
            place,
          ),
        ),
      ).toEqual({
        status: 422,
        body: { reason: 'headings', lines: [1] },
        cached: false,
      })
    })
  })

  describe('notePatchResponse', () => {
    it('changes a note from the stamp the page saw, 200 with its stamp now', async () => {
      jest.mocked(changeNote).mockResolvedValue({ ok: true, stamp: 'w:a.3' })

      const answer = await read(
        await notePatchResponse(
          request({ title: 'Wolves', stamp: 'n:abc' }, { method: 'PATCH' }),
          place,
          NOTE,
        ),
      )

      expect(answer).toEqual({
        status: 200,
        body: { stamp: 'w:a.3' },
        cached: false,
      })
      expect(changeNote).toHaveBeenCalledWith(place.seat, place.book, NOTE, {
        title: 'Wolves',
        stamp: 'n:abc',
      })
    })

    it('settles a change the game didn’t take, as the seat chose', async () => {
      jest.mocked(resolveNote).mockResolvedValue({ ok: true, stamp: 'n:abc' })

      await notePatchResponse(
        request({ resolve: 'theirs', stamp: 'w:a.2' }, { method: 'PATCH' }),
        place,
        NOTE,
      )

      expect(resolveNote).toHaveBeenCalledWith(place.seat, place.book, NOTE, {
        resolve: 'theirs',
        stamp: 'w:a.2',
      })
      expect(changeNote).not.toHaveBeenCalled()
    })

    it.each([
      [
        'a change with more in it',
        { title: 'a', stamp: 'n:', role: 'chapter' },
      ],
      ['a choice of neither', { resolve: 'both', stamp: 'n:' }],
      ['a change from no stamp', { title: 'a' }],
    ])('answers 400 for %s', async (_name, body) => {
      await expect(
        notePatchResponse(request(body, { method: 'PATCH' }), place, NOTE),
      ).resolves.toHaveProperty('status', 400)
    })

    it('answers 404 for a note id of another shape, and each refusal with its status', async () => {
      await expect(
        notePatchResponse(
          request({ title: 'a', stamp: 'n:' }, { method: 'PATCH' }),
          place,
          'preview',
        ),
      ).resolves.toHaveProperty('status', 404)

      jest.mocked(changeNote).mockResolvedValue({
        ok: false,
        status: 409,
        reason: 'saving',
      })
      expect(
        await read(
          await notePatchResponse(
            request({ title: 'a', stamp: 'n:' }, { method: 'PATCH' }),
            place,
            NOTE,
          ),
        ),
      ).toEqual({ status: 409, body: { reason: 'saving' }, cached: false })

      jest.mocked(changeNote).mockResolvedValue({
        ok: false,
        status: 400,
        reason: 'invalid',
        field: 'body',
      })
      expect(
        await read(
          await notePatchResponse(
            request({ title: 'a', body: '', stamp: 'n:' }, { method: 'PATCH' }),
            place,
            NOTE,
          ),
        ),
      ).toEqual({
        status: 400,
        body: { reason: 'invalid', field: 'body' },
        cached: false,
      })
    })
  })

  describe('noteDeleteResponse', () => {
    it('deletes an entry from the stamp the page saw', async () => {
      jest.mocked(deleteNote).mockResolvedValue({ ok: true, stamp: 'w:a.0' })

      const answer = await read(
        await noteDeleteResponse(
          request(undefined, { query: '?stamp=n%3Aabc', method: 'DELETE' }),
          place,
          NOTE,
        ),
      )

      expect(answer).toEqual({
        status: 200,
        body: { stamp: 'w:a.0' },
        cached: false,
      })
      expect(deleteNote).toHaveBeenCalledWith(
        place.seat,
        place.book,
        NOTE,
        'n:abc',
      )
    })

    it('answers 400 with no stamp, 404 for a note of another shape, and a chapter 409', async () => {
      expect(
        await read(
          await noteDeleteResponse(
            request(undefined, { method: 'DELETE' }),
            place,
            NOTE,
          ),
        ),
      ).toEqual({
        status: 400,
        body: { reason: 'invalid', field: 'stamp' },
        cached: false,
      })
      await expect(
        noteDeleteResponse(
          request(undefined, { query: '?stamp=n%3A', method: 'DELETE' }),
          place,
          'short',
        ),
      ).resolves.toHaveProperty('status', 404)

      jest.mocked(deleteNote).mockResolvedValue({
        ok: false,
        status: 409,
        reason: 'chapter',
      })
      expect(
        await read(
          await noteDeleteResponse(
            request(undefined, { query: '?stamp=n%3A', method: 'DELETE' }),
            place,
            NOTE,
          ),
        ),
      ).toEqual({ status: 409, body: { reason: 'chapter' }, cached: false })
    })
  })

  describe('notePreviewResponse', () => {
    it('renders a note for the book, storing nothing', async () => {
      jest
        .mocked(previewNote)
        .mockResolvedValue({ html: '<h5>Loot</h5>', headings: [] })

      expect(
        await read(
          await notePreviewResponse(request({ body: '### Loot' }), place),
        ),
      ).toEqual({
        status: 200,
        body: { html: '<h5>Loot</h5>', headings: [] },
        cached: false,
      })
      expect(previewNote).toHaveBeenCalledWith(place.book, '### Loot')
      expect(createNote).not.toHaveBeenCalled()
    })

    it('answers 400 for what isn’t a body, and 404 where the campaign is gone', async () => {
      await expect(
        notePreviewResponse(request({ text: 'a' }), place),
      ).resolves.toHaveProperty('status', 400)
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      jest.mocked(previewNote).mockResolvedValue(undefined)
      await expect(
        notePreviewResponse(request({ body: 'a' }), place),
      ).resolves.toHaveProperty('status', 404)
    })
  })
})
