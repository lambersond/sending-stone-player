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
      prismaMock.campaign.updateMany.mockResolvedValue({ count: 1 })

      await expect(clearCampaignChat('gm-1', 'c1')).resolves.toBe(true)

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
      expect(prismaMock.campaign.updateMany).toHaveBeenCalledWith({
        where: { id: 'c1', ownerId: 'gm-1' },
        data: { version: { increment: 1 } },
      })
      expect(prismaMock.chatMessage.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', createdAt: { lte: NOW } },
      })
      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { chatClearedAt: NOW },
      })
    })

    it("clears nothing of another Gamemaster's campaign", async () => {
      prismaMock.campaign.updateMany.mockResolvedValue({ count: 0 })

      await expect(clearCampaignChat('gm-2', 'c1')).resolves.toBe(false)

      expect(prismaMock.chatMessage.deleteMany).not.toHaveBeenCalled()
      expect(prismaMock.campaign.update).not.toHaveBeenCalled()
    })
  })
})
