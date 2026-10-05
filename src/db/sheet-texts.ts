import prisma from '@/clients/prisma'
import { sanitizeSheetHtml } from '@/lib/sheet-html'
import { sheetTextRefs } from '@/utils/sheet-texts'
import type { Character } from '@/types/character'
import type { CharacterSheet } from '@/types/sending-stone'
import type { Prisma } from '@prisma/client'

// The descriptions a campaign's sheets refer to by hash. The module sends each before the sheet
// that refers to it, and the same hash always names the same description.

type Tx = Prisma.TransactionClient

/**
 * Keep descriptions for a campaign, sanitised, with images and links pointing at its game.
 * @param tx - The transaction applying the event.
 * @param campaignId - The campaign they are for.
 * @param texts - HTML by hash, as the module sent it.
 */
export async function saveSheetTexts(
  tx: Tx,
  campaignId: string,
  texts: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(texts)
  if (entries.length === 0) return
  const campaign = await tx.campaign.findUnique({
    where: { id: campaignId },
    select: { origin: true },
  })
  if (!campaign) return
  for (const [hash, html] of entries) {
    const clean = sanitizeSheetHtml(html, campaign.origin)
    await tx.sheetText.upsert({
      where: { campaignHash: { campaignId, hash } },
      create: { campaignId, hash, html: clean },
      update: { html: clean },
    })
  }
}

/**
 * Drop the campaign's descriptions that none of these sheets refers to: for a hello, which
 * carries all of a campaign's sheets.
 */
export async function keepOnlySheetTexts(
  tx: Tx,
  campaignId: string,
  sheets: CharacterSheet[],
): Promise<void> {
  const refs = sheets.flatMap(sheet => sheetTextRefs(sheet))
  await tx.sheetText.deleteMany({
    where: { campaignId, hash: { notIn: refs } },
  })
}

/**
 * Whether the campaign lacks any description these sheets refer to, which means one went
 * missing on its way, since each is sent before the sheet that refers to it.
 */
export async function lacksSheetTexts(
  tx: Tx,
  campaignId: string,
  sheets: CharacterSheet[],
): Promise<boolean> {
  const refs = [...new Set(sheets.flatMap(sheet => sheetTextRefs(sheet)))]
  if (refs.length === 0) return false
  const held = await tx.sheetText.count({
    where: { campaignId, hash: { in: refs } },
  })
  return held < refs.length
}

/**
 * A description on a character's own sheet, for its player. Undefined unless the character's
 * sheet refers to it and the campaign holds it.
 * @param character - A character of the signed-in user.
 * @param hash - The description's hash.
 */
export async function getSheetText(
  character: Character,
  hash: string,
): Promise<string | undefined> {
  if (!character.campaignId || !character.actorId) return undefined
  const sheet = await prisma.actorSheet.findUnique({
    where: {
      campaignActor: {
        campaignId: character.campaignId,
        actorId: character.actorId,
      },
    },
    select: { data: true },
  })
  const refs = sheet
    ? sheetTextRefs(sheet.data as unknown as CharacterSheet)
    : []
  if (!refs.includes(hash)) return undefined
  const text = await prisma.sheetText.findUnique({
    where: { campaignHash: { campaignId: character.campaignId, hash } },
    select: { html: true },
  })
  return text?.html
}
