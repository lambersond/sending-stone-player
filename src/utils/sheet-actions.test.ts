/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  activityAction,
  activityActions,
  featureAction,
  itemAction,
  itemSpellOf,
  sheetActions,
  spellAction,
} from './sheet-actions'
import {
  fullerSheet,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
} from '@/mocks/sending-stone'
import type {
  CharacterSheet,
  SheetActivity,
  SheetFeature,
  SheetRolls,
  SheetSpell,
  SheetSpellSection,
  SheetUse,
} from '@/types/sending-stone'

/** Nothing rolled, but for what's given. */
const rolls = (fields: Partial<SheetRolls> = {}): SheetRolls => ({
  toHit: null,
  attackId: null,
  activity: null,
  attackModes: null,
  ammunition: null,
  save: null,
  damage: [],
  ...fields,
})

/** An activity the game uses, at one creature. */
const use = (id: string, type: SheetUse['type']): SheetUse => ({
  id,
  type,
  targets: {
    self: false,
    area: false,
    count: 1,
    perLevel: null,
    affects: 'creature',
  },
})

const flame = rolls({
  activity: use('flame', 'save'),
  save: { ability: 'DEX', dc: 12 },
  damage: [{ formula: '1d8', type: 'Radiant', healing: false }],
})
const bolt = rolls({
  toHit: 4,
  attackId: 'bolt',
  damage: [{ formula: '1d12', type: 'Lightning', healing: false }],
})
const heal = rolls({
  activity: use('drink', 'heal'),
  damage: [{ formula: '2d4 + 2', type: 'Healing', healing: true }],
})

const feature = (fields: Partial<SheetFeature> = {}): SheetFeature => ({
  id: 'breath',
  name: 'Dragon Breath',
  img: null,
  kind: 'Species Feature',
  requirements: null,
  activation: '1 Action',
  passive: false,
  uses: { value: 1, max: 1, recovery: 'Long Rest' },
  text: null,
  ...fields,
})

/** Thorin, with a cantrip, a spell he hasn't prepared, a feature and a potion that roll. */
const rolling = (): CharacterSheet => {
  const sheet = fullerSheet()
  const [cantrips, first, ...spellbook] = sheet.spells
  const [backpack, ...containers] = sheet.inventory.containers
  return {
    ...sheet,
    spells: [
      {
        ...cantrips,
        spells: [
          sheetSpell({ id: 'flame', name: 'Sacred Flame', level: 0, ...flame }),
        ],
      },
      {
        ...first,
        spells: [
          ...first.spells,
          sheetSpell({ id: 'witch', name: 'Witch Bolt', prepared: 0, ...bolt }),
        ],
      },
      ...spellbook,
    ],
    features: [
      ...sheet.features,
      {
        id: 'other',
        label: 'Other Features',
        text: null,
        features: [
          feature({ range: '15 ft', target: '15 ft Cone', ...flame }),
          feature({ id: 'tough', name: 'Tough', passive: true }),
        ],
      },
    ],
    inventory: {
      ...sheet.inventory,
      containers: [
        {
          ...backpack,
          contents: [
            sheetItem({
              id: 'potion',
              name: 'Potion of Healing',
              type: 'consumable',
              quantity: 3,
              activation: '1 Bonus Action',
              range: 'Touch',
              ...heal,
            }),
            ...(backpack.contents ?? []),
          ],
        },
        ...containers,
      ],
    },
  }
}

/**
 * Hex's activities: placing its curse, then its damage on a hit and moving it, which spend no
 * slot.
 */
/** An item that rolls nothing of its own, as an action. */
const sheetActionOf = (id: string, name: string) => ({
  id,
  name,
  img: null,
  type: 'weapon',
  activation: 'Action',
  range: null,
  target: null,
  ...rolls(),
  uses: null,
  level: null,
  concentration: false,
  identified: true,
  text: null,
})

const hexActivities = (): SheetActivity[] => [
  {
    id: 'curse',
    name: 'Place Curse',
    type: 'utility',
    activation: '1 Bonus Action',
    range: '90 ft',
    target: '1 Creature',
    ...rolls({ activity: use('curse', 'utility') }),
    uses: null,
  },
  {
    id: 'hit',
    name: 'Bonus Hex Damage',
    type: 'damage',
    activation: 'Special',
    range: null,
    target: null,
    ...rolls({
      activity: use('hit', 'damage'),
      damage: [{ formula: '1d6', type: 'Necrotic', healing: false }],
    }),
    consumesSlot: false,
    uses: null,
  },
  {
    id: 'move',
    name: 'Curse New Creature',
    type: 'utility',
    activation: '1 Bonus Action',
    range: '90 ft',
    target: '1 Creature',
    ...rolls({ activity: use('move', 'utility') }),
    consumesSlot: false,
    uses: null,
  },
]

/** Hex, its own fields its curse's, as the module sends a spell with more than one activity. */
const hex = (fields: Partial<SheetSpell> = {}): SheetSpell =>
  sheetSpell({
    id: 'hex',
    name: 'Hex',
    activation: '1 Bonus Action',
    range: '90 ft',
    target: '1 Creature',
    prepared: 1,
    ...rolls({ activity: use('curse', 'utility') }),
    activities: hexActivities(),
    ...fields,
  })

/** A spellbook whose spells cast from items are these, as dnd5e lists its copy of each. */
const spellbook = (...spells: SheetSpell[]): SheetSpellSection[] => [
  { id: 'spell1', label: '1st Level', slots: null, spells: [] },
  { id: 'item', label: 'Item Spells', slots: null, spells },
]

describe('utils/sheet-actions', () => {
  describe('sheetActions', () => {
    it('lists the actions, the favorite activities, then the spells, features and items that roll', () => {
      const sheet = rolling()
      sheet.favorites = sheetFavorites()

      expect(
        sheetActions(sheet).map(({ id, name }) => `${id} ${name}`),
      ).toEqual([
        'warhammer Warhammer',
        'handaxe Handaxe',
        'guidance Guidance',
        'breath Fire Breath',
        'second-wind Second Wind',
        'shield Shield',
        'action-surge Action Surge',
        // The favorites that are actions: an item that's one, and an activity.
        'warhammer Warhammer',
        'staff Cast Fireball',
        'flame Sacred Flame',
        'witch Witch Bolt',
        'breath Dragon Breath',
        'potion Potion of Healing',
      ])
    })

    it('follows each with its other activities, so that each is found as it would be made', () => {
      const sheet = rolling()
      sheet.spells[1].spells.push(hex())

      expect(
        sheetActions(sheet)
          .filter(({ id }) => id === 'hex')
          .map(({ name, activity }) => [name, activity?.id]),
      ).toEqual([
        ['Hex', 'curse'],
        ['Hex (Bonus Hex Damage)', 'hit'],
        ['Hex (Curse New Creature)', 'move'],
      ])
    })

    it('lists nothing more for a sheet from a module that sends nothing they roll', () => {
      const sheet = fullerSheet()

      expect(sheetActions(sheet)).toEqual(
        sheet.actions.flatMap(section => section.actions),
      )
    })
  })

  it("makes an item whose only roll is its formula an action, keeping it and an area attack's area", () => {
    const lantern = sheetItem({
      id: 'lantern',
      name: 'Lantern of Revealing',
      rollFormula: { formula: '1d4 + 3', name: 'Light radius' },
    })
    const sheet = fullerSheet()
    sheet.inventory = {
      ...sheet.inventory,
      sections: [{ id: 'loot', label: 'Loot', items: [lantern] }],
    }

    expect(
      sheetActions(sheet).find(({ id }) => id === 'lantern'),
    ).toMatchObject({
      rollFormula: { formula: '1d4 + 3', name: 'Light radius' },
    })

    const breath = sheetAction({
      id: 'breath',
      name: 'Breath Weapon',
      attackId: 'breathAttack',
      toHit: 5,
      activities: [
        {
          id: 'breathAttack',
          name: 'Exhale',
          type: 'attack',
          activation: '1 Action',
          range: null,
          target: null,
          toHit: 5,
          attackId: 'breathAttack',
          save: null,
          damage: [],
          uses: null,
        },
        {
          id: 'gust',
          name: 'Gust',
          type: 'utility',
          activation: '1 Bonus Action',
          range: null,
          target: null,
          toHit: 5,
          attackId: 'gustAttack',
          save: null,
          damage: [],
          uses: null,
          rollFormula: { formula: '2d6', name: null },
          attackArea: { count: 3, perLevel: null, affects: 'creature' },
        },
      ],
    })
    expect(activityActions(breath)).toEqual([
      expect.objectContaining({
        rollFormula: { formula: '2d6', name: null },
        attackArea: { count: 3, perLevel: null, affects: 'creature' },
      }),
    ])
  })

  describe('spellAction', () => {
    it('makes a spell an action, as it would be on the Actions tab', () => {
      const wand = { id: 'wand', name: 'Wand of Sacred Flame' }

      expect(
        spellAction(
          sheetSpell({
            id: 'flame',
            name: 'Sacred Flame',
            level: 0,
            range: '60 ft',
            target: '1 Creature',
            concentration: true,
            castFrom: wand,
            ...flame,
          }),
        ),
      ).toEqual({
        id: 'flame',
        name: 'Sacred Flame',
        img: null,
        type: 'spell',
        activation: '1 Action',
        range: '60 ft',
        target: '1 Creature',
        ...flame,
        uses: null,
        level: 0,
        castFrom: wand,
        concentration: true,
        identified: true,
        text: null,
      })
    })

    it('rolls a spell not prepared here only, and has nothing for one that is only cast', () => {
      const witch = spellAction(
        sheetSpell({ id: 'witch', name: 'Witch Bolt', prepared: 0, ...bolt }),
      )
      const hold = spellAction(
        sheetSpell({
          id: 'hold',
          name: 'Hold Person',
          prepared: 0,
          activity: use('hold', 'save'),
          save: { ability: 'WIS', dc: 13 },
        }),
      )

      expect(witch).toMatchObject({
        toHit: 4,
        attackId: null,
        damage: bolt.damage,
      })
      expect(hold).toMatchObject({
        activity: null,
        save: { ability: 'WIS', dc: 13 },
      })
      expect(
        spellAction(
          sheetSpell({
            id: 'bless',
            name: 'Bless',
            prepared: 0,
            activity: use('bless', 'utility'),
          }),
        ),
      ).toBeUndefined()
      expect(
        spellAction(
          sheetSpell({
            id: 'bless',
            name: 'Bless',
            prepared: 1,
            activity: use('bless', 'utility'),
          }),
        ),
      ).toMatchObject({ activity: use('bless', 'utility') })
    })

    it('keeps the activities of a spell not prepared to the phone, and makes one whose later activities roll an action', () => {
      const unprepared = spellAction(hex({ prepared: 0 }))
      expect(
        unprepared?.activities?.map(({ activity, attackId }) => [
          activity,
          attackId,
        ]),
      ).toEqual([
        [null, null],
        [null, null],
        [null, null],
      ])
      expect(unprepared?.activities?.[1].damage).toEqual(
        hexActivities()[1].damage,
      )

      const sphere = spellAction(
        sheetSpell({
          id: 'sphere',
          name: 'Flaming Sphere',
          level: 2,
          prepared: 1,
          ...rolls(),
          activities: [
            {
              id: 'call',
              name: 'Summon',
              type: 'summon',
              activation: '1 Action',
              range: '60 ft',
              target: null,
              ...rolls(),
              uses: null,
            },
            {
              id: 'ram',
              name: 'Ram',
              type: 'save',
              activation: '1 Bonus Action',
              range: '5 ft',
              target: null,
              ...rolls({
                activity: use('ram', 'save'),
                save: { ability: 'DEX', dc: 14 },
                damage: [{ formula: '2d6', type: 'Fire', healing: false }],
              }),
              consumesSlot: false,
              uses: null,
            },
          ],
        }),
      )
      expect(sphere).toMatchObject({ activity: null, damage: [] })
      expect(sphere?.activities?.map(({ name }) => name)).toEqual([
        'Summon',
        'Ram',
      ])
      // One with a single activity lists none.
      expect(
        spellAction(hex({ activities: hexActivities().slice(0, 1) })),
      ).not.toHaveProperty('activities')
    })

    it('has nothing for a spell that rolls nothing, or from an older module', () => {
      expect(spellAction(sheetSpell({ id: 'alarm', name: 'Alarm' }))).toBe(
        undefined,
      )
      expect(
        spellAction(sheetSpell({ id: 'alarm', name: 'Alarm', ...rolls() })),
      ).toBeUndefined()
    })
  })

  describe('activityAction', () => {
    it("makes one of an item's activities an action of its own, the item's, named for both, rolling and used as it alone", () => {
      const action = spellAction(hex())
      if (!action) throw new Error('Hex is cast')
      const [, hit] = hexActivities()

      expect(activityAction(action, hit)).toEqual({
        id: 'hex',
        name: 'Hex (Bonus Hex Damage)',
        img: null,
        type: 'spell',
        activation: 'Special',
        range: null,
        target: null,
        ...rolls({ activity: use('hit', 'damage'), damage: hit.damage }),
        consumesSlot: false,
        uses: null,
        level: 1,
        castFrom: null,
        concentration: false,
        identified: true,
        text: null,
      })
      expect(activityAction(action, { ...hit, name: 'Hex' }).name).toBe('Hex')
    })

    it('makes a spell an item casts an action that casts it, taking concentration as the spell does', () => {
      const staff = {
        ...sheetActionOf('staff', 'Staff of Charming'),
        concentration: false,
      }
      const [, hit] = hexActivities()
      const cast = { level: 2, concentration: true, charges: 1, short: false }
      const charm = {
        ...hit,
        id: 'cast-hold',
        name: 'Hold Person',
        type: 'cast',
        activationType: 'action',
        cast,
      }

      expect(activityAction(staff, charm)).toMatchObject({
        id: 'staff',
        name: 'Staff of Charming (Hold Person)',
        activationType: 'action',
        cast,
        castFrom: { id: 'staff', name: 'Staff of Charming' },
        concentration: true,
      })
      expect(activityAction(staff, hit)).not.toHaveProperty('cast')
    })
  })

  describe('itemSpellOf', () => {
    const staff = { id: 'staff', name: 'Staff of Fire' }
    const fireball = sheetSpell({
      id: 'fireball-copy',
      name: 'Fireball',
      level: 3,
      castFrom: staff,
      text: '0f1a2b3c4d5e6f',
    })
    const wall = sheetSpell({
      id: 'wall-copy',
      name: 'Wall of Fire',
      level: 4,
      castFrom: staff,
      text: '1a2b3c4d5e6f70',
    })
    // Another item's copy of the same spell, which is never the staff's.
    const wand = sheetSpell({
      id: 'wand-copy',
      name: 'Fireball',
      level: 3,
      castFrom: { id: 'wand', name: 'Wand of Fireballs' },
      text: '0f1a2b3c4d5e6f',
    })

    it('finds the spell an activity casts among those its item casts, by its name', () => {
      const spells = spellbook(wand, fireball, wall)

      expect(
        itemSpellOf(spells, 'staff', { name: 'Fireball', casts: true }),
      ).toBe(fireball)
      expect(
        itemSpellOf(spells, 'staff', { name: 'Wall of Fire', casts: true }),
      ).toBe(wall)
      expect(
        itemSpellOf(spells, 'wand', { name: 'Fireball', casts: true }),
      ).toBe(wand)
    })

    it('finds it by its description first, where the module sent it', () => {
      expect(
        itemSpellOf(spellbook(fireball, wall), 'staff', {
          name: 'Cast Fireball',
          text: '1a2b3c4d5e6f70',
          casts: true,
        }),
      ).toBe(wall)
    })

    it("falls back to the item's only spell for a Cast activity renamed, and to none for more than one", () => {
      const renamed = { name: 'Cast Fireball', casts: true, resolved: true }

      expect(itemSpellOf(spellbook(wand, fireball), 'staff', renamed)).toBe(
        fireball,
      )
      expect(
        itemSpellOf(spellbook(fireball, wall), 'staff', renamed),
      ).toBeUndefined()
      // Nor where two of the item's spells have its name.
      expect(
        itemSpellOf(
          spellbook(fireball, { ...wall, name: 'Fireball' }),
          'staff',
          { name: 'Fireball', casts: true },
        ),
      ).toBeUndefined()
    })

    it("falls back to the item's only spell for a Cast whose spell the module didn't find only where that can't be cast now", () => {
      // Its spell not set, or lost, it's named for its kind, and the only spell is another Cast's.
      const unset = { name: 'Cast', casts: true }

      expect(
        itemSpellOf(spellbook(wand, fireball), 'staff', unset),
      ).toBeUndefined()
      // One that can't be cast now the module says nothing of either, as of the spell it casts.
      const unusable = {
        ...fireball,
        castFrom: { ...staff, usable: false, attune: true },
      }
      expect(itemSpellOf(spellbook(unusable), 'staff', unset)).toBe(unusable)
    })

    it("finds none for an activity that isn't a Cast, unless one has its name", () => {
      const spells = spellbook(fireball)

      expect(
        itemSpellOf(spells, 'staff', { name: 'Attack', casts: false }),
      ).toBeUndefined()
      expect(
        itemSpellOf(spells, 'staff', { name: 'Fireball', casts: false }),
      ).toBe(fireball)
      expect(
        itemSpellOf(spells, 'sword', { name: 'Fireball', casts: true }),
      ).toBeUndefined()
    })
  })

  describe('featureAction', () => {
    it('makes a feature an action, with its range, target and concentration', () => {
      expect(
        featureAction(
          feature({ range: '15 ft', target: '15 ft Cone', ...flame }),
        ),
      ).toEqual({
        id: 'breath',
        name: 'Dragon Breath',
        img: null,
        type: 'feat',
        activation: '1 Action',
        range: '15 ft',
        target: '15 ft Cone',
        ...flame,
        uses: { value: 1, max: 1, recovery: 'Long Rest' },
        level: null,
        castFrom: null,
        concentration: false,
        identified: true,
        text: null,
      })
      expect(featureAction(feature({ ...heal }))).toMatchObject({
        range: null,
        target: null,
        concentration: false,
      })
      expect(featureAction(feature())).toBeUndefined()
    })
  })

  describe('itemAction', () => {
    it("makes something carried an action, whether it's equipped or not", () => {
      expect(
        itemAction(
          sheetItem({
            id: 'bow',
            name: 'Longbow',
            type: 'weapon',
            equipped: false,
            activation: '1 Action',
            range: 'range 150/600 ft',
            target: '1 Creature',
            concentration: false,
            ...bolt,
          }),
        ),
      ).toEqual({
        id: 'bow',
        name: 'Longbow',
        img: null,
        type: 'weapon',
        activation: '1 Action',
        range: 'range 150/600 ft',
        target: '1 Creature',
        ...bolt,
        uses: null,
        level: null,
        castFrom: null,
        concentration: false,
        identified: true,
        text: null,
      })
    })

    it('has nothing for an item that rolls nothing, or is not identified yet', () => {
      expect(itemAction(sheetItem({ id: 'rope', name: 'Rope' }))).toBe(
        undefined,
      )
      expect(
        itemAction(
          sheetItem({ id: 'odd', name: 'Odd', identified: false, ...bolt }),
        ),
      ).toBeUndefined()
    })
  })
})
