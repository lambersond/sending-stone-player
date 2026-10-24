/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../../../jest.setup'
import { GET } from './route'
import { getCurrentUser } from '@/lib/session'
import { mockCompanionCampaign, PARTY } from '@/mocks/sending-stone'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const NOW = Date.parse('2026-10-24T20:00:00Z')

/** A roll as kept, sent by the Gamemaster as Thorin's wolf, unless said otherwise. */
const row = (fields: object) => ({
  characterId: null,
  campaignId: 'c1',
  requestedById: 'gm-1',
  role: 'gm',
  actorId: 'wolfBrakka',
  ofActorId: PARTY.thorin,
  kind: 'attack',
  payload: {},
  status: 'pending',
  result: null,
  createdAt: new Date(NOW - 2000),
  claimedAt: null,
  ...fields,
})

/** The Gamemaster's rolls: the wolf's Bite, refused once its token went; and others. */
const ROWS = [
  row({
    id: 'req-wolf',
    status: 'failed',
    result: { id: 'req-wolf', ok: false, reason: 'unknown' },
  }),
  row({ id: 'req-pending' }),
  // Theirs as Thorin, which his wolf's route never answers.
  row({ id: 'req-thorin', actorId: PARTY.thorin, ofActorId: null }),
  // Thorin's player's for the wolf.
  row({
    id: 'req-player',
    role: 'player',
    characterId: 'char-1',
    requestedById: 'user-1',
  }),
]

/** The rows kept, as the database finds one of them: every field asked for matched. */
const kept = () =>
  prismaMock.rollRequest.findFirst.mockImplementation((({
    where,
  }: {
    where: Record<string, unknown>
  }) =>
    Promise.resolve(
      ROWS.find(found =>
        Object.entries(where).every(
          ([field, value]) =>
            (found as Record<string, unknown>)[field] === value,
        ),
      ) ?? null,
    )) as any)

/** The Frost Road as held, owned by its Gamemaster. */
const held = (fields: object = {}) =>
  prismaMock.campaign.findFirst.mockResolvedValue(
    mockCompanionCampaign(fields) as any,
  )

const params = (roll: string, companion: string, actor: string) => ({
  params: Promise.resolve({ id: 'c1', actor, companion, roll }),
})

const get = (
  roll = 'req-wolf',
  companion = 'wolfBrakka',
  actor: string = PARTY.thorin,
) =>
  GET(
    new NextRequest(
      `https://player.example/api/campaigns/c1/characters/${actor}/companions/${companion}/rolls/${roll}`,
    ),
    params(roll, companion, actor),
  )

describe('app/api/campaigns/[id]/characters/[actor]/companions/[companion]/rolls/[roll]', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    held()
    kept()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('answers 401 signed out', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- signed out
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    const response = await get()
    expect(response.status).toBe(401)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers 404, saying no more, to another campaign’s Gamemaster, or for a key that can’t be a companion’s', async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(null)
    const others = await get()
    expect(others.status).toBe(404)
    expect(others.headers.get('Cache-Control')).toBe('no-store')
    expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', ownerId: 'gm-1' } }),
    )

    held()
    await expect(get('req-wolf', 'wolf.brakka')).resolves.toHaveProperty(
      'status',
      404,
    )
    expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
  })

  it('says where the companion’s roll stands, of their own rolls as it alone', async () => {
    const response = await get('req-pending')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      id: 'req-pending',
      status: 'sending',
    })
    expect(prismaMock.rollRequest.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'req-pending',
        campaignId: 'c1',
        actorId: 'wolfBrakka',
        role: 'gm',
        requestedById: 'gm-1',
        ofActorId: PARTY.thorin,
      },
      select: expect.objectContaining({ status: true, result: true }),
    })
  })

  it('still answers a roll sent as the companion after the module stops listing it, with its refusal', async () => {
    held({ companions: [] })

    const response = await get()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'req-wolf',
      status: 'failed',
      reason: 'unknown',
    })
  })

  it('answers 404 for their roll as the character, its player’s, or one from another character’s seat', async () => {
    await expect(get('req-thorin')).resolves.toHaveProperty('status', 404)
    await expect(get('req-player')).resolves.toHaveProperty('status', 404)
    await expect(get('req-9')).resolves.toHaveProperty('status', 404)
    // A wolf of Thorin's and of Vex's: what they sent as it from Thorin's seat is Thorin's pane's.
    const vexes = await get('req-wolf', 'wolfBrakka', PARTY.vex)
    expect(vexes.status).toBe(404)
    expect(vexes.headers.get('Cache-Control')).toBe('no-store')
  })
})
