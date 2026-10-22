/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the seats and the notes in no chapter use null for none */
import { NextRequest } from 'next/server'
import { PATCH, PUT } from './route'
import { getCharacter } from '@/db/characters'
import { reorderNotes, resolveOrder } from '@/db/notes'
import { getCurrentUser } from '@/lib/session'

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

const THORIN = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'thorin',
}
const SEAT = {
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

/** A new order of Session 1's notes, and a choice on the notes in no chapter's refused order. */
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

const URL = 'https://player.example/api/characters/char-1/notes/order'
const context = { params: Promise.resolve({ id: 'char-1' }) }
const send = (
  method: 'PUT' | 'PATCH',
  body: unknown,
  type = 'application/json',
) =>
  (method === 'PUT' ? PUT : PATCH)(
    new NextRequest(URL, {
      method,
      headers: { 'Content-Type': type },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    context,
  )

describe('app/api/characters/[id]/notes/order', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(THORIN)
    jest
      .mocked(reorderNotes)
      .mockResolvedValue({ ok: true, stamp: 'g:fedcba9876543210' })
    jest
      .mocked(resolveOrder)
      .mockResolvedValue({ ok: true, stamp: 'g:0011223344556677' })
  })

  it('answers 401 signed out', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

    await expect(send('PUT', ORDER)).resolves.toHaveProperty('status', 401)
    await expect(send('PATCH', CHOICE)).resolves.toHaveProperty('status', 401)
  })

  it('puts a group’s notes in a new order in the seat’s book, as its player, never cached', async () => {
    const response = await send('PUT', ORDER)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      stamp: 'g:fedcba9876543210',
    })
    expect(reorderNotes).toHaveBeenCalledWith(SEAT, BOOK, ORDER)
  })

  it('settles an order the game didn’t take, as the seat chose', async () => {
    const response = await send('PATCH', CHOICE)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      stamp: 'g:0011223344556677',
    })
    expect(resolveOrder).toHaveBeenCalledWith(SEAT, BOOK, CHOICE)
    expect(reorderNotes).not.toHaveBeenCalled()
  })

  it('answers 404 for another player’s character, saying no more', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)

    for (const [method, body] of [
      ['PUT', ORDER],
      ['PATCH', CHOICE],
    ] as const) {
      const response = await send(method, body)
      expect(response.status).toBe(404)
      await expect(response.text()).resolves.toBe('')
    }
    expect(reorderNotes).not.toHaveBeenCalled()
    expect(resolveOrder).not.toHaveBeenCalled()
  })

  it('answers 415 for anything but JSON, 413 for too much, 400 for what isn’t an order or a choice', async () => {
    await expect(send('PUT', ORDER, 'text/plain')).resolves.toHaveProperty(
      'status',
      415,
    )
    await expect(
      send('PUT', { ...ORDER, pad: 'a'.repeat(70_000) }),
    ).resolves.toHaveProperty('status', 413)
    const invalid = await send('PUT', { ...ORDER, ids: [] })
    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toEqual({
      reason: 'invalid',
      field: 'ids',
    })
    await expect(
      send('PATCH', { ...CHOICE, resolve: 'both' }),
    ).resolves.toHaveProperty('status', 400)
    expect(reorderNotes).not.toHaveBeenCalled()
    expect(resolveOrder).not.toHaveBeenCalled()
  })

  it.each([
    [404, 'gone'],
    [409, 'unknown'],
    [409, 'private'],
    [409, 'changed'],
    [409, 'saving'],
    [429, 'busy'],
  ] as const)('answers an order refused %s %s', async (status, reason) => {
    jest.mocked(reorderNotes).mockResolvedValue({ ok: false, status, reason })

    const response = await send('PUT', ORDER)
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ reason })
  })

  it.each([
    [404, 'gone'],
    [403, 'not-yours'],
    [409, 'changed'],
  ] as const)('answers a choice refused %s %s', async (status, reason) => {
    jest.mocked(resolveOrder).mockResolvedValue({ ok: false, status, reason })

    const response = await send('PATCH', CHOICE)
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ reason })
  })
})
