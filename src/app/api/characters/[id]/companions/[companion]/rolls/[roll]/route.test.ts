/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- the database uses null for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../jest.setup'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { getCurrentUser } from '@/lib/session'
import { FROST_THORIN, PARTY } from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const NOW = Date.parse('2026-10-24T20:00:00Z')

/** A roll as kept, sent by Thorin's player for his wolf, unless said otherwise. */
const row = (fields: object) => ({
  characterId: 'char-1',
  campaignId: 'c1',
  requestedById: 'user-1',
  role: 'player',
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

/** Thorin's player's rolls: the wolf's Bite, refused once the wolf's token went; and others. */
const ROWS = [
  row({
    id: 'req-wolf',
    status: 'failed',
    result: { id: 'req-wolf', ok: false, reason: 'unknown' },
  }),
  row({ id: 'req-pending' }),
  // Thorin's own, which his wolf's route never answers.
  row({ id: 'req-thorin', actorId: PARTY.thorin, ofActorId: null }),
  // His imp's.
  row({ id: 'req-imp', actorId: 'sceneFrost-tokenImp' }),
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

const params = (companion: string, roll: string, id: string) => ({
  params: Promise.resolve({ id, companion, roll }),
})

const get = (roll = 'req-wolf', companion = 'wolfBrakka', id = 'char-1') =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/${id}/companions/${companion}/rolls/${roll}`,
    ),
    params(companion, roll, id),
  )

describe('app/api/characters/[id]/companions/[companion]/rolls/[roll]', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
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

  it('answers 404, saying no more, for a character not theirs, or a key that can’t be a companion’s', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
    jest.mocked(getCharacter).mockResolvedValue(undefined)
    const others = await get()
    expect(others.status).toBe(404)
    expect(others.headers.get('Cache-Control')).toBe('no-store')

    jest.mocked(getCharacter).mockResolvedValue(FROST_THORIN)
    await expect(get('req-wolf', 'wolf.brakka')).resolves.toHaveProperty(
      'status',
      404,
    )
    expect(prismaMock.rollRequest.findFirst).not.toHaveBeenCalled()
  })

  it('says where the companion’s roll stands, of the seat’s own rolls for it alone', async () => {
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
        characterId: 'char-1',
        actorId: 'wolfBrakka',
        ofActorId: PARTY.thorin,
      },
      select: expect.objectContaining({ status: true, result: true }),
    })
  })

  it('still answers a roll sent for the companion after the module stops listing it, with its refusal', async () => {
    // Read without the stored list: the wolf's token was deleted after its Bite was sent, and the
    // game refused it as no longer Thorin's companion.
    const response = await get()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      id: 'req-wolf',
      status: 'failed',
      reason: 'unknown',
    })
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
  })

  it('answers 404 for the character’s own roll, another companion’s, or another player’s character’s', async () => {
    await expect(get('req-thorin')).resolves.toHaveProperty('status', 404)
    await expect(get('req-imp')).resolves.toHaveProperty('status', 404)
    await expect(get('req-9')).resolves.toHaveProperty('status', 404)

    // Vex's player, at Thorin's wolf, sent none of Thorin's rolls.
    jest.mocked(getCharacter).mockResolvedValue({
      ...FROST_THORIN,
      id: 'char-2',
      actorId: PARTY.vex,
    })
    const vexes = await get('req-wolf', 'wolfBrakka', 'char-2')
    expect(vexes.status).toBe(404)
    expect(vexes.headers.get('Cache-Control')).toBe('no-store')
  })
})
