import { sheetTextRefs } from './sheet-texts'
import { characterSheet, fullerSheet, TEXTS } from '@/mocks/sending-stone'

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
})
