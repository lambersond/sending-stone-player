/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from './route'
import { getCharacter } from '@/db/characters'
import { previewNote } from '@/db/notes'
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
const BOOK = {
  campaignId: 'c1',
  kind: 'personal',
  actorId: 'thorin',
  private: false,
}

const URL = 'https://player.example/api/characters/char-1/notes/preview'
const context = { params: Promise.resolve({ id: 'char-1' }) }
const post = (body: unknown) =>
  POST(
    new NextRequest(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  )

describe('app/api/characters/[id]/notes/preview', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(THORIN)
    jest
      .mocked(previewNote)
      .mockResolvedValue({ html: '<h5>Loot</h5>', headings: [] })
  })

  it('answers 401 signed out', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

    await expect(post({ body: 'a' })).resolves.toHaveProperty('status', 401)
  })

  it('renders a note for the seat’s book, storing nothing', async () => {
    const response = await post({ body: '### Loot' })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      html: '<h5>Loot</h5>',
      headings: [],
    })
    expect(previewNote).toHaveBeenCalledWith(BOOK, '### Loot')
  })

  it('answers 404 for another player’s character', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)

    await expect(post({ body: 'a' })).resolves.toHaveProperty('status', 404)
    expect(previewNote).not.toHaveBeenCalled()
  })
})
