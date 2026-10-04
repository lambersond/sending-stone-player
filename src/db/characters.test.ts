import { prismaMock } from '../../jest.setup'
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
  setCampaignTitle,
} from './characters'

const select = { id: true, name: true, gameUrl: true, campaignTitle: true }
const thorin = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
  campaignTitle: 'The Lonely Mountain',
}

describe('db/characters', () => {
  it("lists only the user's characters, by name", async () => {
    prismaMock.character.findMany.mockResolvedValue([thorin] as any)

    await expect(listCharacters('user-1')).resolves.toEqual([thorin])
    expect(prismaMock.character.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    })
  })

  it('gets a character only when the user owns it', async () => {
    prismaMock.character.findFirst.mockResolvedValue(thorin as any)

    await expect(getCharacter('user-1', 'char-1')).resolves.toEqual(thorin)
    expect(prismaMock.character.findFirst).toHaveBeenCalledWith({
      where: { id: 'char-1', userId: 'user-1' },
      select,
    })
  })

  it('creates a character for the user', async () => {
    prismaMock.character.create.mockResolvedValue(thorin as any)

    const input = {
      name: thorin.name,
      campaignTitle: thorin.campaignTitle,
      gameUrl: thorin.gameUrl,
    }
    await expect(createCharacter('user-1', input)).resolves.toEqual(thorin)
    expect(prismaMock.character.create).toHaveBeenCalledWith({
      data: { ...input, userId: 'user-1' },
      select,
    })
  })

  it("sets a character's campaign title only when the user owns it", async () => {
    prismaMock.character.updateMany.mockResolvedValue({ count: 1 })

    await expect(
      setCampaignTitle('user-1', 'char-1', 'The Lonely Mountain'),
    ).resolves.toBe(true)
    expect(prismaMock.character.updateMany).toHaveBeenCalledWith({
      where: { id: 'char-1', userId: 'user-1' },
      data: { campaignTitle: 'The Lonely Mountain' },
    })
  })

  it('reports when there was no character to give a campaign title', async () => {
    prismaMock.character.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      setCampaignTitle('user-1', 'someone-elses', 'The Lonely Mountain'),
    ).resolves.toBe(false)
  })

  it('deletes a character only when the user owns it', async () => {
    prismaMock.character.deleteMany.mockResolvedValue({ count: 1 })

    await expect(deleteCharacter('user-1', 'char-1')).resolves.toBe(true)
    expect(prismaMock.character.deleteMany).toHaveBeenCalledWith({
      where: { id: 'char-1', userId: 'user-1' },
    })
  })

  it('reports when there was nothing to delete', async () => {
    prismaMock.character.deleteMany.mockResolvedValue({ count: 0 })

    await expect(deleteCharacter('user-1', 'someone-elses')).resolves.toBe(
      false,
    )
  })
})
