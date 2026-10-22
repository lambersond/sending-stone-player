/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the seats and Prisma use null for none */
import { NextRequest } from 'next/server'
import { POST } from './route'
import { previewNote } from '@/db/notes'
import { getGmSeat } from '@/db/seats'
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
const GM_SEAT = {
  ...THORIN,
  role: 'gm' as const,
  userId: 'gm-1',
  characterId: null,
}
const BOOK = {
  campaignId: 'c1',
  kind: 'personal',
  actorId: 'thorin',
  private: false,
}

const URL =
  'https://player.example/api/campaigns/c1/characters/thorin/notes/preview'
const context = { params: Promise.resolve({ id: 'c1', actor: 'thorin' }) }
const post = (body: unknown) =>
  POST(
    new NextRequest(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  )

describe('app/api/campaigns/[id]/characters/[actor]/notes/preview', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(getGmSeat).mockResolvedValue(GM_SEAT)
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

  it('answers 404 for another Gamemaster’s campaign', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getGmSeat).mockResolvedValue(undefined)

    await expect(post({ body: 'a' })).resolves.toHaveProperty('status', 404)
    expect(previewNote).not.toHaveBeenCalled()
  })
})
