/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../jest.setup'
import { POST } from './route'
import { getCharacter } from '@/db/characters'
import { createRollRequest } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'
import {
  FROST_THORIN,
  mockCompanionCampaign,
  mockCompanionEntry,
  PARTY,
} from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  createRollRequest: jest.fn(),
  getRollRequestView: jest.fn(),
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

/** The wolf's Bite at no one. */
const bite = {
  kind: 'attack',
  item: 'wolfBite',
  activity: 'biteAttack',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
}

const post = (companion?: string, id?: string) =>
  POST(
    new NextRequest(
      'https://player.example/api/characters/char-1/companions/wolfBrakka/rolls',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bite),
      },
    ),
    params(companion, id),
  )

describe('app/api/characters/[id]/companions/[companion]/rolls', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
    held()
  })

  it('answers 401 signed out', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- signed out
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    const response = await post()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers 404, saying no more, for a character not theirs, another player’s, or a companion not listed', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)
    await expect(post()).resolves.toHaveProperty('status', 404)

    // Vex's player at Thorin's wolf.
    jest.mocked(getCharacter).mockResolvedValue({
      ...FROST_THORIN,
      id: 'char-2',
      actorId: PARTY.vex,
    })
    const vexes = await post('wolfBrakka', 'char-2')
    expect(vexes.status).toBe(404)
    expect(vexes.headers.get('Cache-Control')).toBe('no-store')

    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
    held({ companions: [] })
    await expect(post()).resolves.toHaveProperty('status', 404)
    await expect(post('wolf.brakka')).resolves.toHaveProperty('status', 404)
  })

  it('has the roll made as the companion, answering as the character’s rolls are', async () => {
    jest.mocked(createRollRequest).mockResolvedValue({ id: 'req-1' })

    const response = await post()
    expect(response.status).toBe(202)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ id: 'req-1' })
    expect(createRollRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'player',
        actorId: 'wolfBrakka',
        companion: { of: PARTY.thorin, entry: wolf },
      }),
      bite,
    )
  })

  it('passes on why it wasn’t taken', async () => {
    jest
      .mocked(createRollRequest)
      .mockResolvedValue({ status: 422, reason: 'follows' })

    const response = await post()
    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ reason: 'follows' })
  })
})
