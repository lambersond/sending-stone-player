import { prismaMock } from '../../jest.setup'
import {
  createCharacter,
  deleteCharacter,
  getCharacter,
  listCharacters,
} from './characters'

const select = { id: true, name: true, gameUrl: true }
const thorin = {
  id: 'char-1',
  name: 'Thorin',
  gameUrl: 'https://my-game.forge-vtt.com',
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

    await expect(
      createCharacter('user-1', { name: thorin.name, gameUrl: thorin.gameUrl }),
    ).resolves.toEqual(thorin)
    expect(prismaMock.character.create).toHaveBeenCalledWith({
      data: { name: thorin.name, gameUrl: thorin.gameUrl, userId: 'user-1' },
      select,
    })
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
