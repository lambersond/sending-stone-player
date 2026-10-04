/* eslint-disable unicorn/no-null -- a character with no campaign holds null */
import { Prisma } from '@prisma/client'
import { prismaMock } from '../../jest.setup'
import {
  chooseCharacter,
  deleteCharacter,
  getCharacter,
  joinCampaign,
  listCharacters,
} from './characters'
import { roster } from '@/mocks/sending-stone'

const select = {
  id: true,
  name: true,
  gameUrl: true,
  campaignTitle: true,
  campaignId: true,
  actorId: true,
  campaign: { select: { title: true, origin: true } },
}
const row = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://old.forge-vtt.com',
  campaignTitle: 'Old title',
  campaignId: 'c1',
  actorId: 'actor-thorin',
  campaign: {
    title: 'The Lonely Mountain',
    origin: 'https://my-game.forge-vtt.com',
  },
}
// The campaign's current title and game, over what was saved when the character was chosen.
const thorin = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId: 'actor-thorin',
}

const taken = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '6',
  })

describe('db/characters', () => {
  it("lists only the user's characters, by name, with their campaign's title", async () => {
    prismaMock.character.findMany.mockResolvedValue([
      row,
      { ...row, id: 'char-2', campaignId: null, actorId: null, campaign: null },
    ] as any)

    await expect(listCharacters('user-1')).resolves.toEqual([
      thorin,
      {
        ...thorin,
        id: 'char-2',
        gameUrl: 'https://old.forge-vtt.com',
        campaignTitle: 'Old title',
        campaignId: null,
        actorId: null,
      },
    ])
    expect(prismaMock.character.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('gets a character only when the user owns it', async () => {
    prismaMock.character.findFirst.mockResolvedValue(row as any)
    await expect(getCharacter('user-1', 'char-1')).resolves.toEqual(thorin)
    expect(prismaMock.character.findFirst).toHaveBeenCalledWith({
      where: { id: 'char-1', userId: 'user-1' },
      select,
    })

    prismaMock.character.findFirst.mockResolvedValue(null)
    await expect(getCharacter('user-1', 'other')).resolves.toBeUndefined()
  })

  describe('joinCampaign', () => {
    const campaign = {
      id: 'c1',
      title: 'The Lonely Mountain',
      origin: 'https://my-game.forge-vtt.com',
      characters: roster,
    }

    it('makes the chosen character for the player', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      prismaMock.character.create.mockResolvedValue({ id: 'char-9' } as any)

      await expect(
        joinCampaign('user-1', 'code-1', 'actor-vex'),
      ).resolves.toEqual({ id: 'char-9' })
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { inviteCode: 'code-1' },
        select: { id: true, title: true, origin: true, characters: true },
      })
      expect(prismaMock.character.create).toHaveBeenCalledWith({
        data: {
          name: 'Vex',
          gameUrl: 'https://my-game.forge-vtt.com',
          campaignTitle: 'The Lonely Mountain',
          campaignId: 'c1',
          actorId: 'actor-vex',
          userId: 'user-1',
        },
        select: { id: true },
      })
    })

    it('refuses a link that no longer works', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(joinCampaign('user-1', 'old', 'actor-vex')).resolves.toBe(
        'invalid-invite',
      )
      await expect(joinCampaign('user-1', '', 'actor-vex')).resolves.toBe(
        'invalid-invite',
      )
    })

    it("refuses a character that isn't the campaign's", async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      await expect(
        joinCampaign('user-1', 'code-1', 'actor-smaug'),
      ).resolves.toBe('unknown-character')
      expect(prismaMock.character.create).not.toHaveBeenCalled()
    })

    it('refuses a character another player chose first', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue(campaign as any)
      prismaMock.character.create.mockRejectedValue(taken())
      await expect(joinCampaign('user-1', 'code-1', 'actor-vex')).resolves.toBe(
        'taken',
      )

      prismaMock.character.create.mockRejectedValue(new Error('db down'))
      await expect(
        joinCampaign('user-1', 'code-1', 'actor-vex'),
      ).rejects.toThrow('db down')
    })
  })

  describe('chooseCharacter', () => {
    const inCampaign = { campaign: { characters: roster } }

    it("sets which of its campaign's characters it is", async () => {
      prismaMock.character.findFirst.mockResolvedValue(inCampaign as any)

      await expect(
        chooseCharacter('user-1', 'char-1', 'actor-vex'),
      ).resolves.toBe(true)
      expect(prismaMock.character.findFirst).toHaveBeenCalledWith({
        where: { id: 'char-1', userId: 'user-1' },
        select: { campaign: { select: { characters: true } } },
      })
      expect(prismaMock.character.update).toHaveBeenCalledWith({
        where: { id: 'char-1' },
        data: { actorId: 'actor-vex', name: 'Vex' },
      })
    })

    it('says why it could not', async () => {
      prismaMock.character.findFirst.mockResolvedValueOnce(null)
      await expect(chooseCharacter('user-1', 'x', 'actor-vex')).resolves.toBe(
        'missing',
      )
      prismaMock.character.findFirst.mockResolvedValueOnce({
        campaign: null,
      } as any)
      await expect(
        chooseCharacter('user-1', 'char-1', 'actor-vex'),
      ).resolves.toBe('missing')

      prismaMock.character.findFirst.mockResolvedValue(inCampaign as any)
      await expect(
        chooseCharacter('user-1', 'char-1', 'actor-smaug'),
      ).resolves.toBe('unknown-character')

      prismaMock.character.update.mockRejectedValue(taken())
      await expect(
        chooseCharacter('user-1', 'char-1', 'actor-vex'),
      ).resolves.toBe('taken')

      prismaMock.character.update.mockRejectedValue(new Error('db down'))
      await expect(
        chooseCharacter('user-1', 'char-1', 'actor-vex'),
      ).rejects.toThrow('db down')
    })
  })

  it('deletes a character only when the user owns it', async () => {
    prismaMock.character.deleteMany.mockResolvedValue({ count: 1 })
    await expect(deleteCharacter('user-1', 'char-1')).resolves.toBe(true)
    expect(prismaMock.character.deleteMany).toHaveBeenCalledWith({
      where: { id: 'char-1', userId: 'user-1' },
    })

    prismaMock.character.deleteMany.mockResolvedValue({ count: 0 })
    await expect(deleteCharacter('user-1', 'someone-elses')).resolves.toBe(
      false,
    )
  })
})
