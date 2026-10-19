/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { NextRequest } from 'next/server'
import { prismaMock } from '../../../../../../../../../jest.setup'
import { GET } from './route'
import { GET as getCharacterText } from '@/app/api/characters/[id]/texts/[hash]/route'
import { getCharacter } from '@/db/characters'
import { getCurrentUser } from '@/lib/session'
import {
  fullerSheet,
  GROUP_TEXTS,
  groupEntry,
  groupSheet,
  PARTY,
  TEXTS,
} from '@/mocks/sending-stone'

jest.mock('@/db/characters', () => ({ getCharacter: jest.fn() }))
jest.mock('@/lib/session', () => ({ getCurrentUser: jest.fn() }))

/** Thorin, whose player's Foundry user owns The Company. */
const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: PARTY.thorin,
}
/** Scouts, another of the campaign's groups, whose description is its own. */
const SCOUTS_TEXT = 'f8091a2b3c4d5e'
const scouts = groupEntry({ id: 'scouts', name: 'Scouts', primary: false })

/** The campaign as held, with its groups, who may see each, and the sheets of each. */
const held = (access: object = groupEntry().access) => {
  prismaMock.campaign.findUnique.mockResolvedValue({
    id: 'c1',
    title: 'The Lonely Mountain',
    origin: 'https://my-game.forge-vtt.com',
    version: 7,
    lastSeenAt: new Date(),
    ownerId: 'gm-1',
    groups: [groupEntry({ access: access as any }), scouts],
  } as any)
  prismaMock.groupSheet.findUnique.mockImplementation((async ({
    where,
  }: any) => ({
    data:
      where.campaignGroup.actorId === 'scouts'
        ? groupSheet({ description: { full: SCOUTS_TEXT, summary: null } })
        : groupSheet(),
    updatedAt: new Date(),
  })) as any)
  // Thorin's own sheet, whose descriptions are his alone.
  prismaMock.actorSheet.findUnique.mockResolvedValue({
    data: fullerSheet(),
  } as any)
  prismaMock.sheetText.findUnique.mockImplementation((async ({
    where,
  }: any) => ({
    html: `<p>${where.campaignHash.hash}</p>`,
  })) as any)
}

const get = (hash: string, group = 'company') =>
  GET(
    new NextRequest(
      `https://player.example/api/characters/char-1/party/${group}/texts/${hash}`,
    ),
    { params: Promise.resolve({ id: 'char-1', group, hash }) },
  )

/** The status it answers with. */
const statusOf = async (...args: Parameters<typeof get>) => {
  const response = await get(...args)
  return response.status
}

describe('app/api/characters/[id]/party/[group]/texts/[hash]', () => {
  beforeEach(() => {
    jest.mocked(getCurrentUser).mockResolvedValue({ id: 'user-1' } as any)
    jest.mocked(getCharacter).mockResolvedValue(character)
    held()
  })

  it.each([
    ['its description', GROUP_TEXTS.description],
    ['its summary', GROUP_TEXTS.summary],
    ["an item's", GROUP_TEXTS.map],
    ["a container's", GROUP_TEXTS.chest],
  ])('gives %s, for the browser to keep', async (_, hash) => {
    const response = await get(hash)

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400')
    await expect(response.json()).resolves.toEqual({ html: `<p>${hash}</p>` })
    expect(prismaMock.sheetText.findUnique).toHaveBeenCalledWith({
      where: { campaignHash: { campaignId: 'c1', hash } },
      select: { html: true },
    })
  })

  it('asks the signed-out to sign in', async () => {
    // eslint-disable-next-line unicorn/no-useless-undefined
    jest.mocked(getCurrentUser).mockResolvedValue(undefined)

    expect(await statusOf(GROUP_TEXTS.description)).toBe(401)
  })

  it("never gives a description only the character's own sheet refers to", async () => {
    const response = await get(TEXTS.secondWind)

    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
  })

  it("never gives another group's description through this one's", async () => {
    expect(await statusOf(SCOUTS_TEXT, 'company')).toBe(404)
    expect(await statusOf(SCOUTS_TEXT, 'scouts')).toBe(200)
  })

  it.each([
    ['a player with only Limited on it', () => held({ [PARTY.vex]: 'owner' })],
    [
      "another player's character",
      // eslint-disable-next-line unicorn/no-useless-undefined
      () => jest.mocked(getCharacter).mockResolvedValue(undefined),
    ],
  ])('gives %s nothing, however real the hash', async (_, arrange) => {
    arrange()

    expect(await statusOf(GROUP_TEXTS.description)).toBe(404)
    expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
  })

  it('has nothing for a malformed hash', async () => {
    expect(await statusOf('not-a-hash')).toBe(404)
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalled()
  })

  it("never gives a party's description through the character's own texts", async () => {
    const response = await getCharacterText(
      new NextRequest(
        `https://player.example/api/characters/char-1/texts/${GROUP_TEXTS.description}`,
      ),
      {
        params: Promise.resolve({
          id: 'char-1',
          hash: GROUP_TEXTS.description,
        }),
      },
    )

    expect(response.status).toBe(404)
    expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
  })
})
