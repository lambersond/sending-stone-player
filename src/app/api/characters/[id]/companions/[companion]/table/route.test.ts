/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../jest.setup'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getCurrentUser } from '@/lib/session'
import {
  FROST_THORIN,
  mockCompanionCampaign,
  mockCompanionEntry,
  PARTY,
} from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  notePlayersSeen: jest.fn(),
  noteTableOpen: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const wolf = mockCompanionEntry()
/** The Frost Road as held, its companions listed, Thorin's player's Character in it. */
const held = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )
const params = (companion = 'wolfBrakka', id = 'char-1') => ({
  params: Promise.resolve({ id, companion }),
})

const get = (companion?: string, id?: string, query = '') =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/char-1/companions/wolfBrakka/table${query}`,
    ),
    params(companion, id),
  )

describe('app/api/characters/[id]/companions/[companion]/table', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
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
    const unchanged = '?version=7&live=1&rolls=attack,damage'
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
      '?version=7&live=1&rolls=attack,damage',
    )
    expect(response.status).toBe(404)
  })

  it('reads the companion as the user’s own character’s', async () => {
    await get()
    expect(getCharacter).toHaveBeenCalledWith('user-1', 'char-1')
    expect(wolf.of).toEqual([PARTY.thorin])
  })
})
