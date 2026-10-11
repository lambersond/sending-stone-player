/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { prismaMock } from '../../jest.setup'
import { getSheetText, saveSheetTexts } from './sheet-texts'
import { fullerSheet, TEXTS } from '@/mocks/sending-stone'
import type { Character } from '@/types/character'

const character = {
  id: 'char-1',
  name: 'Thorin',
  campaignId: 'c1',
  actorId: 'actor-thorin',
} as Character

describe('db/sheet-texts', () => {
  describe('saveSheetTexts', () => {
    it('replaces what it holds of a description sent again, kept anew, as every hello sends them all', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        origin: 'https://foundry.example',
      } as any)
      // What a critical hit adds, which an app before kept none of, held now.
      const span =
        '<span class="ss-damage roll" data-n="0" data-formulas="1d12 + 4" data-critical="false" data-critical-dice="1" data-critical-damage="1d6">1d12 + 4</span>'

      await saveSheetTexts(prismaMock as any, 'c1', {
        [TEXTS.secondWind]: `<p>It deals ${span}<script>alert(1)</script>.</p>`,
      })

      const html = `<p>It deals ${span}.</p>`
      expect(prismaMock.sheetText.upsert).toHaveBeenCalledWith({
        where: { campaignHash: { campaignId: 'c1', hash: TEXTS.secondWind } },
        create: { campaignId: 'c1', hash: TEXTS.secondWind, html },
        update: { html },
      })
    })
  })

  describe('getSheetText', () => {
    it("gives a description on the character's own sheet", async () => {
      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: fullerSheet(),
      } as any)
      prismaMock.sheetText.findUnique.mockResolvedValue({
        html: '<p>Regain hit points.</p>',
      } as any)

      await expect(getSheetText(character, TEXTS.secondWind)).resolves.toBe(
        '<p>Regain hit points.</p>',
      )
      expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignActor: { campaignId: 'c1', actorId: 'actor-thorin' } },
        select: { data: true },
      })
      expect(prismaMock.sheetText.findUnique).toHaveBeenCalledWith({
        where: { campaignHash: { campaignId: 'c1', hash: TEXTS.secondWind } },
        select: { html: true },
      })
    })

    it("refuses one its sheet doesn't refer to, such as another character's", async () => {
      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: fullerSheet(),
      } as any)

      await expect(
        getSheetText(character, 'ffffffffffffff'),
      ).resolves.toBeUndefined()
      expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
    })

    it('has none without a sheet, a campaign, or the description itself', async () => {
      prismaMock.actorSheet.findUnique.mockResolvedValue(null)
      await expect(
        getSheetText(character, TEXTS.secondWind),
      ).resolves.toBeUndefined()

      await expect(
        getSheetText({ ...character, campaignId: null }, TEXTS.secondWind),
      ).resolves.toBeUndefined()

      prismaMock.actorSheet.findUnique.mockResolvedValue({
        data: fullerSheet(),
      } as any)
      prismaMock.sheetText.findUnique.mockResolvedValue(null)
      await expect(
        getSheetText(character, TEXTS.secondWind),
      ).resolves.toBeUndefined()
    })
  })
})
