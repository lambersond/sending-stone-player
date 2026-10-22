/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { getCharacter } from '@/db/characters'
import { createNote, getNotesStatus, getNotesView } from '@/db/notes'
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

const THORIN = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}
const PLAYER = {
  role: 'player',
  userId: 'user-1',
  actorId: 'thorin',
  name: 'Thorin',
}
const BOOK = {
  campaignId: 'c1',
  kind: 'personal',
  actorId: 'thorin',
  private: false,
}

const URL = 'https://player.example/api/characters/char-1/notes'
const context = { params: Promise.resolve({ id: 'char-1' }) }
const get = (query = '') => GET(new NextRequest(`${URL}${query}`), context)
const post = (body: unknown) =>
  POST(
    new NextRequest(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  )

describe('app/api/characters/[id]/notes', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(THORIN)
    jest.mocked(getNotesStatus).mockResolvedValue({ version: 3, live: true })
    jest.mocked(getNotesView).mockResolvedValue(mockNotesView())
  })

  it('answers 401 signed out', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

    await expect(get()).resolves.toHaveProperty('status', 401)
    await expect(post({ role: 'entry', title: 'a' })).resolves.toHaveProperty(
      'status',
      401,
    )
  })

  it('gives the book to its seat, never cached, and 204 while nothing changed', async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual(mockNotesView())
    expect(getNotesView).toHaveBeenCalledWith(PLAYER, BOOK)
    await expect(get('?version=3&live=1')).resolves.toHaveProperty(
      'status',
      204,
    )
  })

  it('answers 404 for another player’s character, saying no more, and never 204', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)

    for (const response of [await get(), await get('?version=3&live=1')]) {
      expect(response.status).toBe(404)
      expect(await response.text()).toBe('')
    }
    await expect(post({ role: 'entry', title: 'a' })).resolves.toHaveProperty(
      'status',
      404,
    )
    expect(getNotesView).not.toHaveBeenCalled()
    expect(createNote).not.toHaveBeenCalled()
  })

  it('adds a note to the seat’s book, 201 with its id', async () => {
    jest
      .mocked(createNote)
      .mockResolvedValue({ ok: true, id: 'goblinCaveNote01', stamp: 'w:a.0' })

    const response = await post({ role: 'chapter', title: 'Session 1' })

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toEqual({
      id: 'goblinCaveNote01',
      stamp: 'w:a.0',
    })
    expect(createNote).toHaveBeenCalledWith(PLAYER, BOOK, {
      role: 'chapter',
      title: 'Session 1',
    })
  })
})
