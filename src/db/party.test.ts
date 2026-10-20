/* eslint-disable unicorn/no-null -- protocol payloads use null for an absent value */
import { prismaMock } from '../../jest.setup'
import {
  allowedGroup,
  getGroupView,
  getPartyStatus,
  groupRoster,
  partySeat,
  tableGroups,
  type PartySeat,
} from './party'
import { playerSeat } from './seats'
import { getTableView } from './table'
import {
  GROUP_TEXTS,
  groupEntry,
  groupSheet,
  PARTY,
} from '@/mocks/sending-stone'
import { inventoryView } from '@/utils/table-view'
import type { SheetSeat } from '@/types/character'

const ORIGIN = 'https://my-game.forge-vtt.com'
const UPDATED = new Date('2026-10-19T12:00:00.000Z')

/** A player at their character in the campaign, whose actor is this one. */
const player = (actorId: string | null = PARTY.thorin): PartySeat => ({
  role: 'player',
  campaignId: 'c1',
  actorId,
  characterId: 'char-1',
  name: 'Thorin Oakenshield',
})
const gm = (userId = 'gm-1'): PartySeat => ({
  role: 'gm',
  campaignId: 'c1',
  userId,
})

const scouts = groupEntry({
  id: 'scouts',
  name: 'Scouts',
  primary: false,
  img: null,
  access: { [PARTY.vex]: 'owner' },
})
const hidden = groupEntry({
  id: 'hidden',
  name: 'The Hidden Hand',
  primary: false,
  access: {},
})

/** The campaign as held: its groups, and its owner. */
const held = (fields: object = {}) =>
  prismaMock.campaign.findUnique.mockResolvedValue({
    id: 'c1',
    title: 'The Lonely Mountain',
    origin: ORIGIN,
    version: 7,
    lastSeenAt: new Date(Date.now() - 30_000),
    ownerId: 'gm-1',
    groups: [scouts, groupEntry(), hidden],
    transferFeatures: [],
    ...fields,
  } as any)

/** The Company's sheet as held. */
const sheetHeld = (data: unknown = groupSheet()) =>
  prismaMock.groupSheet.findUnique.mockResolvedValue({
    data,
    updatedAt: UPDATED,
  } as any)

/** A seat at a character's sheet in the campaign, of this actor. */
const seat = (role: 'player' | 'gm', actorId: string): SheetSeat => ({
  name: 'Vex',
  gameUrl: ORIGIN,
  campaignTitle: 'The Lonely Mountain',
  campaignId: 'c1',
  actorId,
  role,
  userId: 'user-1',
  characterId: role === 'gm' ? null : 'char-2',
})

/**
 * The seat's table view of the campaign, its Gamemaster's columns set, and nothing else in it: no
 * chat, combat or sheet.
 */
const viewOf = async (at: SheetSeat) => {
  held({
    characters: [],
    foundry: { settings: { attackRollVisibility: 'all' } },
  })
  prismaMock.chatMessage.findMany.mockResolvedValue([])
  prismaMock.combat.findMany.mockResolvedValue([])
  prismaMock.actorSheet.findUnique.mockResolvedValue(null)
  prismaMock.rollRequest.findMany.mockResolvedValue([])
  return getTableView(at)
}

describe('db/party', () => {
  beforeEach(() => {
    held()
    sheetHeld()
  })

  describe('who may see a party sheet', () => {
    it.each([
      ['owns', PARTY.thorin],
      ['observes', PARTY.vex],
    ])(
      'lets a player whose Foundry user %s the group see it',
      async (_, actor) => {
        await expect(getPartyStatus(player(actor), 'company')).resolves.toEqual(
          {
            version: 7,
            live: true,
            moves: false,
          },
        )
        await expect(allowedGroup(player(actor), 'company')).resolves.toEqual({
          campaignId: 'c1',
          groupId: 'company',
        })
        await expect(getGroupView(player(actor), 'company')).resolves.toEqual(
          expect.objectContaining({
            group: expect.objectContaining({ id: 'company' }),
          }),
        )
      },
    )

    it('lets no player see it with Limited or less, which leaves them out of its access', async () => {
      // Balin's player has Limited on it, as other players' entries show.
      await expect(
        getPartyStatus(player(PARTY.balin), 'company'),
      ).resolves.toBeUndefined()
      await expect(
        getGroupView(player(PARTY.balin), 'company'),
      ).resolves.toBeUndefined()
      await expect(
        allowedGroup(player(PARTY.balin), 'company'),
      ).resolves.toBeUndefined()
    })

    it('lets a character not yet chosen, or in no campaign, see nothing', async () => {
      await expect(
        getGroupView(player(null), 'company'),
      ).resolves.toBeUndefined()
      await expect(
        getGroupView(
          {
            ...(player() as Extract<PartySeat, { role: 'player' }>),
            campaignId: null,
          },
          'company',
        ),
      ).resolves.toBeUndefined()
      expect(prismaMock.campaign.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: null } }),
      )
    })

    it("sees nothing of another campaign's group, nor one that isn't there", async () => {
      await expect(getGroupView(player(), 'elsewhere')).resolves.toBeUndefined()
      await expect(
        getGroupView(player(), '../company'),
      ).resolves.toBeUndefined()
      prismaMock.campaign.findUnique.mockResolvedValue(null)
      await expect(getGroupView(player(), 'company')).resolves.toBeUndefined()
      await expect(getGroupView(gm(), 'company')).resolves.toBeUndefined()
    })

    it("asks only for the campaign's own columns, never its Gamemaster's", async () => {
      await getGroupView(player(), 'company')

      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: {
          id: true,
          title: true,
          origin: true,
          version: true,
          lastSeenAt: true,
          ownerId: true,
          groups: true,
          transfersEnabled: true,
          transferFeatures: true,
          bridgePolledAt: true,
        },
      })
    })

    it("lets the campaign's Gamemaster see every group, one no player may see marked so", async () => {
      await expect(getGroupView(gm(), 'company')).resolves.not.toHaveProperty(
        'private',
      )
      await expect(getGroupView(gm(), 'hidden')).resolves.toEqual(
        expect.objectContaining({ private: true }),
      )
      await expect(getPartyStatus(gm(), 'hidden')).resolves.toEqual({
        version: 7,
        live: true,
        moves: false,
      })
    })

    it('lets another Gamemaster see nothing', async () => {
      await expect(getGroupView(gm('gm-2'), 'company')).resolves.toBeUndefined()
      await expect(
        getPartyStatus(gm('gm-2'), 'company'),
      ).resolves.toBeUndefined()
      await expect(getGroupView(gm(''), 'company')).resolves.toBeUndefined()
      held({ ownerId: null })
      await expect(getGroupView(gm(''), 'company')).resolves.toBeUndefined()
    })

    it('tells a player whose access was taken away mid-session nothing, rather than that nothing changed', async () => {
      await expect(
        getPartyStatus(player(PARTY.vex), 'company'),
      ).resolves.toEqual({
        version: 7,
        live: true,
        moves: false,
      })
      // group.updated took Vex's player's Observer away.
      held({
        version: 8,
        groups: [groupEntry({ access: { [PARTY.thorin]: 'owner' } })],
      })

      await expect(
        getPartyStatus(player(PARTY.vex), 'company'),
      ).resolves.toBeUndefined()
      await expect(
        getGroupView(player(PARTY.vex), 'company'),
      ).resolves.toBeUndefined()
    })

    it('reads a level it doesn’t know, or a roster it can’t read, as no access', async () => {
      held({
        groups: [groupEntry({ access: { [PARTY.thorin]: 'limited' as any } })],
      })
      await expect(getGroupView(player(), 'company')).resolves.toBeUndefined()
      held({
        groups: [groupEntry({ access: { constructor: 'owner' as const } })],
      })
      await expect(
        getGroupView(player('toString'), 'company'),
      ).resolves.toBeUndefined()
      held({ groups: 'company' })
      await expect(getGroupView(gm(), 'company')).resolves.toBeUndefined()
      expect(groupRoster([null, groupEntry(), { name: 'x' }])).toEqual([
        groupEntry(),
      ])
    })

    it("takes a seat at a character's sheet as the same seat at its party sheets", () => {
      const sheetSeat = playerSeat(
        {
          id: 'char-1',
          name: 'Thorin Oakenshield',
          gameUrl: ORIGIN,
          campaignTitle: 'The Lonely Mountain',
          campaignId: 'c1',
          actorId: PARTY.thorin,
        },
        'user-1',
      )
      expect(partySeat(sheetSeat)).toEqual(player())
      expect(
        partySeat({
          ...sheetSeat,
          role: 'gm',
          characterId: null,
          userId: 'gm-1',
        }),
      ).toEqual(gm())
    })
  })

  describe('getGroupView', () => {
    it('shows the members by name and portrait only, the player’s own marked, its stash and its description', async () => {
      const view = await getGroupView(player(), 'company')

      expect(view).toEqual({
        version: 7,
        live: true,
        campaign: { title: 'The Lonely Mountain' },
        group: {
          id: 'company',
          name: 'The Company',
          portrait: `${ORIGIN}/worlds/erebor/company.webp`,
          primary: true,
        },
        sheet: {
          members: [
            {
              id: PARTY.thorin,
              name: 'Thorin Oakenshield',
              portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
              own: true,
            },
            { id: PARTY.vex, name: 'Vex' },
            // Foundry's placeholder is no portrait.
            { id: 'myrtle', name: 'Myrtle' },
          ],
          inventory: inventoryView(groupSheet().inventory, ORIGIN),
          description: GROUP_TEXTS.description,
        },
        sheetVersion: UPDATED.toISOString(),
      })
      expect(view?.sheet?.inventory.sections[0].items[0].img).toBe(
        `${ORIGIN}/icons/sundries/documents/map.webp`,
      )
      // Nothing else of a member, for anyone, and never who may see the group.
      for (const member of view?.sheet?.members ?? []) {
        expect(
          Object.keys(member).every(key =>
            ['id', 'name', 'portrait', 'own'].includes(key),
          ),
        ).toBe(true)
      }
      expect(JSON.stringify(view)).not.toMatch(/access/)
    })

    it("marks no member as the Gamemaster's own", async () => {
      const view = await getGroupView(gm(), 'company')

      expect(view?.sheet?.members.some(member => 'own' in member)).toBe(false)
    })

    it('shows its summary where it has no full description, and none where it has neither', async () => {
      sheetHeld({
        ...groupSheet(),
        description: { full: null, summary: GROUP_TEXTS.summary },
      })
      await expect(getGroupView(player(), 'company')).resolves.toHaveProperty(
        'sheet.description',
        GROUP_TEXTS.summary,
      )
      sheetHeld({ ...groupSheet(), description: { full: null, summary: null } })
      await expect(getGroupView(player(), 'company')).resolves.toHaveProperty(
        'sheet.description',
        null,
      )
    })

    it('leaves out a sheet the viewer has already, keeping its version', async () => {
      const view = await getGroupView(player(), 'company', {
        sheetVersion: UPDATED.toISOString(),
      })

      expect(view).not.toHaveProperty('sheet')
      expect(view?.sheetVersion).toBe(UPDATED.toISOString())
      expect(prismaMock.groupSheet.findUnique).toHaveBeenCalledWith({
        where: { campaignGroup: { campaignId: 'c1', actorId: 'company' } },
        select: { data: true, updatedAt: true },
      })
    })

    it('says why a sheet was held back for its size, and of none, nothing', async () => {
      prismaMock.groupSheet.findUnique.mockResolvedValue(null)
      held({
        groups: [
          groupEntry({
            sheetWithheld: {
              reason: 'tooLarge',
              bytes: 5_200_000,
              limit: 4_000_000,
            },
          }),
          groupEntry({
            id: 'unread',
            sheetWithheld: { reason: 'tooLarge', bytes: null, limit: null },
          }),
        ],
      })

      const view = await getGroupView(player(), 'company')
      expect(view).toEqual(
        expect.objectContaining({
          withheld: { reason: 'tooLarge', bytes: 5_200_000, limit: 4_000_000 },
        }),
      )
      expect(view).not.toHaveProperty('sheet')
      expect(view).not.toHaveProperty('sheetVersion')
      await expect(getGroupView(player(), 'unread')).resolves.toHaveProperty(
        'withheld',
        { reason: 'tooLarge' },
      )
    })
  })

  describe('tableGroups', () => {
    it('lists for a player only the groups they may see, the primary party first, never who else may', () => {
      expect(
        tableGroups(
          seat('player', PARTY.vex),
          [scouts, groupEntry(), hidden],
          ORIGIN,
        ),
      ).toEqual([
        {
          id: 'company',
          name: 'The Company',
          portrait: `${ORIGIN}/worlds/erebor/company.webp`,
          primary: true,
        },
        { id: 'scouts', name: 'Scouts', primary: false },
      ])
      expect(
        tableGroups(
          seat('player', PARTY.balin),
          [scouts, groupEntry(), hidden],
          ORIGIN,
        ),
      ).toEqual([])
    })

    it('lists every group for the Gamemaster, the primary party first', () => {
      expect(
        tableGroups(
          seat('gm', PARTY.balin),
          [scouts, groupEntry(), hidden],
          ORIGIN,
        ).map(({ id }) => id),
      ).toEqual(['company', 'scouts', 'hidden'])
    })
  })

  describe("the table view's groups", () => {
    const thorin = playerSeat(
      {
        id: 'char-1',
        name: 'Thorin Oakenshield',
        gameUrl: ORIGIN,
        campaignTitle: 'The Lonely Mountain',
        campaignId: 'c1',
        actorId: PARTY.thorin,
      },
      'user-1',
    )

    it('offers a player only the groups they may see, primary first, without who may see them', async () => {
      const view = await viewOf(thorin)

      expect(view.groups).toEqual([
        {
          id: 'company',
          name: 'The Company',
          portrait: `${ORIGIN}/worlds/erebor/company.webp`,
          primary: true,
        },
      ])
      expect(JSON.stringify(view)).not.toMatch(
        /access|foundry|settings|attackRollVisibility/,
      )
      expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.not.objectContaining({ foundry: expect.anything() }),
        }),
      )
    })

    it('offers the Gamemaster every group', async () => {
      const view = await viewOf({ ...thorin, role: 'gm', characterId: null })

      expect(view.groups?.map(({ id }) => id)).toEqual([
        'company',
        'scouts',
        'hidden',
      ])
    })

    it('offers none, leaving them out, where there are none to see', async () => {
      const view = await viewOf({ ...thorin, actorId: PARTY.balin })

      expect(view).not.toHaveProperty('groups')
    })
  })
})

describe('db/party, taking from a party, from module 0.31.0', () => {
  /** The campaign as held, its game taking moves and fetching them lately, unless given. */
  const taking = (fields: object = {}) =>
    held({
      transfersEnabled: true,
      bridgePolledAt: new Date(Date.now() - 5000),
      characters: [
        { id: PARTY.thorin, name: 'Thorin', img: 'worlds/erebor/thorin.webp' },
        { id: PARTY.vex, name: 'Vex', img: null },
      ],
      ...fields,
    })

  beforeEach(() => {
    sheetHeld()
  })

  it('lets a player whose Foundry user owns the group take from it, and tells them nothing more', async () => {
    taking()

    const view = await getGroupView(player(), 'company')
    expect(view?.moves).toEqual({})
    await expect(getPartyStatus(player(), 'company')).resolves.toEqual({
      version: 7,
      live: true,
      moves: true,
    })
    // No one's access, and no roster for a player.
    expect(JSON.stringify(view)).not.toContain('observer')
    expect(prismaMock.campaign.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({ select: { characters: true } }),
    )
  })

  it('lets a player who only observes the group see it, but take nothing', async () => {
    taking()

    const view = await getGroupView(player(PARTY.vex), 'company')
    expect(view?.sheet).toBeDefined()
    expect(view).not.toHaveProperty('moves')
    await expect(
      getPartyStatus(player(PARTY.vex), 'company'),
    ).resolves.toMatchObject({ moves: false })
  })

  it("lets the Gamemaster take from any group into any of the campaign's characters", async () => {
    taking()

    await expect(getGroupView(gm(), 'hidden')).resolves.toMatchObject({
      moves: {
        characters: [
          {
            id: PARTY.thorin,
            name: 'Thorin',
            portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
          },
          { id: PARTY.vex, name: 'Vex' },
        ],
      },
    })
    expect(prismaMock.campaign.findUnique).toHaveBeenCalledWith({
      where: { id: 'c1' },
      select: { characters: true },
    })
    await expect(getPartyStatus(gm(), 'company')).resolves.toMatchObject({
      moves: true,
    })
  })

  it.each([
    ['the campaign lets none be moved', { transfersEnabled: false }],
    [
      'its module has fetched none lately',
      { bridgePolledAt: new Date(Date.now() - 46_000) },
    ],
  ])('lets no one take while %s', async (_name, fields) => {
    taking(fields)

    for (const at of [player(), gm()]) {
      expect(await getGroupView(at, 'company')).not.toHaveProperty('moves')
      await expect(getPartyStatus(at, 'company')).resolves.toMatchObject({
        moves: false,
      })
    }
  })
})

describe('db/party, a party’s things sent and distributed, from module 0.32.0', () => {
  /** Wardens of the Vale, which Thorin's player owns too, and Vex's observes. */
  const wardens = groupEntry({
    id: 'wardens',
    name: 'Wardens of the Vale',
    primary: false,
    img: null,
    access: { [PARTY.thorin]: 'owner', [PARTY.vex]: 'observer' },
  })
  const ROSTER = [
    { id: PARTY.thorin, name: 'Thorin', img: 'worlds/erebor/thorin.webp' },
    { id: PARTY.vex, name: 'Vex', img: null },
    { id: PARTY.balin, name: 'Balin', img: null },
  ]
  const COINS = [{ id: 'gp', label: 'Gold', abbreviation: 'gp', value: 65 }]
  /** The campaign as held, taking moves with these features, and Thorin's sheet with his coin. */
  const sending = (
    transferFeatures: string[] = ['partySends', 'distribute'],
    fields: object = {},
  ) => {
    held({
      transfersEnabled: true,
      transferFeatures,
      bridgePolledAt: new Date(Date.now() - 5000),
      characters: ROSTER,
      groups: [scouts, groupEntry(), wardens, hidden],
      ...fields,
    })
    prismaMock.actorSheet.findUnique.mockResolvedValue({
      data: { inventory: { ...groupSheet().inventory, currency: COINS } },
    } as any)
  }
  const characters = [
    {
      id: PARTY.thorin,
      name: 'Thorin',
      portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
    },
    { id: PARTY.vex, name: 'Vex' },
    { id: PARTY.balin, name: 'Balin' },
  ]
  const members = [
    {
      id: PARTY.thorin,
      name: 'Thorin Oakenshield',
      portrait: `${ORIGIN}/worlds/erebor/thorin.webp`,
    },
    { id: PARTY.vex, name: 'Vex' },
  ]

  beforeEach(() => {
    prismaMock.actorSheet.findUnique.mockReset()
    sheetHeld()
  })

  it('tells a player who owns the party where its things may go, who shares its coin, and their own coins to give', async () => {
    sending()

    const view = await getGroupView(player(), 'company')
    expect(view?.moves).toEqual({
      // Only the other parties they own, never this one; every character, their own included.
      send: {
        parties: [
          { id: 'wardens', name: 'Wardens of the Vale', primary: false },
        ],
        characters,
      },
      // Its members that are the campaign's characters, in its sheet's order: no Myrtle.
      distribute: members,
      give: { currency: COINS },
    })
    expect(prismaMock.actorSheet.findUnique).toHaveBeenCalledWith({
      where: { campaignActor: { campaignId: 'c1', actorId: PARTY.thorin } },
      select: { data: true },
    })
    // Never anyone's access.
    expect(JSON.stringify(view)).not.toMatch(/observer|owner|access/)
  })

  it('lists the other parties a player owns, the primary first, from another party', async () => {
    sending()

    const view = await getGroupView(player(), 'wardens')
    expect(view?.moves?.send?.parties).toEqual([
      {
        id: 'company',
        name: 'The Company',
        portrait: `${ORIGIN}/worlds/erebor/company.webp`,
        primary: true,
      },
    ])
  })

  it('tells the Gamemaster every other party and every character, and gives them none of a player’s coins', async () => {
    sending()

    const view = await getGroupView(gm(), 'scouts')
    expect(view?.moves).toEqual({
      characters,
      send: {
        parties: [
          {
            id: 'company',
            name: 'The Company',
            portrait: `${ORIGIN}/worlds/erebor/company.webp`,
            primary: true,
          },
          { id: 'wardens', name: 'Wardens of the Vale', primary: false },
          {
            id: 'hidden',
            name: 'The Hidden Hand',
            portrait: `${ORIGIN}/worlds/erebor/company.webp`,
            primary: false,
          },
        ],
        characters,
      },
      distribute: members,
    })
    expect(view?.moves).not.toHaveProperty('give')
    expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
  })

  it('sends neither where the module does neither, though a player’s give is 0.31.0’s', async () => {
    sending([])

    expect((await getGroupView(player(), 'company'))?.moves).toEqual({
      give: { currency: COINS },
    })
    expect((await getGroupView(gm(), 'company'))?.moves).toEqual({
      characters,
    })
    sending(['partySends'])
    expect((await getGroupView(player(), 'company'))?.moves).not.toHaveProperty(
      'distribute',
    )
    sending(['distribute'])
    expect((await getGroupView(player(), 'company'))?.moves).not.toHaveProperty(
      'send',
    )
  })

  it('shares among none without the party’s sheet, with no characters in it, or with more than one distribution may', async () => {
    sending()
    prismaMock.groupSheet.findUnique.mockResolvedValue(null)
    expect((await getGroupView(player(), 'company'))?.moves).not.toHaveProperty(
      'distribute',
    )

    sheetHeld(
      groupSheet({
        members: groupSheet().members.map(member => ({
          ...member,
          character: false,
        })),
      }),
    )
    expect((await getGroupView(player(), 'company'))?.moves).not.toHaveProperty(
      'distribute',
    )

    sheetHeld(
      groupSheet({
        members: Array.from({ length: 21 }, (_, index) => ({
          id: `actor${index}`,
          name: `Hero ${index}`,
          img: null,
          type: 'character' as const,
          character: true,
        })),
      }),
    )
    expect((await getGroupView(player(), 'company'))?.moves).not.toHaveProperty(
      'distribute',
    )
  })

  it('gives none of their coins without their sheet', async () => {
    sending()
    prismaMock.actorSheet.findUnique.mockResolvedValue(null)

    expect((await getGroupView(player(), 'company'))?.moves).not.toHaveProperty(
      'give',
    )
  })

  it('tells one who only observes the party none of it, and reads no sheet of theirs', async () => {
    sending()

    expect(await getGroupView(player(PARTY.vex), 'company')).not.toHaveProperty(
      'moves',
    )
    expect(prismaMock.actorSheet.findUnique).not.toHaveBeenCalled()
  })
})
