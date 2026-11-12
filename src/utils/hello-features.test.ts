/**
 * @jest-environment node
 */
import {
  HELLO_ROLL_FLAGS,
  helloCampaignData,
  helloCompanionData,
  kindOn,
} from './hello-features'

describe('utils/hello-features', () => {
  it.each([
    [{ enabled: true, kinds: ['transfer'] }, true],
    [{ enabled: true, kinds: ['remove'] }, false],
    [{ enabled: false, kinds: ['transfer'] }, false],
    [{ enabled: true }, false],
    [null, false],
    [undefined, false],
  ])('kindOn(%j, transfer) is %s', (feature, on) => {
    expect(kindOn(feature, 'transfer')).toBe(on)
  })

  it('keeps the roll flags a hello says in the stored order, whatever order it says them in', () => {
    const rolls = Object.fromEntries(
      HELLO_ROLL_FLAGS.toReversed().map(flag => [flag, true]),
    )
    const { rollFeatures } = helloCampaignData({
      rolls: { enabled: true, kinds: [], reason: null, ...rolls },
    })
    expect(JSON.stringify(rollFeatures)).toBe(JSON.stringify(HELLO_ROLL_FLAGS))
  })

  it('clears everything a hello from a module that says nothing of its features leaves out', () => {
    expect(
      JSON.stringify({
        ...helloCampaignData(null),
        ...helloCompanionData(null),
      }),
    ).toBe(
      JSON.stringify({
        rollsEnabled: false,
        rollKinds: [],
        rollFeatures: [],
        transfersEnabled: false,
        transferFeatures: [],
        removalsEnabled: false,
        favoritesEnabled: false,
        favoriteFeatures: [],
        dishesEnabled: false,
        dishVersions: [],
        effectsEnabled: false,
        wildShapeEnabled: false,
        hitPointsEnabled: false,
        notesEnabled: false,
        noteFeatures: [],
        tidyActive: null,
        tidyVersion: null,
        companionKinds: [],
        companionInitiative: 'own',
      }),
    )
  })

  it('takes no command kind as a roll, and no move feature while moves are off', () => {
    const data = helloCampaignData({
      rolls: {
        enabled: true,
        kinds: [
          'skill',
          'transfer',
          'favorite',
          'wildShape',
          'hitPoints',
          'plainRoll',
          'nonsense',
        ],
        reason: null,
      },
      transfers: {
        enabled: false,
        kinds: ['transfer'],
        reason: null,
        partySends: true,
        distribute: true,
      },
    })
    expect(data.rollKinds).toEqual(['skill', 'plainRoll'])
    expect(data.transfersEnabled).toBe(false)
    expect(data.transferFeatures).toEqual([])
  })

  // Module 0.44.0: hit points have a switch of their own, apart from the rolls, and are taken at a
  // companion's seat wherever that is on, never as one of the companions' rolls; a plain roll is
  // the character's own.
  it.each([
    [{ enabled: true, kinds: ['hitPoints'], reason: null }, true],
    [{ enabled: false, kinds: ['hitPoints'], reason: 'off' }, false],
    [{ enabled: false, kinds: [], reason: 'system' }, false],
    [{ enabled: true, kinds: [], reason: null }, false],
    [undefined, false],
  ])('keeps hit points on from features.hitPoints %j: %s', (hitPoints, on) => {
    expect(helloCampaignData({ hitPoints }).hitPointsEnabled).toBe(on)
  })

  // Module 0.47.0: favorites put in order, where they're taken at all.
  it.each([
    [
      { enabled: true, kinds: ['favorite'], reason: null, orders: true },
      ['orders'],
    ],
    [{ enabled: true, kinds: ['favorite'], reason: null }, []],
    [{ enabled: false, kinds: [], reason: 'system', orders: true }, []],
  ])(
    'keeps favorites’ orders from features.favorites %j',
    (favorites, kept) => {
      expect(helloCampaignData({ favorites }).favoriteFeatures).toEqual(kept)
    },
  )

  // Module 0.44.0: Tidy 5e Sheets, active or not, installed or not, as the hello's notes say it.
  it.each([
    [{ active: true, version: '14.4.1', actors: [] }, true, '14.4.1'],
    [
      { active: false, version: '13.10.5', actors: ['thorin'] },
      false,
      '13.10.5',
    ],
    [{ active: false, version: null, actors: ['thorin'] }, false, null],
    [undefined, null, null],
  ])('keeps Tidy from features.notes.tidy %j', (tidy, active, version) => {
    const notes = {
      enabled: true,
      kinds: ['personal', 'party'],
      reason: null,
      journals: [],
      tidy,
    }
    expect(helloCampaignData({ notes })).toMatchObject({
      tidyActive: active,
      tidyVersion: version,
    })
  })

  it('takes neither hit points nor a plain roll as a companion’s roll', () => {
    const { companionKinds } = helloCompanionData({
      companions: {
        kinds: ['attack', 'hitPoints', 'plainRoll'],
        initiative: 'own',
      },
    })
    expect(companionKinds).toEqual(['attack'])
  })
})
