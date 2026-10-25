/* eslint-disable unicorn/no-null -- Prisma's unset columns are null */
import { prismaMock } from '../../jest.setup'
import { listOwnedCampaigns } from './campaigns'
import { getGroupView } from './party'
import { playerSeat } from './seats'
import { getTableView } from './table'
import {
  foundrySnapshot,
  groupEntry,
  groupSheet,
  roster,
} from '@/mocks/sending-stone'

// What Foundry says of itself for a campaign is its Gamemaster's alone, on their campaign card
// (decision 8): no view a player reads ever carries it, nor asks for it.

const ORIGIN = 'https://my-game.forge-vtt.com'

/** The dish count's mock: Prisma's groupBy is typed past what the deep mock's types can follow. */
const groupBy = () => prismaMock.cookbookDish.groupBy as unknown as jest.Mock

// Changed on purpose (round 0.38.0 §D9): the list counts the campaigns' dishes from the Magical
// Recipe Book, of which there are none here; the deep mock answers nothing otherwise.
beforeEach(() => {
  groupBy().mockResolvedValue([] as any)
})

/** A Gamemaster's one campaign, as listed, stored with these fields. */
const listed = async (fields: object) => {
  prismaMock.campaign.findMany.mockResolvedValue([
    {
      id: 'c1',
      title: 'The Lonely Mountain',
      origin: ORIGIN,
      worldTitle: null,
      inviteCode: 'code-1',
      foundryId: 'camp-a',
      lastSeenAt: null,
      helloSession: 'session-1',
      characters: [],
      groups: [],
      rollsEnabled: false,
      rollKinds: [],
      rollFeatures: [],
      bridgePolledAt: null,
      refusedAt: null,
      refusalReason: null,
      refusalStatus: null,
      refusalDetail: null,
      players: [],
      ...fields,
    },
  ] as any)
  const [campaign] = await listOwnedCampaigns('gm-1')
  return campaign
}

/**
 * The campaign as held, with Foundry's settings in it, and every column a query might ask for:
 * what a query that asked for them all would be handed.
 */
const stored = {
  id: 'c1',
  origin: ORIGIN,
  title: 'The Lonely Mountain',
  version: 7,
  worldTitle: 'Return to Erebor',
  lastSeenAt: new Date(Date.now() - 30_000),
  ownerId: 'gm-1',
  characters: roster.map(({ id, name }) => ({ id, name })),
  groups: [groupEntry({ access: { 'actor-thorin': 'owner' } })],
  rollsEnabled: false,
  rollKinds: [],
  rollFeatures: [],
  transferFeatures: [],
  bridgePolledAt: null,
  foundry: foundrySnapshot(),
}

/** Whether anything of Foundry's settings is in what was sent. */
const tellsFoundry = (view: unknown) =>
  /foundry|settings|attackRollVisibility|Challenge Visibility/i.test(
    JSON.stringify(view),
  )

/** Every campaign query made, by the columns it asked for. */
const askedFor = () =>
  prismaMock.campaign.findUnique.mock.calls.map(([query]) => query.select)

describe("db, Foundry's settings for the Gamemaster alone (module 0.30.0)", () => {
  it('lists what Foundry last said of itself on the campaign, for its Gamemaster', async () => {
    const campaign = await listed({ foundry: foundrySnapshot() })

    expect(campaign.foundry).toEqual(foundrySnapshot())
    expect(prismaMock.campaign.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'gm-1' },
        select: expect.objectContaining({ foundry: true }),
      }),
    )
  })

  it.each([
    ['before any hello', null],
    ['as no object', ['14.365']],
  ])('lists nothing of Foundry %s', async (_name, foundry) => {
    expect(await listed({ foundry })).not.toHaveProperty('foundry')
  })

  describe('never to a player', () => {
    beforeEach(() => {
      prismaMock.campaign.findUnique.mockResolvedValue(stored as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])
      prismaMock.rollPrompt.findMany.mockResolvedValue([])
      prismaMock.rollRequest.findMany.mockResolvedValue([])
      prismaMock.actorSheet.findUnique.mockResolvedValue(null)
      prismaMock.groupSheet.findUnique.mockResolvedValue({
        data: groupSheet(),
        updatedAt: new Date('2026-10-19T12:00:00.000Z'),
      } as any)
    })

    it("leaves them out of a player's table view, never asking for them", async () => {
      const seat = playerSeat(
        {
          id: 'char-1',
          name: 'Thorin Oakenshield',
          gameUrl: ORIGIN,
          campaignTitle: 'The Lonely Mountain',
          campaignId: 'c1',
          actorId: 'actor-thorin',
        },
        'user-1',
      )

      const view = await getTableView(seat)

      expect(view.campaign?.title).toBe('The Lonely Mountain')
      expect(tellsFoundry(view)).toBe(false)
      expect(askedFor().length).toBeGreaterThan(0)
      for (const select of askedFor())
        expect(select).not.toHaveProperty('foundry')
    })

    it("leaves them out of the Gamemaster's table view at a character's sheet too", async () => {
      const view = await getTableView({
        name: 'Thorin Oakenshield',
        gameUrl: ORIGIN,
        campaignTitle: 'The Lonely Mountain',
        campaignId: 'c1',
        actorId: 'actor-thorin',
        role: 'gm',
        userId: 'gm-1',
        characterId: null,
      })

      expect(tellsFoundry(view)).toBe(false)
      for (const select of askedFor())
        expect(select).not.toHaveProperty('foundry')
    })

    it("leaves them out of a party sheet's view", async () => {
      const view = await getGroupView(
        {
          role: 'player',
          campaignId: 'c1',
          actorId: 'actor-thorin',
          characterId: 'char-1',
          name: 'Thorin Oakenshield',
        },
        'company',
      )

      expect(view?.group.name).toBe('The Company')
      expect(tellsFoundry(view)).toBe(false)
      for (const select of askedFor())
        expect(select).not.toHaveProperty('foundry')
    })
  })
})
