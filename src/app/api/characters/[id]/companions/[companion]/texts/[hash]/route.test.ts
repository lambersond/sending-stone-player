/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../jest.setup'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getCurrentUser } from '@/lib/session'
import {
  FROST_THORIN,
  mockCompanionCampaign,
  mockCompanionEntry,
  mockCompanionSheet,
  PARTY,
} from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const wolf = mockCompanionEntry()
/** The Frost Road as held, its companions listed, Thorin's player's Character in it. */
const held = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )
const params = (companion = 'wolfBrakka', id = 'char-1') => ({
  params: Promise.resolve({ id, companion, hash: 'b17e0000000001' }),
})

const get = (companion?: string, id?: string) =>
  GET(
    new NextRequest(
      'https://player.example/api/characters/char-1/companions/wolfBrakka/texts/b17e0000000001',
    ),
    params(companion, id),
  )

describe('app/api/characters/[id]/companions/[companion]/texts/[hash]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
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

  it('answers 404, saying no more, for a character not theirs, another player’s, or a companion not listed', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)
    await expect(get()).resolves.toHaveProperty('status', 404)

    // Vex's player at Thorin's wolf.
    jest.mocked(getCharacter).mockResolvedValue({
      ...FROST_THORIN,
      id: 'char-2',
      actorId: PARTY.vex,
    })
    const vexes = await get('wolfBrakka', 'char-2')
    expect(vexes.status).toBe(404)
    expect(vexes.headers.get('Cache-Control')).toBe('no-store')

    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
    held({ companions: [] })
    await expect(get()).resolves.toHaveProperty('status', 404)
    await expect(get('wolf.brakka')).resolves.toHaveProperty('status', 404)
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
