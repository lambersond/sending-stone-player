/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST } from './route'
import { getCharacter } from '@/db/characters'
import { createRollRequest } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({ createRollRequest: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const perception = {
  kind: 'skill',
  key: 'prc',
  mode: 1,
  explicit: true,
  extras: [{ sign: 1, count: 1, sides: 4 }],
  dice: [
    { faces: 20, results: [17, 3] },
    { faces: 4, results: [2] },
  ],
}

const post = (body: unknown = perception, contentType = 'application/json') =>
  POST(
    new NextRequest('https://player.example/api/characters/char-1/rolls', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: 'char-1' }) },
  )

describe('app/api/characters/[id]/rolls', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    jest.mocked(createRollRequest).mockResolvedValue({ id: 'req-1' })
  })

  it("takes a roll for the player's character, to ask after by its id", async () => {
    const response = await post()

    expect(response.status).toBe(202)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ id: 'req-1' })
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(createRollRequest).toHaveBeenCalledWith(character, perception)
  })

  it.each([
    [409, 'unavailable'],
    [422, 'not-dying'],
    [429, 'busy'],
  ] as const)(
    'answers %i when the roll is refused, saying why',
    async (status, reason) => {
      jest.mocked(createRollRequest).mockResolvedValue({ status, reason })

      const response = await post()

      expect(response.status).toBe(status)
      await expect(response.json()).resolves.toEqual({ reason })
    },
  )

  it.each([
    ['not JSON', 'nope'],
    ['a roll with dice it does not throw', { ...perception, mode: 0 }],
    ['a formula', { ...perception, formula: '1d20 + 99' }],
  ])('refuses %s', async (_, body) => {
    const response = await post(body)

    expect(response.status).toBe(400)
    expect(createRollRequest).not.toHaveBeenCalled()
  })

  it('takes only JSON, which another site cannot send unasked', async () => {
    const response = await post(perception, 'text/plain')

    expect(response.status).toBe(415)
    expect(createRollRequest).not.toHaveBeenCalled()
  })

  it('refuses an oversized roll', async () => {
    const response = await post('x'.repeat(20_000))

    expect(response.status).toBe(413)
  })

  it('refuses someone not signed in, or a character not theirs', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCharacter).mockResolvedValue(undefined)
    await expect(post()).resolves.toHaveProperty('status', 404)

    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)
    await expect(post()).resolves.toHaveProperty('status', 401)
    expect(createRollRequest).not.toHaveBeenCalled()
  })
})
