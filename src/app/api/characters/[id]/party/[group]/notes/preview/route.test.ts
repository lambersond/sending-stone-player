/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'
import { POST } from './route'
import { getCharacter } from '@/db/characters'
import { previewNote } from '@/db/notes'
import { partyNotesAccess } from '@/db/party'
import { getCurrentUser } from '@/lib/session'
import { guardNoDb } from '@/utils/test-utils-node'

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
const ACCESS = {
  campaignId: 'c1',
  groupId: 'company',
  private: false,
  writer: 'thorin',
}
const BOOK = {
  campaignId: 'c1',
  kind: 'party',
  actorId: 'company',
  private: false,
}

const URL =
  'https://player.example/api/characters/char-1/party/company/notes/preview'
const context = { params: Promise.resolve({ id: 'char-1', group: 'company' }) }
const post = (body: unknown) =>
  POST(
    new NextRequest(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  )

describe('app/api/characters/[id]/party/[group]/notes/preview', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(THORIN)
    jest.mocked(partyNotesAccess).mockResolvedValue(ACCESS)
    jest
      .mocked(previewNote)
      .mockResolvedValue({ html: '<h5>Loot</h5>', headings: [] })
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
    // A preview is drawn for the book alone, so the seat shows only in who the party was asked as.
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
  })
})
