/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../jest.setup'
import { GET } from './route'
import { getCharacter } from '@/db/characters'
import { notePlayersSeen, noteTableOpen } from '@/db/roll-requests'
import { getCurrentUser } from '@/lib/session'
import { groupEntry, groupSheet, PARTY } from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/db/roll-requests', () => ({
  notePlayersSeen: jest.fn(),
  noteTableOpen: jest.fn(),
}))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const UPDATED = new Date('2026-10-19T12:00:00.000Z')
/** Vex, whose player's Foundry user observes The Company. */
const character = {
  id: 'char-2',
  name: 'Vex',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: PARTY.vex,
}

/** The campaign as held, with The Company and who may see it. */
const held = (access: object = groupEntry().access, version = 7) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    id: 'c1',
    title: 'The Lonely Mountain',
    origin: 'https://my-game.forge-vtt.com',
    version,
    lastSeenAt: new Date(Date.now() - 30_000),
    ownerId: 'gm-1',
    groups: [groupEntry({ access: access as any })],
  } as any)

const get = (query = '', group = 'company') =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/char-2/party/${group}${query}`,
    ),
    { params: Promise.resolve({ id: 'char-2', group }) },
  )

/** The status it answers with. */
const statusOf = async (...args: Parameters<typeof get>) => {
  const response = await get(...args)
  return response.status
}

describe('app/api/characters/[id]/party/[group]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-2' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    held()
    prismaMock.groupSheet.findUnique.mockResolvedValue({
      data: groupSheet(),
      updatedAt: UPDATED,
    } as any)
  })

  it('gives the party sheet to a player whose Foundry user may see it, never cached', async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const view = await response.json()
    expect(view).toEqual(
      expect.objectContaining({
        version: 7,
        live: true,
        group: expect.objectContaining({ id: 'company', name: 'The Company' }),
        sheetVersion: UPDATED.toISOString(),
      }),
    )
    expect(view.sheet.members[1]).toEqual({
      id: PARTY.vex,
      name: 'Vex',
      own: true,
    })
    expect(getCharacter).toHaveBeenCalledWith('user-2', 'char-2')
    // A party sheet says nothing of who is at the table.
    expect(notePlayersSeen).not.toHaveBeenCalled()
    expect(noteTableOpen).not.toHaveBeenCalled()
  })

  it('asks the signed-out to sign in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    expect(await statusOf()).toBe(401)
  })

  it.each([
    [
      "another player's character",
      // eslint-disable-next-line unicorn/no-useless-undefined
      () => jest.mocked(getCharacter).mockResolvedValue(undefined),
    ],
    [
      'a player with only Limited on it',
      () => held({ [PARTY.thorin]: 'owner' }),
    ],
    ['a group no player may see', () => held({})],
  ])('has nothing for %s, saying no more', async (_, arrange) => {
    arrange()

    const response = await get('', 'company')
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await statusOf('', 'elsewhere')).toBe(404)
  })

  it('answers 204 while its version and liveness are as the viewer has them', async () => {
    const response = await get('?version=7&live=1')

    expect(response.status).toBe(204)
    expect(prismaMock.groupSheet.findUnique).not.toHaveBeenCalled()
    expect(await statusOf('?version=6&live=1')).toBe(200)
    expect(await statusOf('?version=7&live=0')).toBe(200)
  })

  it('answers a player whose access was taken away 404, never 204, however current they are', async () => {
    expect(await statusOf('?version=7&live=1')).toBe(204)
    // group.updated took Vex's player's Observer away, bumping the version, which a stale page
    // may already have from another event.
    held({ [PARTY.thorin]: 'owner' }, 8)

    expect(await statusOf('?version=8&live=1')).toBe(404)
    expect(await statusOf('?version=7&live=1')).toBe(404)
  })

  it('leaves out a sheet the viewer already has', async () => {
    const response = await get(
      `?version=6&live=1&sheet=${encodeURIComponent(UPDATED.toISOString())}`,
    )

    expect(response.status).toBe(200)
    const view = await response.json()
    expect(view).not.toHaveProperty('sheet')
    expect(view.sheetVersion).toBe(UPDATED.toISOString())
  })
})
