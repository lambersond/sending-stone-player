/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  activityAction,
  featureAction,
  itemAction,
  sheetActions,
  spellAction,
} from './sheet-actions'
import {
  fullerSheet,
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
