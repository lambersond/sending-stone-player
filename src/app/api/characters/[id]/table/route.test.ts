/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getCampaignStatus, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/table', () => ({
  getCampaignStatus: jest.fn(),
  getTableView: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}
const view = { version: 7, live: true, connected: true, messages: [] }

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
    jest.mocked(getCampaignStatus).mockResolvedValue({ version: 7, live: true })
    jest.mocked(getTableView).mockResolvedValue(view)
  })

  it("returns the character's view, never cached", async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual(view)
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getTableView).toHaveBeenCalledWith(character, {
      sheetVersion: undefined,
    })
  })

  it('passes on the version of the sheet the viewer has, to leave it out if unchanged', async () => {
    await get('?version=6&live=1&sheet=2026-10-05T12%3A00%3A00.000Z')

    expect(getTableView).toHaveBeenCalledWith(character, {
      sheetVersion: '2026-10-05T12:00:00.000Z',
    })
  })

  it('has nothing new for a viewer already up to date', async () => {
    const response = await get('?version=7&live=1')

    expect(response.status).toBe(204)
    expect(getCampaignStatus).toHaveBeenCalledWith(character)
    expect(getTableView).not.toHaveBeenCalled()
  })

  it.each([
    ['behind', '?version=6&live=1'],
    ['who thinks the game is offline', '?version=7&live=0'],
    ['who missed it going offline', '?version=7&live=1', false],
  ])('sends the view to a viewer %s', async (_, query, live = true) => {
    jest.mocked(getCampaignStatus).mockResolvedValue({ version: 7, live })
    const response = await get(query)

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
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCharacter).mockResolvedValue(undefined)

    const response = await get()

    expect(response.status).toBe(404)
  })
})
