/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { favoriteEntries, favoriteKeys, rollsAny } from './favorites'
import {
  fullerSheet,
  sheetAction,
  sheetFavorites,
  sheetSpell,
  TEXTS,
} from '@/mocks/sending-stone'
import type { SheetFavorite } from '@/types/sending-stone'

/** An item made a favorite, by its id. */
const item = (id: string, itemType = 'loot'): SheetFavorite => ({
  type: 'item',
  id,
  itemType,
  name: id,
  img: null,
})

/** One of an item's activities, rolling nothing. */
const activity = (id: string, name: string) => ({
  id,
  name,
  type: 'cast',
  activation: null,
  range: null,
  target: null,
  toHit: null,
  save: null,
  damage: [],
  uses: null,
})

describe('utils/favorites', () => {
  describe('favoriteEntries', () => {
    it('finds what each favorite refers to on the sheet, in the order dnd5e shows them', () => {
      const sheet = fullerSheet({ favorites: sheetFavorites() })
      const entries = favoriteEntries(sheet)

      expect(entries.map(({ key, kind }) => [key, kind])).toEqual([
        ['resource:primary', 'resource'],
        ['item:warhammer', 'action'],
        ['activity:cast-fireball', 'action'],
        ['effect:blessed', 'effect'],
        ['skill:prc', 'check'],
        ['tool:thief', 'check'],
        ['slots:spell1', 'slots'],
      ])
      const [resource, warhammer, fireball, bless, perception, tools, slots] =
        entries
      expect(resource).toMatchObject({
        resource: { name: 'Superiority Dice', uses: { value: 3, max: 4 } },
      })
      expect(warhammer).toEqual({
        key: 'item:warhammer',
        kind: 'action',
        action: sheet.actions[0].actions[0],
        note: undefined,
      })
      expect(fireball).toEqual({
        key: 'activity:cast-fireball',
        kind: 'action',
        action: sheetAction({
          id: 'staff',
          name: 'Cast Fireball',
          img: 'systems/dnd5e/icons/svg/activity/cast.svg',
          type: 'weapon',
          activation: 'Action',
          range: '150 ft',
          target: '20 ft Sphere',
          save: { ability: 'DEX', dc: 15 },
          damage: [{ formula: '8d6', type: 'Fire', healing: false }],
          attackId: null,
          activity: null,
          attackModes: null,
          ammunition: null,
          castFrom: null,
        }),
        note: 'Staff of Fire',
      })
      expect(bless).toEqual({
        key: 'effect:blessed',
        kind: 'effect',
        effect: sheet.effects[0].effects[0],
        suppressed: false,
      })
      expect(perception).toEqual({
        key: 'skill:prc',
        kind: 'check',
        check: sheet.skills[1],
        source: { kind: 'skill', key: 'prc' },
      })
      expect(tools).toEqual({
        key: 'tool:thief',
        kind: 'check',
        check: {
          id: 'thief',
          label: "Thieves' Tools",
          ability: 'dex',
          total: 5,
          passive: null,
          proficiency: 1,
          mode: 0,
        },
        source: { kind: 'tool', key: 'thief' },
      })
      expect(slots).toMatchObject({
        slots: { name: '1st Level', value: 1, max: 2, level: 1 },
      })
    })

    it('shows an item as an action if it is one, else as a spell, a thing carried, a feature or a class', () => {
      const sheet = fullerSheet({
        favorites: [
          item('second-wind', 'feat'),
          item('cure', 'spell'),
          item('cloak', 'equipment'),
          item('rope'),
          item('pouch', 'container'),
          item('darkvision', 'feat'),
          item('fighter', 'class'),
          item('soldier', 'background'),
        ],
      })

      expect(
        favoriteEntries(sheet).map(entry => {
          switch (entry.kind) {
            case 'action': {
              return [entry.kind, entry.action.name]
            }
            case 'spell': {
              return [entry.kind, entry.spell.name]
            }
            case 'item': {
              return [entry.kind, entry.item.name]
            }
            case 'feature': {
              return [entry.kind, entry.feature.name]
            }
            case 'class': {
              return [entry.kind, entry.entry.name]
            }
            default: {
              return [entry.kind, entry.key]
            }
          }
        }),
      ).toEqual([
        ['action', 'Second Wind'],
        ['spell', 'Cure Wounds'],
        ['item', 'Cloak of Protection'],
        ['item', 'Hempen Rope'],
        ['item', 'Pouch'],
        ['feature', 'Darkvision'],
        ['class', 'Fighter'],
        ['other', 'item:soldier'],
      ])
    })

    it('says by an action what its group would have: the item a spell is cast from, or how many there are', () => {
      const sheet = fullerSheet({
        favorites: [item('handaxe', 'weapon'), item('wand-missile', 'spell')],
      })
      sheet.actions[0].actions.push(
        sheetAction({
          id: 'wand-missile',
          name: 'Magic Missile',
          type: 'spell',
          level: 1,
          castFrom: { id: 'wand', name: 'Wand of Magic Missiles' },
        }),
      )

      expect(
        favoriteEntries(sheet).map(entry =>
          entry.kind === 'action' ? entry.note : entry.kind,
        ),
      ).toEqual(['×2', 'From Wand of Magic Missiles'])
    })

    it("takes an activity's spell level, concentration and description from its spell, and whether it's identified from its item", () => {
      const sheet = fullerSheet({
        favorites: [
          {
            type: 'activity',
            id: 'heal',
            itemId: 'cure',
            itemType: 'spell',
            itemName: 'Cure Wounds',
            name: 'Cure Wounds',
            img: null,
            activation: 'Action',
            range: 'Touch',
            target: null,
            toHit: null,
            save: null,
            damage: [{ formula: '2d8 + 3', type: 'Healing', healing: true }],
            uses: null,
          },
          {
            type: 'activity',
            id: 'glow',
            itemId: 'ring',
            itemType: 'equipment',
            itemName: 'Plain Ring',
            name: 'Glow',
            img: null,
            activation: 'Bonus Action',
            range: null,
            target: null,
            toHit: null,
            save: null,
            damage: [],
            uses: null,
          },
        ],
      })
      sheet.spells[1].spells[2] = sheetSpell({
        ...sheet.spells[1].spells[2],
        concentration: true,
        text: TEXTS.shield,
      })

      const [cure, glow] = favoriteEntries(sheet)
      expect(cure).toMatchObject({
        kind: 'action',
        action: {
          id: 'cure',
          type: 'spell',
          level: 1,
          concentration: true,
          identified: true,
          text: TEXTS.shield,
        },
        // Named as its spell is, it needs no more said.
        note: undefined,
      })
      expect(glow).toMatchObject({
        kind: 'action',
        action: { id: 'ring', identified: false, text: TEXTS.ring },
        note: 'Plain Ring',
      })
    })

    it("shows an effect the Effects tab doesn't list, such as a condition's, as the favorite has it", () => {
      const sheet = fullerSheet({
        favorites: [
          {
            type: 'effect',
            id: 'dnd5epoisoned00',
            name: 'Poisoned',
            img: 'systems/dnd5e/icons/svg/statuses/poisoned.svg',
            disabled: false,
            suppressed: true,
          },
        ],
      })

      expect(favoriteEntries(sheet)).toEqual([
        {
          key: 'effect:dnd5epoisoned00',
          kind: 'effect',
          effect: {
            id: 'dnd5epoisoned00',
            name: 'Poisoned',
            img: 'systems/dnd5e/icons/svg/statuses/poisoned.svg',
            source: null,
            duration: null,
            disabled: false,
            text: null,
          },
          suppressed: true,
        },
      ])
    })

    it('leaves out a skill the sheet no longer has, and any favorite listed twice', () => {
      const sheet = fullerSheet({
        favorites: [
          { type: 'skill', id: 'xyz', name: 'Gone' },
          { type: 'skill', id: 'ath', name: 'Athletics' },
          { type: 'skill', id: 'ath', name: 'Athletics' },
        ],
      })

      expect(favoriteEntries(sheet).map(({ key }) => key)).toEqual([
        'skill:ath',
      ])
    })

    it('shows an item listed under each kind of action it has as its first row, with every activity of the rest', () => {
      const strike = activity('strike', 'Attack')
      const barbs = activity('cast-barbs', 'Silvery Barbs')
      const wisp = activity('cast-wisp', 'Starry Wisp')
      const sheet = fullerSheet({
        actions: [
          {
            id: 'reaction',
            label: 'Reactions',
            actions: [
              sheetAction({
                id: 'flame',
                name: 'Bardic Flame',
                activityName: 'Silvery Barbs',
                activities: [barbs],
              }),
            ],
          },
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'flame',
                name: 'Bardic Flame',
                toHit: 5,
                activities: [strike, wisp],
              }),
            ],
          },
        ],
        favorites: [item('flame', 'weapon')],
      })
      const [entry] = favoriteEntries(sheet)

      if (entry.kind !== 'action') throw new Error('an action')
      expect(entry.action).toMatchObject({ toHit: 5 })
      expect(entry.action).not.toHaveProperty('activityName')
      expect(entry.action.activities?.map(a => a.id)).toEqual([
        'strike',
        'cast-wisp',
        'cast-barbs',
      ])
    })

    it('has none for a sheet with none', () => {
      expect(favoriteEntries(fullerSheet())).toEqual([])
    })
  })

  it('rolls an activity favorite of a spell not prepared here only, and keeps its formula and area', () => {
    const sheet = fullerSheet()
    const [cantrips, ...spellbook] = sheet.spells
    const entries = favoriteEntries({
      ...sheet,
      spells: [
        {
          ...cantrips,
          spells: [
            sheetSpell({ id: 'breath', name: 'Dragon Breath', prepared: 0 }),
          ],
        },
        ...spellbook,
      ],
      favorites: [
        {
          type: 'activity',
          id: 'breathAttack',
          itemId: 'breath',
          itemType: 'spell',
          itemName: 'Dragon Breath',
          name: 'Exhale',
          img: null,
          activation: '1 Action',
          range: null,
          target: '15 ft Cone',
          toHit: 5,
          attackId: 'breathAttack',
          activity: {
            id: 'breathUse',
            type: 'utility',
            targets: {
              self: false,
              area: true,
              count: null,
              perLevel: null,
              affects: null,
            },
          },
          save: null,
          damage: [],
          uses: null,
          rollFormula: { formula: '1d6', name: 'Gust' },
          attackArea: { count: null, perLevel: null, affects: 'creature' },
        },
      ],
    })

    const [entry] = entries
    expect(entry.kind).toBe('action')
    expect(entry.kind === 'action' && entry.action).toMatchObject({
      attackId: null,
      activity: null,
      toHit: 5,
      rollFormula: { formula: '1d6', name: 'Gust' },
      attackArea: { count: null, perLevel: null, affects: 'creature' },
    })
  })

  describe('favoriteKeys', () => {
    it('marks the items, effects and skills that are favorites, and nothing for the rest', () => {
      expect(favoriteKeys(sheetFavorites())).toEqual(
        new Set(['item:warhammer', 'effect:blessed', 'skill:prc']),
      )
    })
  })

  describe('rollsAny', () => {
    it('says so of a class whose hit dice are spent, and of one whose only roll is a formula', () => {
      const sheet = fullerSheet({
        favorites: [item('fighter', 'class'), item('lantern', 'loot')],
      })
      const [fighter] = favoriteEntries(sheet)
      expect(rollsAny([fighter])).toBe(true)
      expect(
        rollsAny(
          favoriteEntries({
            ...sheet,
            classes: sheet.classes.map(entry => ({ ...entry, hitDice: null })),
          }),
        ),
      ).toBe(false)

      const lantern = sheetAction({
        id: 'lantern',
        name: 'Lantern',
        rollFormula: { formula: '1d4', name: 'Light radius' },
      })
      expect(
        rollsAny(
          favoriteEntries(
            fullerSheet({
              actions: [{ id: 'action', label: 'Actions', actions: [lantern] }],
              favorites: [
                {
                  type: 'activity',
                  id: 'lanternUse',
                  itemId: 'lantern',
                  itemType: 'loot',
                  itemName: 'Lantern',
                  name: 'Light',
                  img: null,
                  activation: null,
                  range: null,
                  target: null,
                  toHit: null,
                  save: null,
                  damage: [],
                  uses: null,
                  rollFormula: lantern.rollFormula,
                },
              ],
            }),
          ),
        ),
      ).toBe(true)
    })

    it('says whether any favorite rolls, as an attack, damage or a check does', () => {
      const sheet = fullerSheet({ favorites: sheetFavorites() })
      const entries = favoriteEntries(sheet)
      const kinds = (...keys: string[]) =>
        entries.filter(entry => keys.includes(entry.key))

      expect(rollsAny(entries)).toBe(true)
      expect(rollsAny(kinds('skill:prc'))).toBe(true)
      expect(rollsAny(kinds('activity:cast-fireball'))).toBe(true)
      expect(
        rollsAny(kinds('resource:primary', 'effect:blessed', 'slots:spell1')),
      ).toBe(false)
      expect(
        rollsAny(
          favoriteEntries(
            fullerSheet({ favorites: [item('action-surge', 'feat')] }),
          ),
        ),
      ).toBe(false)
      expect(rollsAny([])).toBe(false)
    })

    it('says so of one whose only rolls are its later activities, such as Flaming Sphere after its summoning', () => {
      const sheet = fullerSheet({ favorites: [item('sphere', 'spell')] })
      const [cantrips, ...spellbook] = sheet.spells
      sheet.spells = [
        {
          ...cantrips,
          spells: [
            sheetSpell({
              id: 'sphere',
              name: 'Flaming Sphere',
              activities: [
                {
                  id: 'call',
                  name: 'Summon',
                  type: 'summon',
                  activation: '1 Action',
                  range: null,
                  target: null,
                  toHit: null,
                  save: null,
                  damage: [],
                  uses: null,
                },
                {
                  id: 'ram',
                  name: 'Ram',
                  type: 'save',
                  activation: '1 Bonus Action',
                  range: null,
                  target: null,
                  toHit: null,
                  save: { ability: 'DEX', dc: 14 },
                  damage: [{ formula: '2d6', type: 'Fire', healing: false }],
                  uses: null,
                },
              ],
            }),
          ],
        },
        ...spellbook,
      ]

      expect(rollsAny(favoriteEntries(sheet))).toBe(true)
    })

    it('says so of a spell, something carried or a feature that rolls, but not one not identified', () => {
      const sheet = fullerSheet()
      const damage = [{ formula: '1d10', type: 'Fire', healing: false }]
      const [cantrips, ...spellbook] = sheet.spells
      sheet.spells = [
        {
          ...cantrips,
          spells: [
            sheetSpell({ id: 'bolt', name: 'Fire Bolt', toHit: 5, damage }),
          ],
        },
        ...spellbook,
      ]
      const [weapons, ...kinds] = sheet.inventory.sections
      sheet.inventory.sections = [
        {
          ...weapons,
          items: [
            { ...weapons.items[0], toHit: 7, damage },
            { ...weapons.items[1], identified: false, toHit: 7, damage },
          ],
        },
        ...kinds,
      ]
      sheet.features[0].features[0] = {
        ...sheet.features[0].features[0],
        damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
      }
      const rolls = (...favorites: SheetFavorite[]) =>
        rollsAny(favoriteEntries({ ...sheet, actions: [], favorites }))

      expect(rolls(item('bolt', 'spell'))).toBe(true)
      expect(rolls(item('warhammer', 'weapon'))).toBe(true)
      expect(rolls(item('second-wind', 'feat'))).toBe(true)
      expect(rolls(item('handaxe', 'weapon'))).toBe(false)
      expect(rolls(item('shield', 'spell'), item('action-surge', 'feat'))).toBe(
        false,
      )
    })
  })

  it("takes the description of an activity of a feature from the feature's", () => {
    const sheet = fullerSheet({
      favorites: [
        {
          type: 'activity',
          id: 'see',
          itemId: 'darkvision',
          itemType: 'feat',
          itemName: 'Darkvision',
          name: 'See',
          img: null,
          activation: null,
          range: null,
          target: null,
          toHit: null,
          save: null,
          damage: [],
          uses: null,
        },
      ],
    })
    sheet.features[1].features[0].text = TEXTS.fighter

    expect(favoriteEntries(sheet)).toMatchObject([
      { kind: 'action', action: { text: TEXTS.fighter }, note: 'Darkvision' },
    ])
  })
})
