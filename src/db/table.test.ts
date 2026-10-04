/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { getGameVersion, getTableView, MESSAGE_LIMIT } from './table'
import { chatMessage, combat, roster } from '@/mocks/sending-stone'

const character = {
  id: 'char-1',
  name: 'Thorin Oakenshield',
  gameUrl: 'https://my-game.forge-vtt.com',
}
const game = {
  id: 'g1',
  version: 7,
  worldTitle: 'Return to Erebor',
  lastEventAt: new Date('2026-10-04T19:10:00Z'),
  characters: roster,
}

describe('db/table', () => {
  describe('getGameVersion', () => {
    it("reads the game's version", async () => {
      prismaMock.game.findUnique.mockResolvedValue({ version: 7 } as any)

      await expect(getGameVersion(character.gameUrl)).resolves.toBe(7)
      expect(prismaMock.game.findUnique).toHaveBeenCalledWith({
        where: { origin: character.gameUrl },
        select: { version: true },
      })
    })

    it('is 0 for a game that has sent nothing', async () => {
      prismaMock.game.findUnique.mockResolvedValue(null)

      await expect(getGameVersion(character.gameUrl)).resolves.toBe(0)
    })
  })

  describe('getTableView', () => {
    it('is empty until the game has sent anything', async () => {
      prismaMock.game.findUnique.mockResolvedValue(null)

      await expect(getTableView(character)).resolves.toEqual({
        version: 0,
        connected: false,
        messages: [],
      })
    })

    it('shows the chat the player may read, oldest first, and the encounter', async () => {
      prismaMock.game.findUnique.mockResolvedValue(game as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([
        { data: chatMessage({ id: 'm2', text: 'second' }) },
        { data: chatMessage({ id: 'm1', text: 'first' }) },
      ] as any)
      prismaMock.combat.findMany.mockResolvedValue([
        { data: combat({ id: 'old', active: false }) },
        { data: combat() },
      ] as any)

      const view = await getTableView(character)

      expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith({
        where: {
          gameId: 'g1',
          OR: [{ public: true }, { readers: { has: 'actor-thorin' } }],
        },
        orderBy: { sentAt: 'desc' },
        take: MESSAGE_LIMIT,
        select: { data: true },
      })
      expect(view).toMatchObject({
        version: 7,
        game: {
          worldTitle: 'Return to Erebor',
          lastEventAt: '2026-10-04T19:10:00.000Z',
        },
        connected: true,
        messages: [{ id: 'm1' }, { id: 'm2' }],
        combat: { id: 'cmbt1', currentId: 'c-boss' },
      })
    })

    it('shows only public chat to a character that is not connected', async () => {
      prismaMock.game.findUnique.mockResolvedValue({
        ...game,
        worldTitle: null,
        lastEventAt: null,
      } as any)
      prismaMock.chatMessage.findMany.mockResolvedValue([])
      prismaMock.combat.findMany.mockResolvedValue([])

      const view = await getTableView({ ...character, name: 'Bilbo' })

      expect(prismaMock.chatMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { gameId: 'g1', OR: [{ public: true }] },
        }),
      )
      expect(view).toEqual({
        version: 7,
        game: { worldTitle: undefined, lastEventAt: undefined },
        connected: false,
        messages: [],
        combat: undefined,
      })
    })
  })
})
