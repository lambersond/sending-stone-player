/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../../jest.setup'
import { POST } from './route'
import { createRollRequest } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'
import {
  mockCompanionCampaign,
  mockCompanionEntry,
  PARTY,
} from '@/mocks/sending-stone'

jest.mock('@/db/roll-requests', () => ({
  createRollRequest: jest.fn(),
  getRollRequestView: jest.fn(),
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

const post = (companion?: string, actor?: string) =>
  POST(
    new NextRequest(
      'https://player.example/api/campaigns/c1/characters/thorin/companions/wolfBrakka/rolls',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(bite),
      },
    ),
    params(companion, actor),
  )

describe('app/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    held()
  })

  it('answers 401 signed out', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- signed out
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    const response = await post()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers 404, saying no more, to another campaign’s Gamemaster, for another character’s companion, or one not listed', async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null)
    const others = await post()
    expect(others.status).toBe(404)
    expect(others.headers.get('Cache-Control')).toBe('no-store')
    expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', ownerId: 'gm-1' } }),
    )

    held()
    await expect(post('wolfBrakka', PARTY.vex)).resolves.toHaveProperty(
      'status',
      404,
    )
    held({ companions: [] })
    await expect(post()).resolves.toHaveProperty('status', 404)
  })

  it('has the roll made as the companion, answering as the character’s rolls are', async () => {
    jest.mocked(createRollRequest).mockResolvedValue({ id: 'req-1' })

    const response = await post()
    expect(response.status).toBe(202)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({ id: 'req-1' })
    expect(createRollRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'gm',
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
