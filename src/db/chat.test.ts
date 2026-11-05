/**
 * @jest-environment node
 */
import { clearCampaignChat } from './chat'
import { prismaMock } from '@/utils/test-utils-node'

const NOW = new Date('2026-11-04T20:00:00.000Z')

describe('db/chat', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW })
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('clearCampaignChat (v0.44 item 8)', () => {
    it("clears the Gamemaster's own campaign's chat as held now, in one transaction, marking when and bumping its version", async () => {
      prismaMock.campaign.count.mockResolvedValue(1)

      await expect(clearCampaignChat('gm-1', 'c1')).resolves.toBe(true)

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
      expect(prismaMock.campaign.count).toHaveBeenCalledWith({
        where: { id: 'c1', ownerId: 'gm-1' },
      })
      expect(prismaMock.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', createdAt: { lte: NOW } },
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { chatClearedAt: NOW },
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { version: { increment: 1 } },
      })
    })

    it("locks the chat's rows before the campaign's, as Foundry's events do, so a clear meeting one can't deadlock", async () => {
      prismaMock.campaign.count.mockResolvedValue(1)

      await clearCampaignChat('gm-1', 'c1')

      const [deleted] =
        prismaMock.chatMessage.deleteMany.mock.invocationCallOrder
      const updates = prismaMock.campaign.update.mock.invocationCallOrder
      expect(updates.length).toBeGreaterThan(0)
      expect(updates.every(order => order > deleted)).toBe(true)
      expect(prismaMock.campaign.updateMany).not.toHaveBeenCalled()
    })

    it("clears nothing of another Gamemaster's campaign", async () => {
      prismaMock.campaign.count.mockResolvedValue(0)

      await expect(clearCampaignChat('gm-2', 'c1')).resolves.toBe(false)

      expect(prismaMock.chatMessage.deleteMany).not.toHaveBeenCalled()
      expect(prismaMock.campaign.update).not.toHaveBeenCalled()
    })
  })
})
