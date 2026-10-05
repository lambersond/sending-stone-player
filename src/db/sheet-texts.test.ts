/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { prismaMock } from '../../jest.setup'
import { getSheetText } from './sheet-texts'
import { fullerSheet, TEXTS } from '@/mocks/sending-stone'
import type { Character } from '@/types/character'

const character = {
  id: 'char-1',
  name: 'Thorin',
  campaignId: 'c1',
  actorId: 'actor-thorin',
} as Character

describe('db/sheet-texts', () => {
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
