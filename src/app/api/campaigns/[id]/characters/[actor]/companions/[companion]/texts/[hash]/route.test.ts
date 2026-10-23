/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../../../jest.setup'
import { GET } from './route'
import { getCurrentUser } from '@/lib/session'
import {
  mockCompanionCampaign,
  mockCompanionEntry,
  mockCompanionSheet,
  PARTY,
} from '@/mocks/sending-stone'

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
  params: Promise.resolve({
    id: 'c1',
    actor,
    companion,
    hash: 'b17e0000000001',
  }),
})

const get = (companion?: string, actor?: string) =>
  GET(
    new NextRequest(
      'https://player.example/api/campaigns/c1/characters/thorin/companions/wolfBrakka/texts/b17e0000000001',
    ),
    params(companion, actor),
  )

describe('app/api/campaigns/[id]/characters/[actor]/companions/[companion]/texts/[hash]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    held()
    expect(wolf.key).toBe('wolfBrakka')
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

  it("serves its own sheet's description, kept a day, and 404 for a hash that can't be one", async () => {
    prismaMock.companionSheet.findUnique.mockResolvedValue({
      data: mockCompanionSheet({
        details: {
          about: [],
          personality: [],
          appearance: null,
          xp: null,
          biography: 'b17e0000000001',
        },
      }),
    } as any)
    prismaMock.sheetText.findUnique.mockResolvedValue({
      html: '<p>A grey wolf.</p>',
    } as any)

    const response = await get()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400')
    await expect(response.json()).resolves.toEqual({
      html: '<p>A grey wolf.</p>',
    })
    expect(prismaMock.companionSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignCompanion: { campaignId: 'c1', key: 'wolfBrakka' } },
      select: { data: true },
    })

    const junk = await GET(new NextRequest('https://player.example/x'), {
      params: params().params.then(named => ({ ...named, hash: 'nope' })),
    })
    expect(junk.status).toBe(404)
    expect(junk.headers.get('Cache-Control')).toBe('no-store')
  })
})
