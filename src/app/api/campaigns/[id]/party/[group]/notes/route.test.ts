/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the seats and Prisma use null for none */
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { createNote, getNotesStatus, getNotesView } from '@/db/notes'
import { partyNotesAccess } from '@/db/party'
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

const ACCESS = {
  campaignId: 'c1',
  groupId: 'company',
  private: false,
  writer: null,
}
const GM = { role: 'gm', userId: 'gm-1', actorId: null, name: 'Gamemaster' }
const BOOK = {
  campaignId: 'c1',
  kind: 'party',
  actorId: 'company',
  private: false,
}

const URL = 'https://player.example/api/campaigns/c1/party/company/notes'
const context = { params: Promise.resolve({ id: 'c1', group: 'company' }) }
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

describe('app/api/campaigns/[id]/party/[group]/notes', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(partyNotesAccess).mockResolvedValue(ACCESS)
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
    expect(getNotesView).toHaveBeenCalledWith(GM, BOOK)
    await expect(get('?version=3&live=1')).resolves.toHaveProperty(
      'status',
      204,
    )
  })

  it('answers 404 for another Gamemaster’s campaign, saying no more, and never 204', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(partyNotesAccess).mockResolvedValue(undefined)

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
    expect(createNote).toHaveBeenCalledWith(GM, BOOK, {
      role: 'chapter',
      title: 'Session 1',
    })
  })
})
