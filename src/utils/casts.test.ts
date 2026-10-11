/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { castAtLevel, castIndex, castOf, isItemCast } from './casts'
import {
  castingSheet,
  characterSheet,
  sheetAction,
  sheetItem,
  sheetSpell,
  WAND_LEVELS,
} from '@/mocks/sending-stone'
import { activityActions, spellAction } from '@/utils/sheet-actions'
import type { SheetActivity, SheetCast } from '@/types/sending-stone'

/** How a spell is cast from an item, at its 1st level unless said, for 1 charge of those left. */
const cast = (fields: Partial<SheetCast> = {}): SheetCast => ({
  level: 1,
  concentration: false,
  charges: 1,
  short: false,
  ...fields,
})

/** A Cast among an item's activities, of the copy given. */
const castActivity = (
  spellId: string,
  how: SheetCast | null = cast(),
): SheetActivity => ({
  id: `cast-${spellId}`,
  name: 'Cast',
  type: 'cast',
  activation: 'Action',
  range: null,
  target: null,
  toHit: null,
  attackId: null,
  save: null,
  damage: [],
  cast: how,
  spellId,
  uses: null,
})

describe('utils/casts', () => {
  describe('castIndex', () => {
    it('finds how each spell an item casts is cast, by its copy, wherever the sheet lists its Cast', () => {
      const index = castIndex(
        characterSheet({
          actions: [
            {
              id: 'action',
              label: 'Actions',
              actions: [
                sheetAction({
                  id: 'wand',
                  name: 'Wand',
                  cast: cast({ levels: WAND_LEVELS }),
                  spellId: 'from-action',
                }),
                sheetAction({
                  id: 'staff',
                  name: 'Staff',
                  activities: [
                    castActivity('first', cast({ level: 9 })),
                    castActivity('from-action-activity', cast({ level: 2 })),
                  ],
                }),
              ],
            },
          ],
          inventory: {
            sections: [
              {
                id: 'equipment',
                label: 'Equipment',
                items: [
                  sheetItem({
                    id: 'ring',
                    name: 'Ring',
                    cast: cast({ level: 3 }),
                    spellId: 'from-item',
                    activities: [
                      castActivity('from-item-activity', cast({ level: 4 })),
                    ],
                  }),
                ],
              },
            ],
            containers: [],
            currency: [],
            encumbrance: null,
            attunement: null,
          },
          features: [
            {
              id: 'class',
              label: 'Features',
              text: null,
              features: [
                {
                  id: 'gift',
                  name: 'Gift',
                  img: null,
                  kind: null,
                  requirements: null,
                  activation: null,
                  passive: false,
                  uses: null,
                  text: null,
                  cast: cast({ level: 5 }),
                  spellId: 'from-feature',
                  activities: [
                    castActivity('from-feature-activity', cast({ level: 6 })),
                  ],
                },
              ],
            },
          ],
          favorites: [
            {
              type: 'activity',
              id: 'cast-fav',
              itemId: 'amulet',
              itemType: 'equipment',
              itemName: 'Amulet',
              name: 'Cast',
              img: null,
              activation: 'Action',
              range: null,
              target: null,
              toHit: null,
              save: null,
              damage: [],
              uses: null,
              cast: cast({ level: 7 }),
              spellId: 'from-favorite',
            },
            {
              type: 'activity',
              id: 'cast-again',
              itemId: 'staff',
              itemType: 'weapon',
              itemName: 'Staff',
              name: 'Cast',
              img: null,
              activation: 'Action',
              range: null,
              target: null,
              toHit: null,
              save: null,
              damage: [],
              uses: null,
              cast: cast({ level: 8 }),
              // Listed among the staff's activities already, which come first.
              spellId: 'first',
            },
          ],
        }),
      )

      expect(
        Object.fromEntries([...index].map(([id, { level }]) => [id, level])),
      ).toEqual({
        'from-action': 1,
        first: 9,
        'from-action-activity': 2,
        'from-item': 3,
        'from-item-activity': 4,
        'from-feature': 5,
        'from-feature-activity': 6,
        'from-favorite': 7,
      })
      expect(index.get('from-action')?.levels).toEqual(WAND_LEVELS)
    })

    it('leaves out a Cast that says nothing of how it is cast, such as one that summons first', () => {
      const sheet = characterSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'staff',
                name: 'Staff of the Magi',
                spellId: 'sphere',
                activities: [castActivity('sphere', null)],
              }),
            ],
          },
        ],
      })
      expect(castIndex(sheet).size).toBe(0)
    })
  })

  describe('castOf', () => {
    const sheet = castingSheet()
    const casts = castIndex(sheet)
    const copies = sheet.spells[0].spells
    const [wandRow] = sheet.actions[0].actions

    it("is a Cast's own, and the item's Cast's for the copy of its spell the Spells tab lists", () => {
      expect(castOf(wandRow, casts)).toBe(wandRow.cast)
      const copy = spellAction(copies[0])!
      expect(castOf(copy, casts)).toEqual(cast({ levels: WAND_LEVELS }))
    })

    it("is the Cast's for each of its spell's later activities that spends, and spends nothing for one that doesn't", () => {
      const hex = spellAction(copies[1])!
      expect(castOf(hex, casts)).toEqual(cast({ concentration: true }))
      const [bonus] = activityActions(hex)
      expect(bonus.consumesSlot).toBe(false)
      expect(castOf(bonus, casts)).toEqual(
        cast({ concentration: true, charges: null }),
      )

      // A free one, of a spell cast higher, is cast at every level, never short.
      const higher = castIndex(
        castingSheet({
          actions: [
            {
              id: 'action',
              label: 'Actions',
              actions: [
                sheetAction({
                  id: 'flame',
                  name: 'Bardic Flame',
                  cast: cast({
                    short: true,
                    levels: [
                      { level: 1, charges: 1, short: true },
                      { level: 2, charges: 2, short: true },
                    ],
                  }),
                  spellId: 'hex',
                }),
              ],
            },
          ],
        }),
      )
      expect(castOf(bonus, higher)).toEqual(
        cast({
          charges: null,
          levels: [
            { level: 1, charges: null, short: false },
            { level: 2, charges: null, short: false },
          ],
        }),
      )
    })

    it("is nothing for a spell of the character's own, for one the item can't cast now, or for anything else", () => {
      const own = spellAction(
        sheetSpell({
          id: 'mm',
          name: 'Magic Missile',
          damage: [{ formula: '1d4 + 1', type: 'Force', healing: false }],
        }),
      )!
      expect(castOf(own, casts)).toBeUndefined()
      const unusable = spellAction({
        ...copies[0],
        castFrom: { id: 'mm-wand', name: 'Wand', usable: false },
      })!
      expect(castOf(unusable, casts)).toBeUndefined()
      expect(
        castOf(sheetAction({ id: 'mm', name: 'Magic Missile' }), casts),
      ).toBeUndefined()
    })
  })

  describe('isItemCast', () => {
    const sheet = castingSheet()
    const copies = sheet.spells[0].spells
    const [wandRow, flame] = sheet.actions[0].actions

    it('is true of a Cast, the copy of its spell and its later activities, and of nothing else', () => {
      expect(isItemCast(wandRow)).toBe(true)
      expect(isItemCast(spellAction(copies[0])!)).toBe(true)
      const [bonus] = activityActions(spellAction(copies[1])!)
      expect(isItemCast(bonus)).toBe(true)
      // The flame's strike, and a spell of the character's own.
      expect(isItemCast(flame)).toBe(false)
      expect(
        isItemCast(
          sheetAction({ id: 'bless', name: 'Bless', type: 'spell', level: 1 }),
        ),
      ).toBe(false)
    })
  })

  describe('castAtLevel', () => {
    const sheet = castingSheet()
    const casts = castIndex(sheet)
    const [wandRow] = sheet.actions[0].actions

    it('is the level chosen for a spell an item casts, or else the one it is cast at', () => {
      expect(castAtLevel(wandRow, sheet.spells, 'spell2', casts)).toBe(2)
      expect(castAtLevel(wandRow, sheet.spells, undefined, casts)).toBe(1)
      const copy = spellAction(sheet.spells[0].spells[0])!
      expect(castAtLevel(copy, sheet.spells, 'spell3', casts)).toBe(3)
      expect(
        castAtLevel(
          { ...wandRow, cast: cast({ level: 3 }) },
          sheet.spells,
          null,
          casts,
        ),
      ).toBe(3)
    })

    it('is as its slots make it for any other spell', () => {
      const spellbook = [
        {
          id: 'spell1',
          label: '1st Level',
          slots: { value: 0, max: 2, level: 1 },
          spells: [sheetSpell({ id: 'bless', name: 'Bless' })],
        },
        {
          id: 'spell2',
          label: '2nd Level',
          slots: { value: 1, max: 2, level: 2 },
          spells: [],
        },
      ]
      const bless = sheetAction({
        id: 'bless',
        name: 'Bless',
        type: 'spell',
        level: 1,
      })
      expect(castAtLevel(bless, spellbook, undefined, casts)).toBe(2)
      expect(castAtLevel(bless, spellbook, 'spell1', casts)).toBe(1)
    })
  })
})
