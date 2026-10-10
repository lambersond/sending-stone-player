/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { sheetTextRefs } from './sheet-texts'
import {
  characterSheet,
  fullerSheet,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  TEXTS,
} from '@/mocks/sending-stone'
import type {
  SheetActivity,
  SheetActivityFavorite,
  SheetCast,
  SheetContainer,
} from '@/types/sending-stone'

/** A description's hash, as the module names them, by a digit. */
const text = (digit: number) => `${digit}`.repeat(14)

/** A Cast of a spell whose description is this. */
const cast = (hash: string): SheetCast => ({
  level: 1,
  concentration: false,
  charges: 1,
  short: false,
  text: hash,
})

/** An activity, with its own description, as dnd5e 6 has, and the spell it casts' description. */
const activity = (own: string | null, casts?: string): SheetActivity => ({
  id: `activity-${own}`,
  name: 'Starry Wisp',
  type: casts ? 'cast' : 'utility',
  activation: 'Action',
  range: null,
  target: null,
  toHit: null,
  save: null,
  damage: [],
  uses: null,
  text: own,
  ...(casts && { cast: cast(casts) }),
})

describe('utils/sheet-texts', () => {
  it('lists every description a sheet refers to, once each', () => {
    const sheet = fullerSheet()
    sheet.features[1].text = TEXTS.fighter

    expect(sheetTextRefs(sheet)).toEqual([
      TEXTS.fighter,
      TEXTS.secondWind,
      TEXTS.actionSurge,
      TEXTS.bless,
      TEXTS.poisoned,
      TEXTS.warhammer,
      TEXTS.ring,
      TEXTS.backpack,
      TEXTS.rope,
      TEXTS.shield,
      TEXTS.biography,
    ])
  })

  it("counts an action's description, as one not listed elsewhere", () => {
    const sheet = fullerSheet()
    const [section] = sheet.actions
    sheet.actions = [
      {
        ...section,
        actions: [{ ...section.actions[0], text: '0f1e2d3c4b5a69' }],
      },
    ]

    expect(sheetTextRefs(sheet).at(-1)).toBe('0f1e2d3c4b5a69')
  })

  it('counts the description of a spell an action casts from its item, as module 0.15.0 sends it', () => {
    const sheet = fullerSheet()
    const [section] = sheet.actions
    sheet.actions = [
      {
        ...section,
        actions: [
          {
            ...section.actions[0],
            cast: {
              level: 1,
              concentration: false,
              charges: 1,
              short: false,
              text: 'f0e1d2c3b4a596',
            },
          },
        ],
      },
    ]

    expect(sheetTextRefs(sheet).at(-1)).toBe('f0e1d2c3b4a596')
  })

  it('finds none in a sheet without them, as from a module before 0.6.0', () => {
    expect(sheetTextRefs(characterSheet())).toEqual([])
    expect(sheetTextRefs({})).toEqual([])
  })

  it("counts each activity's own description and the spell each casts, wherever the sheet lists them, as module 0.17.0 sends them", () => {
    const sheet = fullerSheet()
    sheet.actions[0].actions = [
      sheetAction({
        id: 'flame',
        name: 'Worn Bardic Eternal Flame',
        activities: [activity(text(1)), activity(null, text(2))],
      }),
    ]
    sheet.features[0].features[0] = {
      ...sheet.features[0].features[0],
      cast: cast(text(3)),
      activities: [activity(text(4))],
    }
    sheet.spells = [
      {
        id: 'spell1',
        label: '1st Level',
        slots: null,
        spells: [
          sheetSpell({
            id: 'hex',
            name: 'Hex',
            activities: [activity(text(5))],
          }),
        ],
      },
    ]
    const backpack = sheet.inventory.containers[0]
    const pouch = backpack.contents?.[1] as SheetContainer
    pouch.contents = [
      sheetItem({
        id: 'wand',
        name: 'Wand',
        activities: [activity(null, text(6))],
      }),
    ]
    sheet.inventory.sections[0].items[0] = {
      ...sheet.inventory.sections[0].items[0],
      cast: cast(text(7)),
    }
    const favorite = sheetFavorites().find(
      ({ type }) => type === 'activity',
    ) as SheetActivityFavorite
    sheet.favorites = [{ ...favorite, text: text(8), cast: cast(text(9)) }]

    expect(sheetTextRefs(sheet)).toEqual(
      expect.arrayContaining(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => text(digit)),
      ),
    )
  })

  it('counts nothing for an activity without a description, nor a favorite of anything else', () => {
    const sheet = fullerSheet()
    sheet.actions[0].actions = [
      sheetAction({ id: 'flame', name: 'Flame', activities: [activity(null)] }),
    ]
    sheet.favorites = sheetFavorites()

    expect(sheetTextRefs(sheet)).toEqual(sheetTextRefs(fullerSheet()))
  })
})
