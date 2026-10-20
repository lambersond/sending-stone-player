/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the Gamemaster's seat has no character, null */
import { NextRequest } from 'next/server'
import { GET as getRoll } from './rolls/[roll]/route'
import { POST as postRoll } from './rolls/route'
import { GET as getTable } from './table/route'
import { GET as getText } from './texts/[hash]/route'
import {
  createRollRequest,
  getRollRequestView,
  notePlayersSeen,
  noteTableOpen,
} from '@/db/roll-requests'
import { getGmSeat } from '@/db/seats'
import { getSheetText } from '@/db/sheet-texts'
import { getCampaignStatus, getTableView } from '@/db/table'
import { getCurrentUser } from '@/lib/session'

jest.mock('@/db/seats', () => ({ getGmSeat: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  createRollRequest: jest.fn(),
  getRollRequestView: jest.fn(),
  notePlayersSeen: jest.fn(),
  noteTableOpen: jest.fn(),
}))
jest.mock('@/db/sheet-texts', () => ({ getSheetText: jest.fn() }))
jest.mock('@/db/table', () => ({
  getCampaignStatus: jest.fn(),
  getTableView: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

/** The campaign's Gamemaster at Balin's sheet. */
const seat = {
  name: 'Balin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'Ashlands',
  campaignId: 'camp1',
  actorId: 'balin',
  role: 'gm' as const,
  userId: 'gm-1',
  characterId: null,
}
const HASH = '1a2b3c4d5e6f70'
const BASE = 'https://player.example/api/campaigns/camp1/characters/balin'
const params = <T extends object>(more: T = {} as T) => ({
  params: Promise.resolve({ id: 'camp1', actor: 'balin', ...more }),
})
const perception = {
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}
const view = {
  version: 7,
  live: true,
  connected: true,
  messages: [],
  gm: { rolls: 'made' as const },
}

/** Each of the four routes, asked as its page asks it. */
const routes = {
  table: (query = '') =>
    getTable(new NextRequest(`${BASE}/table${query}`), params()),
  rolls: (body: unknown = perception) =>
    postRoll(
      new NextRequest(`${BASE}/rolls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      params(),
    ),
  roll: () =>
    getRoll(
      new NextRequest(`${BASE}/rolls/req-gm`),
      params({ roll: 'req-gm' }),
    ),
  text: () =>
    getText(new NextRequest(`${BASE}/texts/${HASH}`), params({ hash: HASH })),
}

describe('app/api/campaigns/[id]/characters/[actor] (#156)', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    // As the real lookup: only this user's campaign, and only a character in its roster. Each
    // route's arguments are all strings, so only this shows them given in their order.
    jest
      .mocked(getGmSeat)
      .mockImplementation(async (userId, campaignId, actorId) =>
        userId === 'gm-1' && campaignId === 'camp1' && actorId === 'balin'
          ? seat
          : undefined,
      )
    jest.mocked(getTableView).mockResolvedValue(view)
    jest.mocked(getCampaignStatus).mockResolvedValue({
      version: 7,
      live: true,
      rollsToTable: ['skill'],
      rollFeatures: [],
      gm: { rolls: 'made' },
      moves: false,
      typed: false,
    })
    jest.mocked(createRollRequest).mockResolvedValue({ id: 'req-gm' })
    jest
      .mocked(getRollRequestView)
      .mockResolvedValue({ id: 'req-gm', status: 'sending' })
    jest.mocked(getSheetText).mockResolvedValue('<p>Stonecunning.</p>')
  })

  it("serves the campaign's owner the character's sheet, rolls and descriptions, as its Gamemaster", async () => {
    const table = await routes.table()
    expect(table.status).toBe(200)
    await expect(table.json()).resolves.toEqual(view)
    expect(getGmSeat).toHaveBeenLastCalledWith('gm-1', 'camp1', 'balin')
    expect(getTableView).toHaveBeenCalledWith(seat, { sheetVersion: undefined })
    // The Gamemaster at the table may roll, so the module waits for their rolls too; but the
    // character is open in the app only on its player's page, which alone the module waits for to
    // answer what Midi-QOL asks.
    expect(notePlayersSeen).toHaveBeenCalledWith('camp1')
    expect(noteTableOpen).not.toHaveBeenCalled()

    const rolled = await routes.rolls()
    expect(rolled.status).toBe(202)
    await expect(rolled.json()).resolves.toEqual({ id: 'req-gm' })
    expect(createRollRequest).toHaveBeenCalledWith(seat, perception)
    expect(getGmSeat).toHaveBeenLastCalledWith('gm-1', 'camp1', 'balin')

    const roll = await routes.roll()
    expect(roll.status).toBe(200)
    expect(getRollRequestView).toHaveBeenCalledWith(seat, 'req-gm')
    expect(getGmSeat).toHaveBeenLastCalledWith('gm-1', 'camp1', 'balin')

    const text = await routes.text()
    expect(text.status).toBe(200)
    await expect(text.json()).resolves.toEqual({ html: '<p>Stonecunning.</p>' })
    expect(getSheetText).toHaveBeenCalledWith(seat, HASH)
    expect(getGmSeat).toHaveBeenLastCalledWith('gm-1', 'camp1', 'balin')
    expect(getGmSeat).toHaveBeenCalledTimes(4)
  })

  it('has nothing new only while where the rolls go is as the page last saw it too', async () => {
    const known = '?version=7&live=1&rolls=skill'
    await expect(routes.table(`${known}&gm=made`)).resolves.toHaveProperty(
      'status',
      204,
    )
    await expect(routes.table(`${known}&gm=update`)).resolves.toHaveProperty(
      'status',
      200,
    )
    await expect(routes.table(known)).resolves.toHaveProperty('status', 200)
  })

  it('refuses a roll that says whose it is, as a player’s', async () => {
    await expect(
      routes.rolls({ ...perception, by: 'gm' }),
    ).resolves.toHaveProperty('status', 400)
    expect(createRollRequest).not.toHaveBeenCalled()
  })

  it.each(Object.keys(routes) as (keyof typeof routes)[])(
    '%s: not found, saying nothing, for another user’s campaign or a character not in its roster; 401 signed out',
    async name => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      jest.mocked(getGmSeat).mockResolvedValue(undefined)
      const missing = await routes[name]()
      expect(missing.status).toBe(404)
      await expect(missing.text()).resolves.toBe('')

      // eslint-disable-next-line unicorn/no-useless-undefined
      jest.mocked(getCurrentUser).mockResolvedValue(undefined)
      jest.mocked(getGmSeat).mockClear()
      await expect(routes[name]()).resolves.toHaveProperty('status', 401)
      expect(getGmSeat).not.toHaveBeenCalled()
      for (const reader of [
        getTableView,
        createRollRequest,
        getRollRequestView,
        getSheetText,
      ]) {
        expect(reader).not.toHaveBeenCalled()
      }
    },
  )

  it("is not found for a roll that isn't this Gamemaster's as this character", async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getRollRequestView).mockResolvedValue(undefined)
    await expect(routes.roll()).resolves.toHaveProperty('status', 404)
  })
})
