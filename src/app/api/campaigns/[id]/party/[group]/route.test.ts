/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../jest.setup'
import { GET } from './route'
import { getCurrentUser } from '@/lib/session'
import { groupEntry, groupSheet } from '@/mocks/sending-stone'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const hidden = groupEntry({ id: 'hidden', name: 'The Hidden Hand', access: {} })

const get = (group: string, query = '') =>
  GET(
    new NextRequest(
      `https://player.example/api/campaigns/c1/party/${group}${query}`,
    ),
    { params: Promise.resolve({ id: 'c1', group }) },
  )

/** The status it answers with. */
const statusOf = async (...args: Parameters<typeof get>) => {
  const response = await get(...args)
  return response.status
}

describe('app/api/campaigns/[id]/party/[group]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      title: 'The Lonely Mountain',
      origin: 'https://my-game.forge-vtt.com',
      version: 7,
      lastSeenAt: null,
      ownerId: 'gm-1',
      groups: [groupEntry(), hidden],
      transferFeatures: [],
    } as any)
    prismaMock.groupSheet.findUnique.mockResolvedValue({
      data: groupSheet(),
      updatedAt: new Date(),
    } as any)
  })

  it("gives the campaign's Gamemaster its party sheet, marking no member as theirs", async () => {
    const response = await get('company')

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const view = await response.json()
    expect(view.live).toBe(false)
    expect(view.sheet.members.some((member: object) => 'own' in member)).toBe(
      false,
    )
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } }),
    )
  })

  it('gives them one no player may see in Foundry, saying so', async () => {
    prismaMock.groupSheet.findUnique.mockResolvedValue(null)

    const response = await get('hidden')
    const view = await response.json()

    expect(view).toEqual(expect.objectContaining({ private: true }))
    expect(view).not.toHaveProperty('sheet')
  })

  it('answers 204 while nothing has changed', async () => {
    expect(await statusOf('company', '?version=7&live=0')).toBe(204)
  })

  it('lets them take from it into any of the campaign’s characters, from module 0.31.0, while its game takes moves', async () => {
    const held = {
      id: 'c1',
      title: 'The Lonely Mountain',
      origin: 'https://my-game.forge-vtt.com',
      version: 7,
      lastSeenAt: null,
      ownerId: 'gm-1',
      groups: [groupEntry(), hidden],
      transfersEnabled: true,
      transferFeatures: [],
      bridgePolledAt: new Date(Date.now() - 5000),
    }
    // The roster is read apart, for the Gamemaster alone.
    prismaMock.campaign.findUnique.mockImplementation((async ({
      select,
    }: any) =>
      select.characters
        ? {
            characters: [
              {
                id: 'thorin',
                name: 'Thorin',
                img: 'worlds/erebor/thorin.webp',
              },
              { id: 'vex', name: 'Vex', img: null },
            ],
          }
        : held) as any)

    const viewResponse = await get('company')
    const view = await viewResponse.json()

    expect(view.moves).toEqual({
      characters: [
        {
          id: 'thorin',
          name: 'Thorin',
          portrait: 'https://my-game.forge-vtt.com/worlds/erebor/thorin.webp',
        },
        { id: 'vex', name: 'Vex' },
      ],
    })
    expect(await statusOf('company', '?version=7&live=0&moves=1')).toBe(204)
    expect(await statusOf('company', '?version=7&live=0')).toBe(200)

    held.transfersEnabled = false
    const offResponse = await get('company')
    const off = await offResponse.json()
    expect(off).not.toHaveProperty('moves')
    expect(await statusOf('company', '?version=7&live=0')).toBe(204)
  })

  it('asks the signed-out to sign in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    expect(await statusOf('company')).toBe(401)
  })

  it("has nothing for another Gamemaster, or a group that isn't there", async () => {
    expect(await statusOf('elsewhere')).toBe(404)
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-2' } as any)
    expect(await statusOf('company')).toBe(404)
    expect(await statusOf('company', '?version=7&live=0')).toBe(404)
  })
})
