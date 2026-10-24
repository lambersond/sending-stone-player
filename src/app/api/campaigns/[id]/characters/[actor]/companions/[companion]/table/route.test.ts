/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../../jest.setup'
import { GET } from './route'
import { getCurrentUser } from '@/lib/session'
import {
  mockCompanionCampaign,
  mockCompanionEntry,
  PARTY,
} from '@/mocks/sending-stone'

jest.mock('@/db/roll-requests', () => ({
  notePlayersSeen: jest.fn(),
  noteTableOpen: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const wolf = mockCompanionEntry()
/** The Frost Road as held, owned by its Gamemaster, its companions listed. */
const held = (fields: object = {}) => {
  prismaMock.campaign.findUnique.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )
  prismaMock.campaign.findFirst.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )
}
const params = (companion = 'wolfBrakka', actor: string = PARTY.thorin) => ({
  params: Promise.resolve({ id: 'c1', actor, companion }),
})

const get = (companion?: string, actor?: string, query = '') =>
  GET(
    new NextRequest(
      `https://player.example/api/campaigns/c1/characters/thorin/companions/wolfBrakka/table${query}`,
    ),
    params(companion, actor),
  )

describe('app/api/campaigns/[id]/characters/[actor]/companions/[companion]/table', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    held()
    prismaMock.combat.findMany.mockResolvedValue([])
    prismaMock.rollRequest.findMany.mockResolvedValue([])
    prismaMock.companionSheet.findUnique.mockResolvedValue(null)
  })

  it('answers 401 signed out', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- signed out
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    const response = await get()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers 404, saying no more, to another campaign’s Gamemaster, for another character’s companion, or one not listed', async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null)
    const others = await get()
    expect(others.status).toBe(404)
    expect(others.headers.get('Cache-Control')).toBe('no-store')
    expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', ownerId: 'gm-1' } }),
    )

    held()
    await expect(get('wolfBrakka', PARTY.vex)).resolves.toHaveProperty(
      'status',
      404,
    )
    held({ companions: [] })
    await expect(get()).resolves.toHaveProperty('status', 404)
  })

  it("gives the companion's view, never cached", async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toMatchObject({
      version: 7,
      connected: true,
      companion: { key: 'wolfBrakka', name: 'Wolf' },
    })
  })

  it('answers 204 while nothing has changed, and the view once the version moves', async () => {
    const unchanged = '?version=7&live=1&gm=update'
    await expect(
      get('wolfBrakka', undefined, unchanged),
    ).resolves.toHaveProperty('status', 204)

    held({ version: 8 })
    await expect(
      get('wolfBrakka', undefined, unchanged),
    ).resolves.toHaveProperty('status', 200)
  })

  it('checks it is still the character’s before saying nothing changed', async () => {
    held({ companions: [] })

    const response = await get(
      'wolfBrakka',
      undefined,
      '?version=7&live=1&gm=update',
    )
    expect(response.status).toBe(404)
  })

  it('says where the Gamemaster’s rolls as it go', async () => {
    const response = await get()
    await expect(response.json()).resolves.toMatchObject({
      gm: { rolls: 'update' },
    })
    expect(wolf.key).toBe('wolfBrakka')
  })
})
