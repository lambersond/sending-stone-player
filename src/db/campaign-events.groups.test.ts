/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import { applyCampaignEvent } from './campaign-events'
import {
  combat,
  fullerSheet,
  GROUP_TEXTS,
  groupEntry,
  groupSheet,
  roster,
} from '@/mocks/sending-stone'
import { parseGameEvent } from '@/schemas/sending-stone'
import { groupTextRefs, sheetTextRefs } from '@/utils/sheet-texts'
import type { GameEvent } from '@/types/sending-stone'

// A campaign's Group actors, as module 0.30.0 sends them: listed in its hello, each sheet kept
// apart from the characters', and its descriptions kept while any sheet refers to them.

const world = { id: 'erebor', title: 'Return to Erebor' }
const campaign = { id: 'camp-a', title: 'The Lonely Mountain' }

const apply = (type: string, data: unknown) =>
  applyCampaignEvent(
    'c1',
    world,
    campaign,
    parseGameEvent(type, data) as GameEvent,
    'session-1',
    '2026-10-19T12:00:00.000Z',
  )

const hello = (groups?: unknown[]) =>
  apply('bridge.hello', {
    sheetsApart: true,
    characters: roster,
    combats: [combat()],
    ...(groups && { groups }),
  })

const scouts = groupEntry({ id: 'scouts', name: 'Scouts', primary: false })

/** What the roster was last saved as. */
const savedGroups = () =>
  prismaMock.campaign.update.mock.calls
    .map(([{ data }]) => data.groups)
    .find(groups => groups !== undefined)

describe('db/campaign-events, groups (module 0.30.0)', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockImplementation((run: any) => run(prismaMock))
    prismaMock.actorSheet.findMany.mockResolvedValue([])
    prismaMock.groupSheet.findMany.mockResolvedValue([])
  })

  describe('bridge.hello', () => {
    it('keeps its groups, without their sheets, and drops the sheets of those it no longer lists', async () => {
      await hello([groupEntry(), scouts])

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({
          characters: roster,
          groups: [groupEntry(), scouts],
        }),
      })
      expect(prismaMock.groupSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: { notIn: ['company', 'scouts'] } },
      })
      expect(prismaMock.groupSheet.createMany).not.toHaveBeenCalled()
    })

    it('from an older module, keeps no group, and drops every group sheet', async () => {
      await hello()

      expect(savedGroups()).toEqual([])
      expect(prismaMock.groupSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: { notIn: [] } },
      })
    })

    it("keeps the descriptions of the group sheets it keeps, beside the characters'", async () => {
      prismaMock.actorSheet.findMany.mockResolvedValue([
        { data: fullerSheet() },
      ] as any)
      prismaMock.groupSheet.findMany.mockResolvedValue([
        { data: groupSheet() },
      ] as any)

      await expect(hello([groupEntry()])).resolves.toEqual({
        lacksTexts: false,
      })

      expect(prismaMock.groupSheet.findMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1' },
        select: { data: true },
      })
      const { hash } = prismaMock.sheetText.deleteMany.mock.calls[0][0]!
        .where as { hash: { notIn: string[] } }
      expect(hash.notIn.toSorted()).toEqual(
        [
          ...new Set([
            ...sheetTextRefs(fullerSheet()),
            ...groupTextRefs(groupSheet()),
          ]),
        ].toSorted(),
      )
      expect(hash.notIn).toEqual(
        expect.arrayContaining(Object.values(GROUP_TEXTS)),
      )
    })

    it('from a module before 0.22.0, whose sheets come in it, drops every group sheet too', async () => {
      prismaMock.sheetText.count.mockResolvedValue(0)

      await apply('bridge.hello', { characters: roster, combats: [] })

      expect(prismaMock.groupSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: { notIn: [] } },
      })
    })
  })

  describe('group.updated', () => {
    it('adds the group to the roster and keeps its sheet apart, bumping the version', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({ groups: [] } as any)
      prismaMock.sheetText.count.mockResolvedValue(4)

      await expect(
        apply('group.updated', {
          group: { ...groupEntry(), sheet: groupSheet() },
        }),
      ).resolves.toEqual({ lacksTexts: false })

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { groups: [groupEntry()] },
      })
      expect(prismaMock.groupSheet.upsert).toHaveBeenCalledWith({
        where: { campaignGroup: { campaignId: 'c1', actorId: 'company' } },
        create: { campaignId: 'c1', actorId: 'company', data: groupSheet() },
        update: { data: groupSheet() },
      })
      expect(prismaMock.actorSheet.upsert).not.toHaveBeenCalled()
      expect(prismaMock.campaign.update).toHaveBeenLastCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    })

    it('replaces its entry in place, keeping why its sheet was held back until an update without it', async () => {
      const tooLarge = {
        reason: 'tooLarge',
        bytes: 5_200_000,
        limit: 4_000_000,
      }
      prismaMock.campaign.findUnique.mockResolvedValue({
        groups: [scouts, groupEntry()],
      } as any)

      await apply('group.updated', {
        group: {
          ...groupEntry({ name: 'The Company of Thorin' }),
          sheet: null,
          sheetWithheld: tooLarge,
        },
      })

      expect(savedGroups()).toEqual([
        scouts,
        {
          ...groupEntry({ name: 'The Company of Thorin' }),
          sheetWithheld: tooLarge,
        },
      ])
      expect(prismaMock.groupSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: 'company' },
      })
      expect(prismaMock.groupSheet.upsert).not.toHaveBeenCalled()

      prismaMock.campaign.findUnique.mockResolvedValue({
        groups: [scouts, { ...groupEntry(), sheetWithheld: tooLarge }],
      } as any)
      prismaMock.campaign.update.mockClear()
      prismaMock.sheetText.count.mockResolvedValue(4)

      await apply('group.updated', {
        group: { ...groupEntry(), sheet: groupSheet() },
      })

      expect(savedGroups()).toEqual([scouts, groupEntry()])
    })

    it('says whether its sheet refers to a description not held, for the hello to be sent again', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({ groups: [] } as any)
      prismaMock.sheetText.count.mockResolvedValue(3)

      await expect(
        apply('group.updated', {
          group: { ...groupEntry(), sheet: groupSheet() },
        }),
      ).resolves.toEqual({ lacksTexts: true })

      expect(prismaMock.sheetText.count).toHaveBeenCalledWith({
        where: {
          campaignId: 'c1',
          hash: { in: groupTextRefs(groupSheet()) },
        },
      })
    })

    it('without a sheet, lacks no description', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({ groups: [] } as any)

      await expect(
        apply('group.updated', {
          group: {
            ...groupEntry({ access: {} }),
            sheet: null,
            sheetWithheld: { reason: 'private' },
          },
        }),
      ).resolves.toEqual({ lacksTexts: false })

      expect(prismaMock.sheetText.count).not.toHaveBeenCalled()
    })
  })

  describe('group.removed', () => {
    it('drops the group from the roster, with its sheet, bumping the version', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        groups: [groupEntry(), scouts],
      } as any)

      await apply('group.removed', { id: 'company' })

      expect(prismaMock.campaign.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { groups: [scouts] },
      })
      expect(prismaMock.groupSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: 'company' },
      })
      expect(prismaMock.campaign.update).toHaveBeenLastCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({ version: { increment: 1 } }),
      })
    })

    it('leaves a roster without it as it is', async () => {
      prismaMock.campaign.findUnique.mockResolvedValue({
        groups: [scouts],
      } as any)

      await apply('group.removed', { id: 'company' })

      expect(prismaMock.campaign.update).toHaveBeenCalledTimes(1)
      expect(prismaMock.groupSheet.deleteMany).toHaveBeenCalledWith({
        where: { campaignId: 'c1', actorId: 'company' },
      })
    })
  })
})
