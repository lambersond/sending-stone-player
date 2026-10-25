/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the view uses null for an absent value */
import { createHash } from 'node:crypto'
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getCookbookView } from '@/db/cookbook'
import { getCurrentUser } from '@/lib/session'
import type { CookbookView } from '@/types/cookbook'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/cookbook', () => ({ getCookbookView: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const character = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const view: Omit<CookbookView, 'version'> = {
  enabled: true,
  live: false,
  link: {
    hint: 'U2d4',
    createdAt: '2026-10-24T18:00:00.000Z',
    lastUsedAt: '2026-10-25T09:12:00.000Z',
  },
  dishes: [
    {
      id: 'dish-row-1',
      recipe: 'Fireberry Glazed Skewers',
      outcome: 'boon',
      state: 'applied',
      reason: null,
      eatenBy: ['Thorin Oakenshield', 'Vex'],
      rolled: [{ type: 'maxHitPoints', value: 7, formula: '3+1d6' }],
      queuedAt: '2026-10-24T19:00:00.000Z',
      decidedAt: '2026-10-24T20:15:00.000Z',
    },
  ],
}

/** The view's version: the first 12 hex digits of the SHA-256 of the rest. */
const VERSION = createHash('sha256')
  .update(JSON.stringify(view))
  .digest('hex')
  .slice(0, 12)

const get = (query = '') =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/char-1/cookbook${query}`,
    ),
    { params: Promise.resolve({ id: 'char-1' }) },
  )

describe('app/api/characters/[id]/cookbook', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    jest.mocked(getCookbookView).mockResolvedValue(view)
  })

  it("answers the player's card with its version", async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      version: VERSION,
      ...view,
    })
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getCookbookView).toHaveBeenCalledWith({
      id: 'char-1',
      campaignId: 'c1',
      actorId: 'actor-thorin',
    })
  })

  it('answers 204 while the version is the one last seen', async () => {
    const same = await get(`?version=${VERSION}`)
    expect(same.status).toBe(204)
    expect(same.headers.get('Cache-Control')).toBe('no-store')

    const other = await get('?version=000000000000')
    expect(other.status).toBe(200)
  })

  it('makes a new version once anything changes', async () => {
    jest.mocked(getCookbookView).mockResolvedValue({ ...view, live: true })

    const response = await get(`?version=${VERSION}`)

    expect(response.status).toBe(200)
    const { version } = await response.json()
    expect(version).not.toBe(VERSION)
  })

  it('answers a bare 401 to someone signed out', async () => {
    jest.mocked(getCurrentUser).mockResolvedValue(undefined as any)

    const response = await get()

    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(getCharacter).not.toHaveBeenCalled()
  })

  it("answers a bare 404 for another user's character", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)

    const response = await get()

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.text()).toBe('')
    expect(getCookbookView).not.toHaveBeenCalled()
  })

  it.each([
    ['in no campaign', { campaignId: null }],
    ['playing no actor', { actorId: null }],
  ])('answers a bare 404 for a character %s', async (_name, fields) => {
    jest.mocked(getCharacter).mockResolvedValue({ ...character, ...fields })

    const response = await get()

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(getCookbookView).not.toHaveBeenCalled()
  })

  it('answers a bare 404 where the campaign is gone', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCookbookView).mockResolvedValue(undefined)

    const response = await get()

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
