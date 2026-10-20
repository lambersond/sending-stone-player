/**
 * @jest-environment node
 */
/* eslint-disable unicorn/no-null -- Prisma uses null for an absent value */
import { prismaMock } from '../../jest.setup'
import { getGmSeat, playerSeat } from './seats'

/** Foundry's actor ids are letters and digits. */
const campaign = {
  id: 'c1',
  title: 'The Lonely Mountain',
  origin: 'https://my-game.forge-vtt.com',
  characters: [
    { id: 'thorin', name: 'Thorin Oakenshield' },
    { id: 'vex', name: 'Vex' },
  ],
}

describe('db/seats', () => {
  describe('playerSeat', () => {
    it("is the player at their own character's sheet", () => {
      expect(
        playerSeat(
          {
            id: 'char-1',
            name: 'Thorin',
            gameUrl: 'https://my-game.forge-vtt.com',
            campaignTitle: 'The Lonely Mountain',
            campaignId: 'c1',
            actorId: 'actor-thorin',
            chatReadAt: '2026-10-04T19:00:00.000Z',
          },
          'user-1',
        ),
      ).toEqual({
        name: 'Thorin',
        gameUrl: 'https://my-game.forge-vtt.com',
        campaignTitle: 'The Lonely Mountain',
        campaignId: 'c1',
        actorId: 'actor-thorin',
        chatReadAt: '2026-10-04T19:00:00.000Z',
        role: 'player',
        userId: 'user-1',
        characterId: 'char-1',
      })
    })
  })

  describe('getGmSeat', () => {
    it("seats the campaign's owner at a character in its roster, claimed or not, with no character of their own", async () => {
      prismaMock.campaign.findFirst.mockResolvedValue(campaign as any)

      await expect(getGmSeat('gm-1', 'c1', 'vex')).resolves.toEqual({
        name: 'Vex',
        gameUrl: 'https://my-game.forge-vtt.com',
        campaignTitle: 'The Lonely Mountain',
        campaignId: 'c1',
        actorId: 'vex',
        role: 'gm',
        userId: 'gm-1',
        characterId: null,
      })
      // Only a campaign this user owns.
      expect(prismaMock.campaign.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', ownerId: 'gm-1' },
        select: { id: true, title: true, origin: true, characters: true },
      })
    })

    it("seats no one at another user's campaign, an ownerless one, nor at an actor not in the roster", async () => {
      // Another user's, or one no one owns: no campaign of theirs has the id.
      prismaMock.campaign.findFirst.mockResolvedValue(null)
      await expect(
        getGmSeat('someone-else', 'c1', 'thorin'),
      ).resolves.toBeUndefined()

      prismaMock.campaign.findFirst.mockResolvedValue(campaign as any)
      await expect(getGmSeat('gm-1', 'c1', 'nobody')).resolves.toBeUndefined()
      // A roster that isn't one, as an ownerless campaign's never set up.
      prismaMock.campaign.findFirst.mockResolvedValue({
        ...campaign,
        characters: {},
      } as any)
      await expect(getGmSeat('gm-1', 'c1', 'thorin')).resolves.toBeUndefined()
    })

    it('seats no one without a user, or for a junk actor id, without looking', async () => {
      await expect(getGmSeat('', 'c1', 'thorin')).resolves.toBeUndefined()
      for (const junk of ['', 'actor-thorin', 'a'.repeat(65), 'x/../y', '%']) {
        await expect(getGmSeat('gm-1', 'c1', junk)).resolves.toBeUndefined()
      }
      expect(prismaMock.campaign.findFirst).not.toHaveBeenCalled()
    })
  })
})

describe('db/seats, typing in their own dice, from module 0.32.0', () => {
  it("carries the player's choice, from their character", () => {
    const seat = playerSeat(
      {
        id: 'char-1',
        name: 'Thorin',
        gameUrl: 'https://my-game.forge-vtt.com',
        campaignTitle: 'The Lonely Mountain',
        campaignId: 'c1',
        actorId: 'actor-thorin',
        manualDice: true,
      },
      'user-1',
    )
    expect(seat.manualDice).toBe(true)
  })

  it("never carries one for the Gamemaster's seat, which has nowhere to keep it", async () => {
    prismaMock.campaign.findFirst.mockResolvedValue(campaign as any)

    const seat = await getGmSeat('gm-1', 'c1', 'vex')
    expect(seat).toBeDefined()
    expect(seat).not.toHaveProperty('manualDice')
  })
})
