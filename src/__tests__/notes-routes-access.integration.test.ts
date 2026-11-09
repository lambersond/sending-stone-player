/**
 * @jest-environment node
 */
import * as gmNote from '@/app/api/campaigns/[id]/characters/[actor]/notes/[note]/route'
import * as gmNotesOrder from '@/app/api/campaigns/[id]/characters/[actor]/notes/order/route'
import * as gmNotesPreview from '@/app/api/campaigns/[id]/characters/[actor]/notes/preview/route'
import * as gmNotes from '@/app/api/campaigns/[id]/characters/[actor]/notes/route'
import * as gmPartyNote from '@/app/api/campaigns/[id]/party/[group]/notes/[note]/route'
import * as gmPartyNotesOrder from '@/app/api/campaigns/[id]/party/[group]/notes/order/route'
import * as gmPartyNotesPreview from '@/app/api/campaigns/[id]/party/[group]/notes/preview/route'
import * as gmPartyNotes from '@/app/api/campaigns/[id]/party/[group]/notes/route'
import * as note from '@/app/api/characters/[id]/notes/[note]/route'
import * as notesOrder from '@/app/api/characters/[id]/notes/order/route'
import * as notesPreview from '@/app/api/characters/[id]/notes/preview/route'
import * as notes from '@/app/api/characters/[id]/notes/route'
import * as partyNote from '@/app/api/characters/[id]/party/[group]/notes/[note]/route'
import * as partyNotesOrder from '@/app/api/characters/[id]/party/[group]/notes/order/route'
import * as partyNotesPreview from '@/app/api/characters/[id]/party/[group]/notes/preview/route'
import * as partyNotes from '@/app/api/characters/[id]/party/[group]/notes/route'
import { getCharacter } from '@/db/characters'
import {
  changeNote,
  createNote,
  deleteNote,
  getNotesStatus,
  getNotesView,
  previewNote,
  reorderNotes,
  resolveNote,
  resolveOrder,
} from '@/db/notes'
import { partyNotesAccess } from '@/db/party'
import { notePlayersSeen } from '@/db/roll-requests'
import { getGmSeat } from '@/db/seats'
import { getCurrentUser } from '@/lib/session'
import { mockNotesView } from '@/mocks/sending-stone'
import { guardNoDb, routeCall } from '@/utils/test-utils-node'

// Who may reach a book of journal notes, at every route of each of its four seats (round 0.34.0
// §8.5): signed out, 401; at a book that isn't the signed-in user's, 404; saying no more either
// way, and reading or writing nothing of the book. Each route's own test checks only that it is
// wired up, and what is that route's alone.

guardNoDb()

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
  reorderNotes: jest.fn(),
  resolveNote: jest.fn(),
  resolveOrder: jest.fn(),
}))

const ORIGIN = 'https://player.example'
const NOTE = 'goblinCaveNote01'
const JSON_TYPE = { 'Content-Type': 'application/json' }

/** Thorin, his player's character in the campaign. */
const THORIN = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}

/** What each route takes, valid, so that only who asks can turn it down. */
const ENTRY = { role: 'entry', title: 'a' }
const CHANGE = { title: 'a', stamp: 'n:' }
const ORDER = {
  chapterId: 'sessionChapter01',
  ids: ['rumourInFoundry1', 'goblinCaveNote01'],
  stamp: 'g:0123456789abcdef',
}
const CHOICE = {
  chapterId: null,
  resolve: 'theirs',
  stamp: 'g:0123456789abcdef',
}
const PREVIEW = { body: 'a' }

/**
 * A request to one route, named by its method and its address as its file names it, and called as
 * Next.js calls its handler: at that address filled in with the params, with a JSON body if any.
 */
const request = <Params extends Record<string, string>>(
  method: string,
  route: string,
  handler: Parameters<typeof routeCall<Params>>[0],
  params: Params,
  { query = '', body }: { query?: string; body?: unknown } = {},
) => {
  const address = route.replaceAll(
    /\[(\w+)\]/g,
    (_, key: string) => params[key],
  )
  return {
    name: `${method} ${route}${query}`,
    call: () =>
      routeCall(handler, {
        method,
        url: `${ORIGIN}${address}${query}`,
        params,
        ...(body !== undefined && { headers: JSON_TYPE, body }),
      }),
  }
}

const PLAYER = { id: 'char-1' }
const GM = { id: 'c1', actor: 'thorin' }
const PLAYER_PARTY = { id: 'char-1', group: 'company' }
const GM_PARTY = { id: 'c1', group: 'company' }

/**
 * The four seats at a book, and every request to each of its four routes there: who is signed in,
 * and what makes the book not theirs, as the database's own checks answer it.
 */
const SEATS = [
  {
    user: 'user-1',
    notYours: 'another player’s character',
    refuse: () => jest.mocked(getCharacter).mockResolvedValue(undefined),
    requests: [
      request('GET', '/api/characters/[id]/notes', notes.GET, PLAYER),
      request('GET', '/api/characters/[id]/notes', notes.GET, PLAYER, {
        query: '?version=3&live=1',
      }),
      request('POST', '/api/characters/[id]/notes', notes.POST, PLAYER, {
        body: ENTRY,
      }),
      request(
        'PATCH',
        '/api/characters/[id]/notes/[note]',
        note.PATCH,
        { ...PLAYER, note: NOTE },
        { body: CHANGE },
      ),
      request(
        'DELETE',
        '/api/characters/[id]/notes/[note]',
        note.DELETE,
        { ...PLAYER, note: NOTE },
        { query: '?stamp=n%3Aabc' },
      ),
      request(
        'PUT',
        '/api/characters/[id]/notes/order',
        notesOrder.PUT,
        PLAYER,
        {
          body: ORDER,
        },
      ),
      request(
        'PATCH',
        '/api/characters/[id]/notes/order',
        notesOrder.PATCH,
        PLAYER,
        { body: CHOICE },
      ),
      request(
        'POST',
        '/api/characters/[id]/notes/preview',
        notesPreview.POST,
        PLAYER,
        { body: PREVIEW },
      ),
    ],
  },
  {
    user: 'gm-1',
    notYours: 'another Gamemaster’s campaign',
    refuse: () => jest.mocked(getGmSeat).mockResolvedValue(undefined),
    requests: [
      request(
        'GET',
        '/api/campaigns/[id]/characters/[actor]/notes',
        gmNotes.GET,
        GM,
      ),
      request(
        'GET',
        '/api/campaigns/[id]/characters/[actor]/notes',
        gmNotes.GET,
        GM,
        {
          query: '?version=3&live=1',
        },
      ),
      request(
        'POST',
        '/api/campaigns/[id]/characters/[actor]/notes',
        gmNotes.POST,
        GM,
        { body: ENTRY },
      ),
      request(
        'PATCH',
        '/api/campaigns/[id]/characters/[actor]/notes/[note]',
        gmNote.PATCH,
        { ...GM, note: NOTE },
        { body: CHANGE },
      ),
      request(
        'DELETE',
        '/api/campaigns/[id]/characters/[actor]/notes/[note]',
        gmNote.DELETE,
        { ...GM, note: NOTE },
        { query: '?stamp=n%3Aabc' },
      ),
      request(
        'PUT',
        '/api/campaigns/[id]/characters/[actor]/notes/order',
        gmNotesOrder.PUT,
        GM,
        { body: ORDER },
      ),
      request(
        'PATCH',
        '/api/campaigns/[id]/characters/[actor]/notes/order',
        gmNotesOrder.PATCH,
        GM,
        { body: CHOICE },
      ),
      request(
        'POST',
        '/api/campaigns/[id]/characters/[actor]/notes/preview',
        gmNotesPreview.POST,
        GM,
        { body: PREVIEW },
      ),
    ],
  },
  {
    user: 'user-1',
    notYours: 'a party the character may not see now',
    refuse: () => jest.mocked(partyNotesAccess).mockResolvedValue(undefined),
    requests: [
      request(
        'GET',
        '/api/characters/[id]/party/[group]/notes',
        partyNotes.GET,
        PLAYER_PARTY,
      ),
      request(
        'GET',
        '/api/characters/[id]/party/[group]/notes',
        partyNotes.GET,
        PLAYER_PARTY,
        { query: '?version=3&live=1' },
      ),
      request(
        'POST',
        '/api/characters/[id]/party/[group]/notes',
        partyNotes.POST,
        PLAYER_PARTY,
        { body: ENTRY },
      ),
      request(
        'PATCH',
        '/api/characters/[id]/party/[group]/notes/[note]',
        partyNote.PATCH,
        { ...PLAYER_PARTY, note: NOTE },
        { body: CHANGE },
      ),
      request(
        'DELETE',
        '/api/characters/[id]/party/[group]/notes/[note]',
        partyNote.DELETE,
        { ...PLAYER_PARTY, note: NOTE },
        { query: '?stamp=n%3Aabc' },
      ),
      request(
        'PUT',
        '/api/characters/[id]/party/[group]/notes/order',
        partyNotesOrder.PUT,
        PLAYER_PARTY,
        { body: ORDER },
      ),
      request(
        'PATCH',
        '/api/characters/[id]/party/[group]/notes/order',
        partyNotesOrder.PATCH,
        PLAYER_PARTY,
        { body: CHOICE },
      ),
      request(
        'POST',
        '/api/characters/[id]/party/[group]/notes/preview',
        partyNotesPreview.POST,
        PLAYER_PARTY,
        { body: PREVIEW },
      ),
    ],
  },
  {
    user: 'gm-1',
    notYours: 'another Gamemaster’s campaign',
    refuse: () => jest.mocked(partyNotesAccess).mockResolvedValue(undefined),
    requests: [
      request(
        'GET',
        '/api/campaigns/[id]/party/[group]/notes',
        gmPartyNotes.GET,
        GM_PARTY,
      ),
      request(
        'GET',
        '/api/campaigns/[id]/party/[group]/notes',
        gmPartyNotes.GET,
        GM_PARTY,
        { query: '?version=3&live=1' },
      ),
      request(
        'POST',
        '/api/campaigns/[id]/party/[group]/notes',
        gmPartyNotes.POST,
        GM_PARTY,
        { body: ENTRY },
      ),
      request(
        'PATCH',
        '/api/campaigns/[id]/party/[group]/notes/[note]',
        gmPartyNote.PATCH,
        { ...GM_PARTY, note: NOTE },
        { body: CHANGE },
      ),
      request(
        'DELETE',
        '/api/campaigns/[id]/party/[group]/notes/[note]',
        gmPartyNote.DELETE,
        { ...GM_PARTY, note: NOTE },
        { query: '?stamp=n%3Aabc' },
      ),
      request(
        'PUT',
        '/api/campaigns/[id]/party/[group]/notes/order',
        gmPartyNotesOrder.PUT,
        GM_PARTY,
        { body: ORDER },
      ),
      request(
        'PATCH',
        '/api/campaigns/[id]/party/[group]/notes/order',
        gmPartyNotesOrder.PATCH,
        GM_PARTY,
        { body: CHOICE },
      ),
      request(
        'POST',
        '/api/campaigns/[id]/party/[group]/notes/preview',
        gmPartyNotesPreview.POST,
        GM_PARTY,
        { body: PREVIEW },
      ),
    ],
  },
]

/** Each request, at its seat. */
const CASES = SEATS.flatMap(({ requests, ...seat }) =>
  requests.map(({ name, call }) => ({ ...seat, name, call })),
)

/** What of the book was read or written, or its player noted present, by function: nothing. */
const touched = () =>
  Object.entries({
    changeNote,
    createNote,
    deleteNote,
    getNotesStatus,
    getNotesView,
    previewNote,
    reorderNotes,
    resolveNote,
    resolveOrder,
    notePlayersSeen,
  })
    .filter(([, done]) => jest.mocked(done).mock.calls.length > 0)
    .map(([name]) => name)

describe('the routes of a book of notes, at each of its four seats', () => {
  // Every seat may reach its book, and every change is taken: only what each case says turns the
  // request down.
  beforeEach(() => {
    jest.mocked(getCharacter).mockResolvedValue(THORIN)
    jest.mocked(getGmSeat).mockResolvedValue({
      ...THORIN,
      role: 'gm',
      userId: 'gm-1',
      characterId: null,
    })
    jest.mocked(partyNotesAccess).mockResolvedValue({
      campaignId: 'c1',
      groupId: 'company',
      private: false,
      writer: null,
    })
    jest.mocked(getNotesStatus).mockResolvedValue({ version: 3, live: true })
    jest.mocked(getNotesView).mockResolvedValue(mockNotesView())
    jest
      .mocked(createNote)
      .mockResolvedValue({ ok: true, id: NOTE, stamp: 'w:a.0' })
    jest.mocked(changeNote).mockResolvedValue({ ok: true, stamp: 'w:a.3' })
    jest.mocked(deleteNote).mockResolvedValue({ ok: true, stamp: 'w:a.0' })
    jest.mocked(reorderNotes).mockResolvedValue({ ok: true, stamp: 'g:1' })
    jest.mocked(resolveOrder).mockResolvedValue({ ok: true, stamp: 'g:2' })
    jest
      .mocked(previewNote)
      .mockResolvedValue({ html: '<p>a</p>', headings: [] })
  })

  it.each(CASES)(
    '$name answers 401 signed out, saying no more',
    async ({ call }) => {
      jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

      expect(await call()).toMatchObject({ status: 401, body: '' })
      expect(touched()).toEqual([])
    },
  )

  it.each(CASES)(
    '$name answers 404 for $notYours, saying no more',
    async ({ user, refuse, call }) => {
      jest.mocked(getCurrentUser).mockResolvedValue({ id: user } as any)
      refuse()

      expect(await call()).toMatchObject({ status: 404, body: '' })
      expect(touched()).toEqual([])
    },
  )
})
