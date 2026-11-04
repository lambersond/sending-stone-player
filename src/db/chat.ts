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
