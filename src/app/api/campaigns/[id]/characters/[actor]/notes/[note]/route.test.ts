/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the seats and Prisma use null for none */
import { NextRequest } from 'next/server'
import { DELETE, PATCH } from './route'
import { changeNote, deleteNote } from '@/db/notes'
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
const GM = { role: 'gm', userId: 'gm-1', actorId: null, name: 'Gamemaster' }
const BOOK = {
  campaignId: 'c1',
  kind: 'personal',
  actorId: 'thorin',
  private: false,
}

const NOTE = 'goblinCaveNote01'
const URL =
  'https://player.example/api/campaigns/c1/characters/thorin/notes/' + NOTE
const context = {
  params: Promise.resolve({ id: 'c1', actor: 'thorin', note: NOTE }),
}
const patch = (body: unknown) =>
  PATCH(
    new NextRequest(URL, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    context,
  )
const remove = (stamp = 'n%3Aabc') =>
  DELETE(
    new NextRequest(`${URL}?stamp=${stamp}`, { method: 'DELETE' }),
    context,
  )

describe('app/api/campaigns/[id]/characters/[actor]/notes/[note]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    jest.mocked(getGmSeat).mockResolvedValue(GM_SEAT)
    jest.mocked(changeNote).mockResolvedValue({ ok: true, stamp: 'w:a.3' })
    jest.mocked(deleteNote).mockResolvedValue({ ok: true, stamp: 'w:a.0' })
  })

  it('answers 401 signed out', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

    await expect(patch({ title: 'a', stamp: 'n:' })).resolves.toHaveProperty(
      'status',
      401,
    )
    await expect(remove()).resolves.toHaveProperty('status', 401)
  })

  it('changes the note in the seat’s book, from the stamp its page saw', async () => {
    const response = await patch({ title: 'Wolves', stamp: 'n:abc' })

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ stamp: 'w:a.3' })
    expect(changeNote).toHaveBeenCalledWith(GM, BOOK, NOTE, {
      title: 'Wolves',
      stamp: 'n:abc',
    })
  })

  it('deletes the note in the seat’s book, from the stamp its page saw', async () => {
    const response = await remove()

    expect(response.status).toBe(200)
    expect(deleteNote).toHaveBeenCalledWith(GM, BOOK, NOTE, 'n:abc')
  })

  it('answers 404 for another Gamemaster’s campaign, changing nothing', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getGmSeat).mockResolvedValue(undefined)

    await expect(patch({ title: 'a', stamp: 'n:' })).resolves.toHaveProperty(
      'status',
      404,
    )
    await expect(remove()).resolves.toHaveProperty('status', 404)
    expect(changeNote).not.toHaveBeenCalled()
    expect(deleteNote).not.toHaveBeenCalled()
  })
})
