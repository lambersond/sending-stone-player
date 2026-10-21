/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { notePlayersSeen, noteTableOpen } from '@/db/roll-requests'
import { playerSeat } from '@/db/seats'
import { getCampaignStatus, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'
import type { RollKind } from '@/types/roll'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  notePlayersSeen: jest.fn(),
  noteTableOpen: jest.fn(),
}))
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
/** Its player at its sheet. */
const seat = playerSeat(character, 'user-1')
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
    jest.mocked(getCampaignStatus).mockResolvedValue({
      version: 7,
      live: true,
      rollsToTable: [],
      rollFeatures: [],
      moves: false,
      typed: false,
      removes: false,
    })
    jest.mocked(getTableView).mockResolvedValue(view)
  })

  it("returns the character's view, never cached", async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual(view)
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(getTableView).toHaveBeenCalledWith(seat, {
      sheetVersion: undefined,
    })
  })

  it('passes on the version of the sheet the viewer has, to leave it out if unchanged', async () => {
    await get('?version=6&live=1&sheet=2026-10-05T12%3A00%3A00.000Z')

    expect(getTableView).toHaveBeenCalledWith(seat, {
      sheetVersion: '2026-10-05T12:00:00.000Z',
    })
  })

  it('has nothing new for a viewer already up to date', async () => {
    const response = await get('?version=7&live=1')

    expect(response.status).toBe(204)
    expect(getCampaignStatus).toHaveBeenCalledWith(seat)
    expect(getTableView).not.toHaveBeenCalled()

    jest.mocked(getCampaignStatus).mockResolvedValue({
      version: 7,
      live: true,
      rollsToTable: ['skill', 'save'],
      rollFeatures: [],
      moves: false,
      typed: false,
      removes: false,
    })
    const withRolls = await get('?version=7&live=1&rolls=skill,save')
    expect(withRolls.status).toBe(204)

    jest.mocked(getCampaignStatus).mockResolvedValue({
      version: 7,
      live: true,
      rollsToTable: ['skill', 'damage'],
      rollFeatures: ['modifiers'],
      moves: false,
      typed: false,
      removes: false,
    })
    const withFeatures = await get(
      `?version=7&live=1&rolls=${encodeURIComponent('skill,damage;modifiers')}`,
    )
    expect(withFeatures.status).toBe(204)
    // A viewer who missed the game taking changed damage is sent the view.
    const without = await get('?version=7&live=1&rolls=skill,damage')
    expect(without.status).toBe(200)
  })

  it("sends the view to a viewer who missed a roll of the Gamemaster's as their character moving on (#156)", async () => {
    const status = {
      version: 7,
      live: true,
      rollsToTable: [],
      rollFeatures: [],
      moves: false,
      typed: false,
      removes: false,
    }
    jest
      .mocked(getCampaignStatus)
      .mockResolvedValue({ ...status, gmRollsKey: 'key-now' })
    const answers = [
      await get('?version=7&live=1&gmrolls=key-now'),
      await get('?version=7&live=1&gmrolls=key-before'),
      // Or the Gamemaster's first.
      await get('?version=7&live=1'),
    ]
    // And one who has one, once there are none to show.
    jest.mocked(getCampaignStatus).mockResolvedValue(status)
    answers.push(await get('?version=7&live=1&gmrolls=key-now'))

    expect(answers.map(({ status }) => status)).toEqual([204, 200, 200, 200])
  })

  it.each<[string, string, boolean?, RollKind[]?]>([
    ['behind', '?version=6&live=1'],
    ['who thinks the game is offline', '?version=7&live=0'],
    ['who missed it going offline', '?version=7&live=1', false],
    [
      'who missed the game starting to take rolls',
      '?version=7&live=1',
      true,
      ['skill'],
    ],
    ['who missed it no longer taking them', '?version=7&live=1&rolls=skill'],
  ])(
    'sends the view to a viewer %s',
    async (_, query, live = true, rollsToTable = []) => {
      jest.mocked(getCampaignStatus).mockResolvedValue({
        version: 7,
        live,
        rollsToTable,
        rollFeatures: [],
        moves: false,
        typed: false,
        removes: false,
      })
      const response = await get(query)

      expect(response.status).toBe(200)
    },
  )

  it('sends the view to a viewer who missed the game taking moves of items and coins, or no longer taking them (module 0.31.0)', async () => {
    const status = {
      version: 7,
      live: true,
      rollsToTable: [],
      rollFeatures: [],
      typed: false,
      removes: false,
    }
    jest.mocked(getCampaignStatus).mockResolvedValue({ ...status, moves: true })
    const answers = [
      await get('?version=7&live=1&moves=1'),
      // Its module began fetching them, with no new version.
      await get('?version=7&live=1'),
    ]
    jest
      .mocked(getCampaignStatus)
      .mockResolvedValue({ ...status, moves: false })
    answers.push(
      await get('?version=7&live=1'),
      // Its module stopped fetching them.
      await get('?version=7&live=1&moves=1'),
    )

    expect(answers.map(({ status }) => status)).toEqual([204, 200, 204, 200])
  })

  it('sends the view to a viewer who missed the game removing items, or no longer removing them (module 0.33.0)', async () => {
    const status = {
      version: 7,
      live: true,
      rollsToTable: [],
      rollFeatures: [],
      moves: false,
      typed: false,
    }
    jest
      .mocked(getCampaignStatus)
      .mockResolvedValue({ ...status, removes: true })
    const answers = [
      await get('?version=7&live=1&removes=1'),
      // Its module began fetching, with no new version.
      await get('?version=7&live=1'),
    ]
    jest
      .mocked(getCampaignStatus)
      .mockResolvedValue({ ...status, removes: false })
    answers.push(
      await get('?version=7&live=1'),
      // Its module stopped fetching.
      await get('?version=7&live=1&removes=1'),
    )

    expect(answers.map(({ status }) => status)).toEqual([204, 200, 204, 200])
  })

  it("notes a player at the campaign's table, as one who may roll", async () => {
    await get('?version=7&live=1')
    expect(notePlayersSeen).toHaveBeenCalledWith('c1')

    jest
      .mocked(getCharacter)
      // eslint-disable-next-line unicorn/no-null -- the character's campaign is unset
      .mockResolvedValue({ ...character, campaignId: null })
    jest.mocked(notePlayersSeen).mockClear()
    await get()
    expect(notePlayersSeen).not.toHaveBeenCalled()
  })

  it('notes the character open in the app, whether or not anything is new, for the module to wait for its answers', async () => {
    await get()
    await get('?version=7&live=1')

    expect(noteTableOpen).toHaveBeenCalledTimes(2)
    expect(noteTableOpen).toHaveBeenCalledWith('char-1')
  })

  it('serves the view, and notes the player at the table, even when the character cannot be noted open', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    jest.mocked(noteTableOpen).mockRejectedValueOnce(new Error('db down'))

    const response = await get()

    expect(response.status).toBe(200)
    expect(notePlayersSeen).toHaveBeenCalledWith('c1')
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to note a character open at the table',
      expect.any(Error),
    )
    consoleError.mockRestore()
  })

  it('serves the view even when the player cannot be noted', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})
    jest.mocked(notePlayersSeen).mockRejectedValueOnce(new Error('db down'))

    const response = await get()

    expect(response.status).toBe(200)
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to note a player at the table',
      expect.any(Error),
    )
    consoleError.mockRestore()
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

describe('app/api/characters/[id]/table, typing in their own dice, from module 0.32.0', () => {
  const status = {
    version: 7,
    live: true,
    rollsToTable: [],
    rollFeatures: [],
    moves: false,
    removes: false,
  }

  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue({
      ...character,
      manualDice: true,
    })
    jest.mocked(getTableView).mockResolvedValue(view)
  })

  it("has nothing new only while the viewer has the player's choice as it's stored, so another device's change reaches it", async () => {
    jest.mocked(getCampaignStatus).mockResolvedValue({ ...status, typed: true })
    const answers = [
      await get('?version=7&live=1&typed=1'),
      // Turned on on another device, with no new version.
      await get('?version=7&live=1'),
    ]
    jest
      .mocked(getCampaignStatus)
      .mockResolvedValue({ ...status, typed: false })
    answers.push(
      await get('?version=7&live=1'),
      // Turned off on another device.
      await get('?version=7&live=1&typed=1'),
    )

    expect(answers.map(({ status }) => status)).toEqual([204, 200, 204, 200])
    expect(getCampaignStatus).toHaveBeenCalledWith({
      ...seat,
      manualDice: true,
    })
  })
})
