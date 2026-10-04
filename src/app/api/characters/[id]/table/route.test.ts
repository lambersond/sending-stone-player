/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getGameVersion, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/table', () => ({
  getGameVersion: jest.fn(),
  getTableView: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
}
const view = { version: 7, connected: true, messages: [] }

const get = (query = '') =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/char-1/table${query}`,
    ),
    {
      params: Promise.resolve({ id: 'char-1' }),
    },
  )

describe('app/api/characters/[id]/table', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    jest.mocked(getGameVersion).mockResolvedValue(7)
    jest.mocked(getTableView).mockResolvedValue(view)
  })

  it("returns the character's view, never cached", async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual(view)
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getTableView).toHaveBeenCalledWith(character)
  })

  it('has nothing new for a viewer already up to date', async () => {
    const response = await get('?version=7')

    expect(response.status).toBe(204)
    expect(getGameVersion).toHaveBeenCalledWith(character.gameUrl)
    expect(getTableView).not.toHaveBeenCalled()
  })

  it('sends the view to a viewer behind', async () => {
    const response = await get('?version=6')

    expect(response.status).toBe(200)
  })

  it('refuses someone not signed in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    const response = await get()

    expect(response.status).toBe(401)
    expect(getCharacter).not.toHaveBeenCalled()
  })

  it("is not found for a character that isn't the user's", async () => {
    // eslint-disable-next-line unicorn/no-null -- what Prisma returns
    jest.mocked(getCharacter).mockResolvedValue(null)

    const response = await get()

    expect(response.status).toBe(404)
  })
})
