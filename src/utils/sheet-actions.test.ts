/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
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
  SheetFeature,
  SheetRolls,
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

    it('has nothing for a spell that rolls nothing, or from an older module', () => {
      expect(spellAction(sheetSpell({ id: 'alarm', name: 'Alarm' }))).toBe(
        undefined,
      )
      expect(
        spellAction(sheetSpell({ id: 'alarm', name: 'Alarm', ...rolls() })),
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
