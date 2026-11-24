import { asks, summonLine, summonPicks } from './utils'
import { summonProfile, summoningSheet } from '@/mocks/sending-stone'
import { sheetActions } from '@/utils/sheet-actions'
import type { Picking } from './types'
import type { SheetAction, SheetUse } from '@/types/sending-stone'

// The picker's rules for summon activities, from module 0.54.0: when one asks before it's cast,
// what it's cast with where it asks nothing, and the line above its button.

const sheet = summoningSheet()
const actions = sheetActions(sheet)
const actionOf = (id: string) => actions.find(action => action.id === id)!

/** Pack of Wolves, its summon so: one creature, no type or size, no level to choose. */
const wolves = (
  summon: Partial<NonNullable<SheetUse['summon']>> = {},
): SheetAction => {
  const action = actionOf('packOfWolves')
  return {
    ...action,
    activity: {
      ...action.activity!,
      summon: { ...action.activity!.summon!, ...summon },
    },
  }
}

const using = (action: SheetAction): Picking => ({ kind: 'use', action })
const ask = (action: SheetAction) =>
  asks(using(action), undefined, sheet.spells)

describe('use-picker utils for summon activities, from module 0.54.0', () => {
  it.each<[string, SheetAction, boolean]>([
    ['one creature and nothing else', wolves(), false],
    [
      'two creatures',
      wolves({
        profiles: [
          summonProfile('wolvesProfile000', 'Wolf', { count: '2' }),
          summonProfile('bearProfile00000', 'Bear'),
        ],
      }),
      true,
    ],
    [
      'no creature at its level',
      wolves({ profiles: [summonProfile('w', 'Wolf', { min: 3 })] }),
      true,
    ],
    [
      'a choice of type',
      wolves({
        types: [
          { key: 'beast', label: 'Beast' },
          { key: 'fey', label: 'Fey' },
        ],
      }),
      true,
    ],
    [
      'a choice of size',
      wolves({
        sizes: [
          { key: 'med', label: 'Medium' },
          { key: 'lg', label: 'Large' },
        ],
      }),
      true,
    ],
    ['a level to choose', actionOf('summonBeast'), true],
  ])('asks for %s: %s', (_name, action, asked) => {
    expect(ask(action)).toBe(asked)
  })

  it('casts one that asks nothing as dnd5e presets it: its default slot, first creature, type and size', () => {
    expect(summonPicks(wolves(), sheet.spells)).toEqual({
      summon: { profile: 'wolvesProfile000' },
    })
    expect(summonPicks(actionOf('findFamiliar'), sheet.spells)).toEqual({
      slot: 'spell1',
      summon: { profile: 'batProfile000000', type: 'celestial' },
    })
    expect(
      summonPicks(
        wolves({
          sizes: [
            { key: 'med', label: 'Medium' },
            { key: 'lg', label: 'Large' },
          ],
        }),
        sheet.spells,
      ),
    ).toEqual({ summon: { profile: 'wolvesProfile000', size: 'med' } })
    // Nothing summoned at its level: cast with no creature, which the game refuses.
    expect(
      summonPicks(
        wolves({ profiles: [summonProfile('w', 'Wolf', { min: 3 })] }),
        sheet.spells,
      ),
    ).toEqual({})
    // Nothing for anything else.
    expect(
      summonPicks(
        { ...actionOf('findFamiliar'), activity: null },
        sheet.spells,
      ),
    ).toEqual({})
  })

  it('says who places what it summons, at each seat', () => {
    expect(summonLine('player')).toBe(
      'Your Gamemaster places it in Foundry from the card.',
    )
    expect(summonLine('gm')).toBe('You place it in Foundry from the card.')
  })
})
