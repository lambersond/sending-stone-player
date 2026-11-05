import prisma from '@/clients/prisma'
import type { Tx } from '@/db/types'

/**
 * Clear a campaign's chat as it was held at `at` (v0.44): every message it held then goes, the
 * cookbook's dish cards with the rest, and the campaign keeps when, so that a later change to one
 * brings nothing back (`postedBeforeClear`). A message that lands meanwhile stays.
 */
export async function clearChat(
  tx: Tx,
  campaignId: string,
  at: Date,
): Promise<void> {
  await tx.chatMessage.deleteMany({
    where: { campaignId, createdAt: { lte: at } },
  })
  await tx.campaign.update({
    where: { id: campaignId },
    data: { chatClearedAt: at },
  })
}

/**
 * Clear one of the Gamemaster's campaigns' chat in the app, for every player (v0.44); Foundry's own
 * chat log stays as it is. Another Gamemaster's id clears nothing. The version is bumped, so every
 * table sees the chat empty within a poll.
 *
 * The chat's rows are locked before the campaign's, the order every Foundry event takes them in
 * (applyCampaignEvent), so a clear that meets a chat event waits for it rather than deadlocking.
 * The owner's check is a plain read for that reason: a campaign's owner never changes.
 * @returns Whether the Gamemaster had a campaign with that id to clear.
 */
export async function clearCampaignChat(
  userId: string,
  campaignId: string,
): Promise<boolean> {
  const at = new Date()
  return prisma.$transaction(async tx => {
    const owned = await tx.campaign.count({
      where: { id: campaignId, ownerId: userId },
    })
    if (owned === 0) return false
    await clearChat(tx, campaignId, at)
    await tx.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    })
    return true
  })
}
