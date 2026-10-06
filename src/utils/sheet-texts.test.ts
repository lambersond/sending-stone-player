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

  it('finds none in a sheet without them, as from a module before 0.6.0', () => {
    expect(sheetTextRefs(characterSheet())).toEqual([])
    expect(sheetTextRefs({})).toEqual([])
  })
})
