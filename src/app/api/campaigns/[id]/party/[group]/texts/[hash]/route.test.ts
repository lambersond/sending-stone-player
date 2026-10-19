/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../jest.setup'
import { GET } from './route'
import { getCurrentUser } from '@/lib/session'
import {
  GROUP_TEXTS,
  groupEntry,
  groupSheet,
  TEXTS,
} from '@/mocks/sending-stone'

jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

const get = (hash: string, group = 'company') =>
  GET(
    new NextRequest(
      `https://player.example/api/campaigns/c1/party/${group}/texts/${hash}`,
    ),
    { params: Promise.resolve({ id: 'c1', group, hash }) },
  )

/** The status it answers with. */
const statusOf = async (...args: Parameters<typeof get>) => {
  const response = await get(...args)
  return response.status
}

describe('app/api/campaigns/[id]/party/[group]/texts/[hash]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-1' } as any)
    prismaMock.campaign.findUnique.mockResolvedValue({
      id: 'c1',
      title: 'The Lonely Mountain',
      origin: 'https://my-game.forge-vtt.com',
      version: 7,
      lastSeenAt: null,
      ownerId: 'gm-1',
      groups: [groupEntry({ access: {} })],
    } as any)
    prismaMock.groupSheet.findUnique.mockResolvedValue({
      data: groupSheet(),
      updatedAt: new Date(),
    } as any)
    prismaMock.sheetText.findUnique.mockResolvedValue({
      html: '<p>The road goes ever on.</p>',
    } as any)
  })

  it("gives the campaign's Gamemaster a description on its party sheet", async () => {
    const response = await get(GROUP_TEXTS.description)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400')
    await expect(response.json()).resolves.toEqual({
      html: '<p>The road goes ever on.</p>',
    })
  })

  it('has nothing for a description its sheet doesn’t refer to, another Gamemaster, or the signed out', async () => {
    expect(await statusOf(TEXTS.biography)).toBe(404)
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'gm-2' } as any)
    expect(await statusOf(GROUP_TEXTS.description)).toBe(404)
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)
    expect(await statusOf(GROUP_TEXTS.description)).toBe(401)
  })
})
