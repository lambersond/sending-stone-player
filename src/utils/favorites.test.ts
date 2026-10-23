/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  favoriteEntries,
  favoriteKeys,
  foldName,
  resourceNote,
  rollsAny,
} from './favorites'
import { sheetActions } from './sheet-actions'
import {
  castingSheet,
  checkingSheet,
  fullerSheet,
  mockTableDamage,
  sheetAction,
  sheetFavorites,
  sheetSpell,
  TEXTS,
  WAND_LEVELS,
} from '@/mocks/sending-stone'
import type {
  CharacterSheet,
  SheetFavorite,
  SheetFeature,
  SheetResourceFavorite,
} from '@/types/sending-stone'

/** An item made a favorite, by its id. */
const item = (id: string, itemType = 'loot'): SheetFavorite => ({
  type: 'item',
  id,
  itemType,
  name: id,
  img: null,
})

/** An old-style resource, standing for the feature the module says, if it says. */
const resource = (
  id: string,
  name: string,
  itemId?: string | null,
): SheetResourceFavorite => ({
  type: 'resource',
  id,
  name,
  uses: { value: 0, max: 1, recovery: 'Short Rest' },
  ...(itemId !== undefined && { itemId }),
})

/** A feature listed among the rest, passive and with no uses. */
const feature = (id: string, name: string): SheetFeature => ({
  id,
  name,
  img: null,
  kind: null,
  requirements: null,
  activation: null,
  passive: true,
  uses: null,
  text: null,
})

/** What Thorin can roll and use, with these favorites. */
const actionsWith = (...favorites: SheetFavorite[]) =>
  sheetActions(fullerSheet({ favorites }))

/** The sheet's own action of an id, as the Actions tab lists it. */
const actionOf = (sheet: CharacterSheet, id: string) =>
  sheet.actions
    .flatMap(section => section.actions)
    .find(action => action.id === id)

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

    it('keeps the copy of the spell a Cast made a favorite casts, whose later activities are used beneath it, from module 0.20.0', () => {
      const cast = {
        level: 1,
        concentration: false,
        charges: 1,
        short: false,
        levels: WAND_LEVELS,
      }
      const favorite = (id: string, spellId?: string): SheetFavorite => ({
        type: 'activity',
        id,
        itemId: 'mm-wand',
        itemType: 'consumable',
        itemName: 'Wand of Magic Missiles',
        name: 'Magic Missile',
        img: null,
        activation: 'Action',
        range: '120 ft',
        target: null,
        toHit: null,
        save: null,
        damage: [{ formula: '1d4 + 1', type: 'Force', healing: false }],
        uses: null,
        cast,
        ...(spellId && { spellId }),
      })
      const [kept, older] = favoriteEntries(
        castingSheet({
          favorites: [favorite('cast-mm', 'mm'), favorite('cast-old')],
        }),
      )
      expect(kept).toMatchObject({
        kind: 'action',
        action: { id: 'mm-wand', cast, spellId: 'mm' },
      })
      expect(older.kind === 'action' && older.action).not.toHaveProperty(
        'spellId',
      )
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

  it('keeps the check a favorite activity asks for, and what one that uses another spends, from module 0.21.0', () => {
    const sheet = checkingSheet()
    const [fastHands] = sheet.actions[1].actions
    const [, thief] = fastHands.activities!
    const [, free] = sheet.actions[0].actions[2].activities!
    const favorite = (
      itemId: string,
      itemName: string,
      itemType: string,
      activity: typeof thief,
    ): SheetFavorite => ({
      ...activity,
      type: 'activity',
      itemId,
      itemType,
      itemName,
      img: null,
    })
    const entries = favoriteEntries({
      ...sheet,
      favorites: [
        favorite('fast-hands', 'Fast Hands', 'feat', thief),
        favorite('bless', 'Bless', 'spell', free),
      ],
    })

    const [check, forward] = entries.map(entry =>
      entry.kind === 'action' ? entry.action : undefined,
    )
    expect(check).toMatchObject({
      id: 'fast-hands',
      activity: thief.activity,
      check: thief.check,
    })
    expect(check).not.toHaveProperty('forward')
    expect(forward).toMatchObject({
      id: 'bless',
      activity: free.activity,
      consumesSlot: false,
      forward: { charges: 1, short: false },
    })
    expect(forward).not.toHaveProperty('check')
    // A check of the player's own is something to roll.
    expect(rollsAny(entries.slice(0, 1))).toBe(true)
    expect(rollsAny(entries.slice(1))).toBe(false)
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

  it("rolls an activity favorite of a spell its item can't cast now here only", () => {
    const sheet = fullerSheet()
    const [cantrips, ...spellbook] = sheet.spells
    const [entry] = favoriteEntries({
      ...sheet,
      spells: [
        {
          ...cantrips,
          spells: [
            sheetSpell({
              id: 'ray',
              name: 'Ray of Frost',
              castFrom: {
                id: 'staff',
                name: 'Staff of Frost',
                usable: false,
                attune: true,
              },
            }),
          ],
        },
        ...spellbook,
      ],
      favorites: [
        {
          type: 'activity',
          id: 'rayshot',
          itemId: 'ray',
          itemType: 'spell',
          itemName: 'Ray of Frost',
          name: 'Ray of Frost',
          img: null,
          activation: '1 Action',
          range: null,
          target: null,
          toHit: 6,
          attackId: 'rayshot',
          save: null,
          damage: [{ formula: '1d8', type: 'Cold', healing: false }],
          uses: null,
        },
      ],
    })

    expect(entry.kind === 'action' && entry.action).toMatchObject({
      attackId: null,
      activity: null,
      toHit: 6,
    })
  })

  it('keeps an activity favorite’s damage on its own only while the game may make it, from module 0.36.0', () => {
    const sheet = fullerSheet()
    const [cantrips, ...spellbook] = sheet.spells
    const plan = mockTableDamage()
    const ray = {
      type: 'activity' as const,
      id: 'rayshot',
      itemId: 'ray',
      itemType: 'spell',
      itemName: 'Ray of Frost',
      name: 'Ray of Frost',
      img: null,
      activation: '1 Action',
      range: null,
      target: null,
      toHit: 6,
      attackId: 'rayshot',
      save: null,
      damage: [{ formula: '1d8', type: 'Cold', healing: false }],
      tableDamage: plan,
      uses: null,
    }
    const entriesWith = (prepared: 0 | 1) =>
      favoriteEntries({
        ...sheet,
        spells: [
          {
            ...cantrips,
            spells: [sheetSpell({ id: 'ray', name: 'Ray of Frost', prepared })],
          },
          ...spellbook,
        ],
        favorites: [ray],
      })

    const [made] = entriesWith(1)
    expect(made.kind === 'action' && made.action.tableDamage).toBe(plan)
    const [here] = entriesWith(0)
    expect(here.kind === 'action' && here.action).not.toHaveProperty(
      'tableDamage',
    )
  })

  describe('favoriteKeys', () => {
    it('marks the items, effects and skills that are favorites, and nothing for the rest', () => {
      expect(favoriteKeys(sheetFavorites())).toEqual(
        new Set(['item:warhammer', 'effect:blessed', 'skill:prc']),
      )
    })

    it('marks the features resources stand for, given the entries, from module 0.23.0', () => {
      const favorites = [
        resource('primary', 'Superiority Dice'),
        resource('secondary', 'Second Wind', 'second-wind'),
        resource('tertiary', 'Luck', 'darkvision'),
      ]
      const entries = favoriteEntries(fullerSheet({ favorites }))

      expect(favoriteKeys(favorites, entries)).toEqual(
        new Set(['item:second-wind', 'item:darkvision']),
      )
      expect(favoriteKeys(favorites)).toEqual(new Set())
    })
  })

  describe('resources that stand for features, from module 0.23.0', () => {
    it("shows a resource the module links as the feature's action, the sheet's own, with the resource", () => {
      const linked = resource('secondary', 'Second Wind', 'second-wind')
      const sheet = fullerSheet({ favorites: [linked] })
      const [entry] = favoriteEntries(sheet)

      expect(entry).toEqual({
        key: 'item:second-wind',
        kind: 'action',
        action: actionOf(sheet, 'second-wind'),
        resource: linked,
      })
      expect(entry.kind === 'action' && entry.action).toBe(
        actionOf(sheet, 'second-wind'),
      )
    })

    it('shows one linked to a feature with no action as the feature, with the resource', () => {
      const linked = resource('tertiary', 'Keen Eyes', 'darkvision')
      const sheet = fullerSheet({ favorites: [linked] })

      expect(favoriteEntries(sheet)).toEqual([
        {
          key: 'item:darkvision',
          kind: 'feature',
          feature: sheet.features[1].features[0],
          resource: linked,
        },
      ])
    })

    it('keeps a counter where the module links none, or a feature the sheet no longer has', () => {
      const none = resource('secondary', 'Second Wind', null)
      const stale = resource('tertiary', 'Second Wind', 'gone')
      const sheet = fullerSheet({ favorites: [none, stale] })

      expect(favoriteEntries(sheet)).toEqual([
        { key: 'resource:secondary', kind: 'resource', resource: none },
        { key: 'resource:tertiary', kind: 'resource', resource: stale },
      ])
    })

    it('finds the feature by its name, folded, where an older module names none', () => {
      const sheet = fullerSheet()
      sheet.features.push({
        id: 'other',
        label: 'Other Features',
        text: null,
        features: [
          feature('ward', "Warden's Ward"),
          feature('turn', 'Channel Divinity: Turn Undead'),
          feature('convert', 'Convert Sorcery Points'),
        ],
      })
      const keysFor = (name: string) =>
        favoriteEntries({ ...sheet, favorites: [resource('primary', name)] })
          .map(({ key }) => key)
          .join(' ')

      expect(keysFor('second  wind')).toBe('item:second-wind')
      expect(keysFor(' SECOND WIND ')).toBe('item:second-wind')
      expect(keysFor('Warden\u2019s Ward')).toBe('item:ward')
      expect(keysFor('Warden\u02BCs  ward')).toBe('item:ward')
      // Never a feature whose name only begins or ends with it.
      expect(keysFor('Channel Divinity')).toBe('resource:primary')
      expect(keysFor('Sorcery Points')).toBe('resource:primary')
      expect(foldName('\uFF37arden\u2019s\u00A0Ward')).toBe("warden's ward")
    })

    it('links a feature to one resource at most, the first: a later one is a counter', () => {
      const first = resource('primary', 'Second Wind')
      const second = resource('secondary', 'Second Wind')
      const named = resource('tertiary', 'Second Wind', 'second-wind')

      expect(
        favoriteEntries(fullerSheet({ favorites: [first, second, named] })).map(
          ({ key }) => key,
        ),
      ).toEqual(['item:second-wind', 'resource:secondary', 'resource:tertiary'])

      // With another feature of the name, the second takes that one, the next the sheet lists.
      const sheet = fullerSheet({ favorites: [first, second, named] })
      sheet.features.push({
        id: 'other',
        label: 'Other Features',
        text: null,
        features: [feature('wind-again', 'Second Wind')],
      })
      expect(favoriteEntries(sheet).map(({ key }) => key)).toEqual([
        'item:second-wind',
        'item:wind-again',
        'resource:tertiary',
      ])
    })

    it("shows the feature once, at the resource's place, but keeps a favorite of one of its activities", () => {
      const linked = resource('secondary', 'Second Wind', 'second-wind')
      const sheet = fullerSheet({
        favorites: [
          linked,
          item('warhammer', 'weapon'),
          item('second-wind', 'feat'),
          {
            type: 'activity',
            id: 'breather',
            itemId: 'second-wind',
            itemType: 'feat',
            itemName: 'Second Wind',
            name: 'Breather',
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

      expect(
        favoriteEntries(sheet).map(entry => [
          entry.key,
          'resource' in entry && entry.resource?.id,
        ]),
      ).toEqual([
        ['item:second-wind', 'secondary'],
        ['item:warhammer', false],
        ['activity:breather', false],
      ])
    })

    it('leaves the actions rolled and used as they were, with their own uses', () => {
      const linked = actionsWith(
        resource('secondary', 'Second Wind', 'second-wind'),
        item('second-wind', 'feat'),
      )
      const plain = actionsWith(item('second-wind', 'feat'))

      expect(linked).toHaveLength(plain.length)
      expect(linked.map(action => action.uses)).toEqual(
        plain.map(action => action.uses),
      )
      expect(
        linked
          .filter(action => action.id === 'second-wind')
          .map(action => action.uses),
      ).toEqual([
        { value: 1, max: 1, recovery: 'Short Rest, Long Rest' },
        { value: 1, max: 1, recovery: 'Short Rest, Long Rest' },
      ])
    })

    it("names the resource first where the feature's name is another", () => {
      expect(resourceNote(resource('primary', 'Ki'), 'Flurry of Blows')).toBe(
        'Ki',
      )
      expect(
        resourceNote(resource('primary', 'second  wind'), 'Second Wind'),
      ).toBeUndefined()
      expect(resourceNote(undefined, 'Second Wind')).toBeUndefined()
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
