/* eslint-disable unicorn/no-null -- what Prisma returns for an absent value */
import { prismaMock } from '../../jest.setup'
import {
  getGroupText,
  getSheetText,
  keepOnlySheetTexts,
  lacksSheetTexts,
  saveSheetTexts,
} from './sheet-texts'
import {
  fullerSheet,
  GROUP_TEXTS,
  groupSheet,
  TEXTS,
} from '@/mocks/sending-stone'
import { groupTextRefs, sheetTextRefs } from '@/utils/sheet-texts'
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

describe('db/sheet-texts, for groups (module 0.30.0)', () => {
  const company = { campaignId: 'c1', groupId: 'company' }

  it("keeps the descriptions of a campaign's characters' and its groups' sheets together", async () => {
    await keepOnlySheetTexts(
      prismaMock as any,
      'c1',
      [fullerSheet()],
      [groupSheet()],
    )

    const { hash } = prismaMock.sheetText.deleteMany.mock.calls[0][0]!
      .where as {
      hash: { notIn: string[] }
    }
    expect(hash.notIn.toSorted()).toEqual(
      [
        ...sheetTextRefs(fullerSheet()),
        ...groupTextRefs(groupSheet()),
      ].toSorted(),
    )
  })

  it("says whether a group's sheet refers to a description not held", async () => {
    prismaMock.sheetText.count.mockResolvedValue(4)
    await expect(
      lacksSheetTexts(prismaMock as any, 'c1', [], [groupSheet()]),
    ).resolves.toBe(false)

    prismaMock.sheetText.count.mockResolvedValue(3)
    await expect(
      lacksSheetTexts(prismaMock as any, 'c1', [], [groupSheet()]),
    ).resolves.toBe(true)
    expect(prismaMock.sheetText.count).toHaveBeenLastCalledWith({
      where: { campaignId: 'c1', hash: { in: groupTextRefs(groupSheet()) } },
    })
  })

  it("gives a description on the group's own sheet", async () => {
    prismaMock.groupSheet.findUnique.mockResolvedValue({
      data: groupSheet(),
    } as any)
    prismaMock.sheetText.findUnique.mockResolvedValue({
      html: '<p>Thirteen dwarves and a hobbit.</p>',
    } as any)

    await expect(getGroupText(company, GROUP_TEXTS.description)).resolves.toBe(
      '<p>Thirteen dwarves and a hobbit.</p>',
    )
    expect(prismaMock.groupSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignGroup: { campaignId: 'c1', actorId: 'company' } },
      select: { data: true },
    })
  })

  it("gives none its sheet doesn't refer to, nor any without a sheet", async () => {
    prismaMock.groupSheet.findUnique.mockResolvedValue({
      data: groupSheet(),
    } as any)

    await expect(
      getGroupText(company, TEXTS.secondWind),
    ).resolves.toBeUndefined()
    prismaMock.groupSheet.findUnique.mockResolvedValue(null)
    await expect(
      getGroupText(company, GROUP_TEXTS.description),
    ).resolves.toBeUndefined()
    expect(prismaMock.sheetText.findUnique).not.toHaveBeenCalled()
  })
})
