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
 * chat log stays as it is. Its version is bumped with the owner's check, so every table sees the
 * chat empty within a poll, and another Gamemaster's id clears nothing.
 * @returns Whether the Gamemaster had a campaign with that id to clear.
 */
export async function clearCampaignChat(
  userId: string,
  campaignId: string,
): Promise<boolean> {
  const at = new Date()
  return prisma.$transaction(async tx => {
    const { count } = await tx.campaign.updateMany({
      where: { id: campaignId, ownerId: userId },
      data: { version: { increment: 1 } },
    })
    if (count === 0) return false
    await clearChat(tx, campaignId, at)
    return true
  })
}
