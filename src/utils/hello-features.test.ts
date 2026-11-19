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
        coinsEnabled: false,
        coinFeatures: [],
        // Changed on purpose (item 58): and other creatures' health, from module 0.50.0.
        healthEnabled: false,
        healthFeatures: [],
        notesEnabled: false,
        noteFeatures: [],
        tidyActive: null,
        tidyVersion: null,
        companionKinds: [],
        companionInitiative: 'own',
        // Changed on purpose (item 18): companions on every scene, from module 0.51.0.
        companionsAway: false,
      }),
    )
  })

  // Module 0.51.0 (item 18): whether the module lists companions on every scene, for Help.
  it.each([
    [true, true],
    [false, false],
    ['yes', false],
    [undefined, false],
  ])('keeps companions listed on every scene for away %p as %p', (away, on) => {
    const { companionsAway } = helloCompanionData({
      companions: {
        kinds: [],
        initiative: 'own',
        away: away as boolean | undefined,
      },
    })
    expect(companionsAway).toBe(on)
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
          'coins',
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
        handOut: true,
        change: true,
        handOutParties: true,
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

  // Module 0.49.0: coins added and taken away have a switch of their own, and say whether a
  // character short of a coin pays with its other coins, never while they're off.
  it.each([
    [
      { enabled: true, kinds: ['coins'], reason: null, change: true },
      true,
      ['change'],
    ],
    [
      { enabled: true, kinds: ['coins'], reason: null, change: false },
      true,
      [],
    ],
    [{ enabled: true, kinds: ['coins'], reason: null }, true, []],
    [{ enabled: false, kinds: [], reason: 'off', change: true }, false, []],
    [{ enabled: false, kinds: [], reason: 'system', change: false }, false, []],
    [{ enabled: true, kinds: [], reason: null, change: true }, false, []],
    [undefined, false, []],
  ])('keeps coins from features.coins %j: %s, %j', (coins, on, features) => {
    expect(helloCampaignData({ coins })).toMatchObject({
      coinsEnabled: on,
      coinFeatures: features,
    })
  })

  // Module 0.50.0: other creatures' health, by a switch of its own, and whether their hit points
  // show too, never while it's off.
  it.each([
    [undefined, false, []],
    [{ enabled: false, reason: 'off', hitPoints: false }, false, []],
    [{ enabled: true, reason: null, hitPoints: false }, true, []],
    [{ enabled: true, reason: null, hitPoints: true }, true, ['hitPoints']],
    [{ enabled: false, reason: 'system', hitPoints: true }, false, []],
  ])('keeps health from features.health %j: %s, %j', (health, on, kept) => {
    expect(helloCampaignData({ health })).toMatchObject({
      healthEnabled: on,
      healthFeatures: kept,
    })
  })

  // Module 0.49.0: a character's coins handed out, and whether its giver pays with other coins,
  // after what module 0.32.0 said of moves, in the stored order; and module 0.51.0's hand-out to
  // parties too, after them.
  it.each([
    [
      {
        handOutParties: true,
        partySends: true,
        distribute: true,
        handOut: true,
        change: true,
      },
      ['partySends', 'distribute', 'handOut', 'change', 'handOutParties'],
    ],
    [
      { partySends: true, distribute: true, handOut: true, change: true },
      ['partySends', 'distribute', 'handOut', 'change'],
    ],
    [{ change: true, handOut: true }, ['handOut', 'change']],
    [
      { partySends: true, distribute: true, handOut: true },
      ['partySends', 'distribute', 'handOut'],
    ],
    [{ partySends: true, distribute: true }, ['partySends', 'distribute']],
  ])('keeps what else moves do from features.transfers %j', (more, kept) => {
    const transfers = {
      enabled: true,
      kinds: ['transfer'],
      reason: null,
      ...more,
    }
    expect(helloCampaignData({ transfers }).transferFeatures).toEqual(kept)
  })

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

  it('takes neither hit points, coins nor a plain roll as a companion’s roll', () => {
    const { companionKinds } = helloCompanionData({
      companions: {
        kinds: ['attack', 'hitPoints', 'coins', 'plainRoll'],
        initiative: 'own',
      },
    })
    expect(companionKinds).toEqual(['attack'])
  })
})
