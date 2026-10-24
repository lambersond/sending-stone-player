import prisma from '@/clients/prisma'
import { sanitizeSheetHtml } from '@/lib/sheet-html'
import { groupTextRefs, sheetTextRefs } from '@/utils/sheet-texts'
import type { Character } from '@/types/character'
import type { AllowedGroup, GroupSheet } from '@/types/party'
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
 * What a campaign's characters' sheets and its groups' sheets refer to, together; and from module
 * 0.36.0 its characters' companions' sheets, which are a character's in shape.
 */
function refsOf(
  sheets: CharacterSheet[],
  groups: GroupSheet[],
  companions: CharacterSheet[],
): string[] {
  return [
    ...new Set([
      ...sheets.flatMap(sheet => sheetTextRefs(sheet)),
      ...groups.flatMap(group => groupTextRefs(group)),
      ...companions.flatMap(sheet => sheetTextRefs(sheet)),
    ]),
  ]
}

/**
 * Drop the campaign's descriptions that none of these sheets refers to, its characters', its
 * groups' or its companions': for a hello, which carries all of a campaign's sheets, or keeps
 * those held.
 */
export async function keepOnlySheetTexts(
  tx: Tx,
  campaignId: string,
  sheets: CharacterSheet[],
  groups: GroupSheet[] = [],
  companions: CharacterSheet[] = [],
): Promise<void> {
  const refs = refsOf(sheets, groups, companions)
  await tx.sheetText.deleteMany({
    where: { campaignId, hash: { notIn: refs } },
  })
}

/**
 * Whether the campaign lacks any description these sheets refer to, its characters', its groups'
 * or its companions', which means one went missing on its way, since each is sent before the
 * sheet that refers to it.
 */
export async function lacksSheetTexts(
  tx: Tx,
  campaignId: string,
  sheets: CharacterSheet[],
  groups: GroupSheet[] = [],
  companions: CharacterSheet[] = [],
): Promise<boolean> {
  const refs = refsOf(sheets, groups, companions)
  if (refs.length === 0) return false
  const held = await tx.sheetText.count({
    where: { campaignId, hash: { in: refs } },
  })
  return held < refs.length
}

/**
 * A description on a character's own sheet, for whoever is at it: its player, or its campaign's
 * Gamemaster (#156). Undefined unless the character's sheet refers to it and the campaign holds it.
 * @param character - The seat at the sheet, resolved for the signed-in user.
 * @param hash - The description's hash.
 */
export async function getSheetText(
  character: Pick<Character, 'campaignId' | 'actorId'>,
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

/**
 * A description on a group's sheet (module 0.30.0), for a seat the access check let see the group.
 * Undefined unless that group's own sheet refers to it and the campaign holds it: never one only
 * a character's sheet, or another group's, refers to.
 * @param group - The group, as the access check allowed it.
 * @param hash - The description's hash.
 */
export async function getGroupText(
  group: AllowedGroup,
  hash: string,
): Promise<string | undefined> {
  const sheet = await prisma.groupSheet.findUnique({
    where: {
      campaignGroup: { campaignId: group.campaignId, actorId: group.groupId },
    },
    select: { data: true },
  })
  const refs = sheet ? groupTextRefs(sheet.data as unknown as GroupSheet) : []
  if (!refs.includes(hash)) return undefined
  const text = await prisma.sheetText.findUnique({
    where: { campaignHash: { campaignId: group.campaignId, hash } },
    select: { html: true },
  })
  return text?.html
}
