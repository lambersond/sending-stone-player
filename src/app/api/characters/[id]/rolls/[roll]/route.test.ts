/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getRollRequestView } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({ getRollRequestView: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const get = () =>
  GET(
    new NextRequest('https://player.example/api/characters/char-1/rolls/req-1'),
    { params: Promise.resolve({ id: 'char-1', roll: 'req-1' }) },
  )

describe('app/api/characters/[id]/rolls/[roll]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
  })

  it("tells where a roll of the player's character stands, never cached", async () => {
    const view = { id: 'req-1', status: 'done' as const, visible: false }
    jest.mocked(getRollRequestView).mockResolvedValue(view)

    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual(view)
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getRollRequestView).toHaveBeenCalledWith('char-1', 'req-1')
  })

  it("is not found for a roll that isn't the character's, or a character not the user's", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getRollRequestView).mockResolvedValue(undefined)
    await expect(get()).resolves.toHaveProperty('status', 404)

    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCharacter).mockResolvedValue(undefined)
    jest.mocked(getRollRequestView).mockClear()
    await expect(get()).resolves.toHaveProperty('status', 404)
    expect(getRollRequestView).not.toHaveBeenCalled()
  })

  it('refuses someone not signed in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    await expect(get()).resolves.toHaveProperty('status', 401)
    expect(getCharacter).not.toHaveBeenCalled()
  })
})
