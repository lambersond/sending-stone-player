/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  availableRollKinds,
  checkDamage,
  checkRoll,
  isDying,
  rollStatus,
  toCommand,
  toRollRequestView,
  type HeldRollRequest,
} from './roll-requests'
import {
  characterSheet,
  combat,
  combatant,
  fullerSheet,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
} from '@/mocks/sending-stone'
import type { RollRequestInput } from '@/types/roll'
import type {
  CommandResult,
  DamagePreview,
  SheetAction,
} from '@/types/sending-stone'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

const request = (fields: Partial<RollRequestInput>): RollRequestInput => ({
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
  ...fields,
})

const held = (fields: Partial<HeldRollRequest> = {}): HeldRollRequest => ({
  id: 'req-1',
  actorId: 'actor-thorin',
  kind: 'skill',
  payload: request({}),
  status: 'pending',
  result: null,
  createdAt: ago(1000),
  claimedAt: null,
  ...fields,
})

/** A warhammer attack, with these fields instead. */
const attackRequest = (fields: Partial<RollRequestInput> = {}) =>
  request({
    kind: 'attack',
    key: undefined,
    item: 'warhammer',
    activity: 'warhammerAttack',
    ...fields,
  })

/** At this combatant of the combat. */
const targetAt = (combatantId: string) => ({
  target: { combatId: 'cmbt1', combatantId },
})

/** The damage of the attack req-1, with these dice. */
const damageRequest = (dice: RollRequestInput['dice']) =>
  request({ kind: 'damage', key: undefined, use: 'req-1', dice })

/** A part of damage the game made, totalling this, or saying no total. */
const damagePart = (total: number | null) => ({
  formula: '1d8 + 4',
  total,
  dice: [{ faces: 8, results: [{ result: 5, active: true }] }],
})

/** A spell with an activity the game uses. */
const spell = (
  id: string,
  name: string,
  level: number,
  activity: NonNullable<SheetAction['activity']>,
) => sheetAction({ id, name, type: 'spell', level, activity })

/** Whom an activity is used at: one creature, unless said otherwise. */
const targets = (
  fields: Partial<NonNullable<SheetAction['activity']>['targets']>,
) => ({
  self: false,
  area: false,
  count: null,
  perLevel: null,
  affects: 'creature',
  ...fields,
})

/** A cleric with Fireball, Cure Wounds and Bless, and Second Wind, with slots as given. */
const cleric = (spell1 = 2, spell3 = 1) =>
  fullerSheet({
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          spell('fireball', 'Fireball', 3, {
            id: 'blast',
            type: 'save',
            targets: targets({ area: true }),
          }),
          spell('cure', 'Cure Wounds', 1, {
            id: 'mend',
            type: 'heal',
            targets: targets({ count: 1, affects: 'ally' }),
          }),
          spell('bless', 'Bless', 1, {
            id: 'blessing',
            type: 'utility',
            targets: targets({ count: 3, perLevel: 1 }),
          }),
          sheetAction({
            id: 'wind',
            name: 'Second Wind',
            activity: {
              id: 'breather',
              type: 'heal',
              targets: targets({ self: true, affects: 'self' }),
            },
          }),
        ],
      },
    ],
    spells: [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: spell1, max: 4, level: 1 },
        spells: [
          sheetSpell({ id: 'cure', name: 'Cure Wounds' }),
          sheetSpell({ id: 'bless', name: 'Bless' }),
        ],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 0, max: 3, level: 2 },
        spells: [],
      },
      {
        id: 'spell3',
        label: '3rd Level',
        slots: { value: spell3, max: 2, level: 3 },
        spells: [sheetSpell({ id: 'fireball', name: 'Fireball', level: 3 })],
      },
    ],
  })

/** A use of an item's activity at combatants of the combat, by their ids. */
const useRequest = (
  item: string,
  activity: string,
  at: string[],
  fields: Partial<RollRequestInput> = {},
) =>
  request({
    kind: 'use',
    key: undefined,
    item,
    activity,
    targets: at.map(combatantId => ({ combatId: 'cmbt1', combatantId })),
    dice: [],
    ...fields,
  })

/** A save answering what the game asked, made, as its player is told of it. */
const answered = (outcome: 'success' | 'failure' | null) =>
  toRollRequestView(
    held({
      kind: 'save',
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible: true,
        rolls: [
          {
            formula: '1d20 + 4',
            total: 18,
            dice: [{ faces: 20, results: [{ result: 14, active: true }] }],
          },
        ],
        outcome,
      },
    }),
    NOW,
  )

describe('utils/roll-requests', () => {
  describe('availableRollKinds', () => {
    const campaign = {
      rollsEnabled: true,
      rollKinds: ['save', 'skill', 'attack', 'heal'],
      bridgePolledAt: ago(10_000),
    }

    it('offers the rolls the game takes, while the module is fetching them', () => {
      expect(availableRollKinds(campaign, NOW)).toEqual([
        'skill',
        'save',
        'attack',
      ])
    })

    it('offers none while the Gamemaster has them off, or the module has stopped fetching', () => {
      expect(
        availableRollKinds({ ...campaign, rollsEnabled: false }, NOW),
      ).toEqual([])
      expect(
        availableRollKinds({ ...campaign, bridgePolledAt: ago(45_000) }, NOW),
      ).toEqual([])
      expect(
        availableRollKinds({ ...campaign, bridgePolledAt: null }, NOW),
      ).toEqual([])
    })
  })

  describe('checkRoll', () => {
    const sheet = fullerSheet({ favorites: sheetFavorites() })

    it('lets the character roll a skill, ability, save or tool its sheet has', () => {
      expect(checkRoll(request({}), sheet, [], 'actor-thorin')).toBeUndefined()
      expect(
        checkRoll(
          request({ kind: 'save', key: 'con' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          request({ kind: 'ability', key: 'str' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'thief' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
    })

    it('refuses what the sheet lacks, or a roll without a sheet', () => {
      expect(
        checkRoll(request({ key: 'xyz' }), sheet, [], 'actor-thorin'),
      ).toBe('unknown')
      expect(
        checkRoll(
          request({ kind: 'save', key: 'luck' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'herb' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'thief' }),
          characterSheet(),
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(checkRoll(request({}), undefined, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })

    it('lets only a dying character roll a death save', () => {
      const death = request({ kind: 'death', key: undefined })
      const dying = characterSheet({
        hp: { value: 0, max: 44, temp: 0 },
        deathSaves: { success: 1, failure: 2 },
      })
      expect(checkRoll(death, dying, [], 'actor-thorin')).toBeUndefined()
      expect(checkRoll(death, characterSheet(), [], 'actor-thorin')).toBe(
        'not-dying',
      )
    })

    it('lets the character roll initiative only in the combat, and only once', () => {
      const initiative = request({
        kind: 'initiative',
        key: undefined,
        combatId: 'cmbt1',
      })
      const waiting = combat({
        combatants: [
          combatant({
            id: 'c-thorin',
            character: 'actor-thorin',
            initiative: null,
          }),
        ],
      })
      expect(
        checkRoll(initiative, sheet, [waiting], 'actor-thorin'),
      ).toBeUndefined()
      expect(checkRoll(initiative, sheet, [combat()], 'actor-thorin')).toBe(
        'already-rolled',
      )
      expect(checkRoll(initiative, sheet, [waiting], 'actor-vex')).toBe(
        'not-in-combat',
      )
      expect(checkRoll(initiative, sheet, [], 'actor-thorin')).toBe(
        'not-in-combat',
      )
    })
  })

  describe('checkRoll for an attack', () => {
    const sheet = fullerSheet({ favorites: sheetFavorites() })
    const fight = combat({
      combatants: [
        combatant({ id: 'c-goblin', name: 'Goblin' }),
        combatant({ id: 'c-lurker', name: 'Lurker', hidden: true }),
        combatant({ id: 'c-thorin', character: 'actor-thorin' }),
      ],
    })

    /** Thorin with a Fire Bolt staff among his favorites, and Guiding Bolt's slots as given. */
    const caster = (slots: { value: number; max: number }) =>
      fullerSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'guidingBolt',
                name: 'Guiding Bolt',
                type: 'spell',
                level: 1,
                toHit: 5,
                attackId: 'bolt',
              }),
            ],
          },
        ],
        spells: [
          {
            id: 'spell1',
            label: '1st Level',
            slots: { ...slots, level: 1 },
            spells: [sheetSpell({ id: 'guidingBolt', name: 'Guiding Bolt' })],
          },
        ],
        favorites: [
          {
            type: 'activity',
            id: 'fireBolt',
            itemId: 'staff',
            itemType: 'weapon',
            itemName: 'Staff of Embers',
            name: 'Fire Bolt',
            img: null,
            activation: 'Action',
            range: '120 ft',
            target: null,
            toHit: 5,
            attackId: 'fireBolt',
            save: null,
            damage: [{ formula: '1d10', type: 'Fire', healing: false }],
            uses: { value: 0, max: 3, recovery: 'Dawn' },
          },
        ],
      })

    it("lets the character attack with an action's attack, at a combatant its player sees, or none", () => {
      expect(
        checkRoll(attackRequest(), sheet, [], 'actor-thorin'),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest(targetAt('c-goblin')),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest({ target: null }),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest({ item: 'handaxe', activity: 'handaxeAttack' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
    })

    it("lets the character attack with an attack that's one of an item's later activities", () => {
      const blade = fullerSheet({
        actions: [
          {
            id: 'bonus',
            label: 'Bonus Actions',
            actions: [
              sheetAction({
                id: 'blade',
                name: 'Flame Blade',
                type: 'spell',
                level: 0,
                activities: [
                  {
                    id: 'evoke',
                    name: 'Evoke Blade',
                    type: 'utility',
                    activation: 'Bonus Action',
                    range: 'Self',
                    target: null,
                    toHit: null,
                    attackId: null,
                    save: null,
                    damage: [],
                    uses: null,
                  },
                  {
                    id: 'slash',
                    name: 'Attack',
                    type: 'attack',
                    activation: 'Action',
                    range: 'reach 5 ft',
                    target: null,
                    toHit: 6,
                    attackId: 'slash',
                    save: null,
                    damage: [{ formula: '3d6', type: 'Fire', healing: false }],
                    uses: null,
                  },
                ],
              }),
            ],
          },
        ],
      })

      expect(
        checkRoll(
          attackRequest({ item: 'blade', activity: 'slash' }),
          blade,
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
      expect(
        checkRoll(
          attackRequest({ item: 'blade', activity: 'evoke' }),
          blade,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
    })

    it('refuses an attack the sheet has no such action for', () => {
      expect(
        checkRoll(
          attackRequest({ activity: 'thrown' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(
        checkRoll(
          attackRequest({ item: 'handaxe' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      // Fire Breath has no attack to make.
      expect(
        checkRoll(
          attackRequest({ item: 'breath', activity: 'breath' }),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
      expect(checkRoll(attackRequest(), undefined, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })

    it('refuses an attack with an item not identified yet', () => {
      const unknown = fullerSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'warhammer',
                name: 'Warhammer',
                attackId: 'warhammerAttack',
                identified: false,
              }),
            ],
          },
        ],
      })
      expect(checkRoll(attackRequest(), unknown, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })

    it('refuses an attack at a combatant its player cannot see, or not in the combat', () => {
      expect(
        checkRoll(
          attackRequest(targetAt('c-lurker')),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBe('target')
      expect(
        checkRoll(
          attackRequest(targetAt('c-dragon')),
          sheet,
          [fight],
          'actor-thorin',
        ),
      ).toBe('target')
      expect(
        checkRoll(
          attackRequest(targetAt('c-goblin')),
          sheet,
          [],
          'actor-thorin',
        ),
      ).toBe('target')
    })

    it('lets the character attack with a weapon carried, or a spell from its spellbook, but one not prepared', () => {
      const bolt = { toHit: 5, attackId: 'bolt', damage: [] }
      const lists = caster({ value: 1, max: 2 })
      lists.spells[0].spells = [
        sheetSpell({
          id: 'guidingBolt',
          name: 'Guiding Bolt',
          prepared: 1,
          ...bolt,
        }),
        sheetSpell({
          id: 'witchBolt',
          name: 'Witch Bolt',
          prepared: 0,
          ...bolt,
        }),
      ]
      lists.actions = []
      lists.inventory.sections[0].items[1] = sheetItem({
        id: 'handaxe',
        name: 'Handaxe',
        type: 'weapon',
        equipped: false,
        toHit: 7,
        attackId: 'handaxeAttack',
      })
      const check = (fields: Partial<RollRequestInput>) =>
        checkRoll(attackRequest(fields), lists, [], 'actor-thorin')

      expect(check({ item: 'guidingBolt', activity: 'bolt' })).toBeUndefined()
      expect(check({ item: 'handaxe', activity: 'handaxeAttack' })).toBe(
        undefined,
      )
      // The game would have it prepared first.
      expect(check({ item: 'witchBolt', activity: 'bolt' })).toBe('unknown')
      expect(check({ item: 'warhammer', activity: 'warhammerAttack' })).toBe(
        'unknown',
      )
    })

    it('refuses a spell attack with no spell slot left, and lets a favorite activity attack', () => {
      const bolt = attackRequest({ item: 'guidingBolt', activity: 'bolt' })
      expect(
        checkRoll(bolt, caster({ value: 1, max: 2 }), [], 'actor-thorin'),
      ).toBeUndefined()
      expect(
        checkRoll(bolt, caster({ value: 0, max: 2 }), [], 'actor-thorin'),
      ).toBe('slots')
      // The game checks the uses it spends, if any: a staff's attack may spend none.
      expect(
        checkRoll(
          attackRequest({ item: 'staff', activity: 'fireBolt' }),
          caster({ value: 0, max: 2 }),
          [],
          'actor-thorin',
        ),
      ).toBeUndefined()
    })
  })

  describe('checkRoll for an attack with choices', () => {
    const fight = combat({
      combatants: [combatant({ id: 'c-goblin', name: 'Goblin' })],
    })
    const sheet = fullerSheet({
      actions: [
        {
          id: 'action',
          label: 'Actions',
          actions: [
            sheetAction({
              id: 'handaxe',
              name: 'Handaxe',
              type: 'weapon',
              attackId: 'chop',
              attackModes: [
                { value: 'oneHanded', label: 'One-Handed' },
                { value: 'thrown', label: 'Thrown' },
              ],
            }),
            sheetAction({
              id: 'bow',
              name: 'Longbow',
              type: 'weapon',
              attackId: 'shoot',
              ammunition: [
                { id: 'arrows', name: 'Arrows', quantity: 12 },
                { id: 'spent', name: 'Broken Arrows', quantity: 0 },
              ],
            }),
            sheetAction({
              id: 'orb',
              name: 'Chromatic Orb',
              type: 'spell',
              level: 1,
              attackId: 'orbCast',
            }),
          ],
        },
      ],
      spells: [
        {
          id: 'spell1',
          label: '1st Level',
          slots: { value: 1, max: 2, level: 1 },
          spells: [sheetSpell({ id: 'orb', name: 'Chromatic Orb' })],
        },
        {
          id: 'spell2',
          label: '2nd Level',
          slots: { value: 0, max: 2, level: 2 },
          spells: [],
        },
      ],
    })
    const check = (fields: Partial<RollRequestInput>) =>
      checkRoll(
        attackRequest({ ...targetAt('c-goblin'), ...fields }),
        sheet,
        [fight],
        'actor-thorin',
      )

    it('lets an attack be made in a mode the weapon has, with its ammunition left, from a slot left', () => {
      expect(
        check({ item: 'handaxe', activity: 'chop', attackMode: 'thrown' }),
      ).toBeUndefined()
      expect(
        check({ item: 'bow', activity: 'shoot', ammunition: 'arrows' }),
      ).toBeUndefined()
      expect(
        check({ item: 'orb', activity: 'orbCast', slot: 'spell1' }),
      ).toBeUndefined()
    })

    it.each([
      [
        'a mode the weapon has not',
        { item: 'handaxe', activity: 'chop', attackMode: 'twoHanded' },
        'mode',
      ],
      [
        'a mode for a weapon with one',
        { item: 'bow', activity: 'shoot', attackMode: 'thrown' },
        'mode',
      ],
      [
        'ammunition used up',
        { item: 'bow', activity: 'shoot', ammunition: 'spent' },
        'ammo',
      ],
      [
        'ammunition the weapon does not fire',
        { item: 'handaxe', activity: 'chop', ammunition: 'arrows' },
        'ammo',
      ],
      [
        'a slot with none left',
        { item: 'orb', activity: 'orbCast', slot: 'spell2' },
        'slot',
      ],
      [
        'a slot the character has not',
        { item: 'orb', activity: 'orbCast', slot: 'spell5' },
        'slot',
      ],
    ])('refuses an attack with %s', (_name, fields, reason) => {
      expect(check(fields as Partial<RollRequestInput>)).toBe(reason)
    })
  })

  describe('checkRoll for a use', () => {
    const fight = combat({
      combatants: [
        combatant({ id: 'c-goblin', name: 'Goblin' }),
        combatant({ id: 'c-hob', name: 'Hobgoblin' }),
        combatant({ id: 'c-ogre', name: 'Ogre' }),
        combatant({ id: 'c-lurker', name: 'Lurker', hidden: true }),
        combatant({ id: 'c-vex', name: 'Vex', playerOwned: true }),
        combatant({ id: 'c-thorin', character: 'actor-thorin' }),
      ],
    })
    const check = (input: RollRequestInput, sheet = cleric()) =>
      checkRoll(input, sheet, [fight], 'actor-thorin')

    it('lets a spell or feature be used at the combatants picked, with a slot left', () => {
      expect(
        check(useRequest('fireball', 'blast', ['c-goblin', 'c-hob'])),
      ).toBeUndefined()
      expect(check(useRequest('cure', 'mend', ['c-vex']))).toBeUndefined()
      expect(check(useRequest('wind', 'breather', []))).toBeUndefined()
      expect(check(useRequest('fireball', 'blast', []))).toBeUndefined()
      expect(
        check(useRequest('cure', 'mend', ['c-vex'], { slot: 'spell3' })),
      ).toBeUndefined()
    })

    it('takes more targets for a spell that takes more cast higher, chosen or by default', () => {
      const four = ['c-goblin', 'c-hob', 'c-ogre', 'c-vex']
      expect(
        check(useRequest('bless', 'blessing', four.slice(0, 3))),
      ).toBeUndefined()
      expect(check(useRequest('bless', 'blessing', four))).toBe('target')
      expect(
        check(useRequest('bless', 'blessing', four, { slot: 'spell3' })),
      ).toBeUndefined()
      // With no 1st-level slot left, Bless is cast at 3rd, as dnd5e would.
      expect(
        check(useRequest('bless', 'blessing', four), cleric(0, 1)),
      ).toBeUndefined()
    })

    it.each([
      [
        'an activity the action is not used through',
        useRequest('fireball', 'other', []),
        'unknown',
      ],
      ['an attack', useRequest('cure', 'warhammerAttack', []), 'unknown'],
      [
        'a slot below the spell',
        useRequest('fireball', 'blast', [], { slot: 'spell1' }),
        'slot',
      ],
      [
        'a slot with none left',
        useRequest('cure', 'mend', ['c-vex'], { slot: 'spell2' }),
        'slot',
      ],
      [
        'more targets than it takes',
        useRequest('cure', 'mend', ['c-vex', 'c-hob']),
        'target',
      ],
      [
        'a target for one used on its user',
        useRequest('wind', 'breather', ['c-vex']),
        'target',
      ],
      [
        'a combatant its player cannot see',
        useRequest('fireball', 'blast', ['c-lurker']),
        'target',
      ],
      [
        'a combatant not in the combat',
        useRequest('fireball', 'blast', ['c-nobody']),
        'target',
      ],
    ])('refuses a use with %s', (_name, input, reason) => {
      expect(check(input)).toBe(reason)
    })

    it('refuses a spell with no slot left', () => {
      expect(check(useRequest('fireball', 'blast', []), cleric(2, 0))).toBe(
        'slots',
      )
    })

    it("lets any of an item's activities be used, one spending no slot with none left too", () => {
      const cast = {
        id: 'guard',
        type: 'utility' as const,
        targets: targets({ self: true, affects: 'self' }),
      }
      const lists = cleric(2, 0)
      lists.actions[0].actions.push(
        sheetAction({
          id: 'guardians',
          name: 'Spirit Guardians',
          type: 'spell',
          level: 3,
          activity: cast,
          activities: [
            {
              id: 'guard',
              name: 'Cast',
              type: 'utility',
              activation: 'Action',
              range: 'Self',
              target: null,
              toHit: null,
              attackId: null,
              activity: cast,
              save: null,
              damage: [],
              uses: null,
            },
            {
              id: 'aura',
              name: 'Emanation Save',
              type: 'save',
              activation: 'Special',
              range: 'Self',
              target: null,
              toHit: null,
              attackId: null,
              activity: { id: 'aura', type: 'save', targets: targets({}) },
              save: { ability: 'WIS', dc: 14 },
              damage: [{ formula: '3d8', type: 'Radiant', healing: false }],
              consumesSlot: false,
              uses: null,
            },
          ],
        }),
      )
      lists.spells[2].spells.push(
        sheetSpell({ id: 'guardians', name: 'Spirit Guardians', level: 3 }),
      )

      // Its 3rd-level slots are spent, but its save each turn spends none.
      expect(
        check(useRequest('guardians', 'aura', ['c-goblin']), lists),
      ).toBeUndefined()
      expect(
        check(
          useRequest('guardians', 'aura', ['c-goblin'], { slot: 'spell3' }),
          lists,
        ),
      ).toBeUndefined()
      expect(check(useRequest('guardians', 'guard', []), lists)).toBe('slots')
      expect(
        check(useRequest('guardians', 'guard', [], { slot: 'spell3' }), lists),
      ).toBe('slot')
      expect(
        check(useRequest('guardians', 'aura', [], { slot: 'spell1' }), lists),
      ).toBe('slot')
    })

    it('lets a spell, feature or item be used from where the sheet lists it, but a spell not prepared', () => {
      const lists = cleric()
      const ward = {
        activity: {
          id: 'ward',
          type: 'utility' as const,
          targets: targets({ count: 1, affects: 'ally' }),
        },
      }
      lists.spells[0].spells.push(
        sheetSpell({
          id: 'sanctuary',
          name: 'Sanctuary',
          prepared: 1,
          ...ward,
        }),
        sheetSpell({ id: 'hold', name: 'Hold Person', prepared: 0, ...ward }),
      )
      lists.features = [
        {
          id: 'other',
          label: 'Other Features',
          text: null,
          features: [
            {
              id: 'breath',
              name: 'Dragon Breath',
              img: null,
              kind: null,
              requirements: null,
              activation: '1 Action',
              passive: false,
              uses: null,
              text: null,
              activity: {
                id: 'exhale',
                type: 'save',
                targets: targets({ area: true }),
              },
              save: { ability: 'DEX', dc: 13 },
            },
          ],
        },
      ]
      lists.inventory.sections[0].items.push(
        sheetItem({
          id: 'potion',
          name: 'Potion of Healing',
          activity: {
            id: 'drink',
            type: 'heal',
            targets: targets({ self: true, affects: 'self' }),
          },
        }),
        sheetItem({
          id: 'scroll',
          name: 'Odd Scroll',
          identified: false,
          ...ward,
        }),
      )

      expect(
        check(useRequest('sanctuary', 'ward', ['c-vex']), lists),
      ).toBeUndefined()
      expect(
        check(useRequest('breath', 'exhale', ['c-goblin', 'c-hob']), lists),
      ).toBeUndefined()
      expect(check(useRequest('potion', 'drink', []), lists)).toBeUndefined()
      // The game would have it prepared first.
      expect(check(useRequest('hold', 'ward', ['c-vex']), lists)).toBe(
        'unknown',
      )
      expect(check(useRequest('scroll', 'ward', []), lists)).toBe('unknown')
    })
  })

  describe('checkDamage', () => {
    const preview: DamagePreview = {
      critical: false,
      plannable: true,
      rolls: [
        {
          formula: '1d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 1 }],
        },
        { formula: '2d6', type: 'fire', dice: [{ faces: 6, number: 2 }] },
      ],
    }
    const result = (damage: DamagePreview | null): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible: true,
      rolls: [],
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage,
    })
    const use = (fields: Partial<HeldRollRequest> = {}) =>
      held({
        kind: 'attack',
        status: 'done',
        createdAt: ago(60_000),
        result: result(preview),
        ...fields,
      })
    const thrown = damageRequest([
      { faces: 8, results: [5] },
      { faces: 6, results: [2, 6] },
    ])

    it('lets the damage of an attack made lately be rolled once, with the dice it said', () => {
      expect(checkDamage(thrown, use(), [], NOW)).toBeUndefined()
      expect(
        checkDamage(thrown, use(), [held({ status: 'failed' })], NOW),
      ).toBeUndefined()
      // One that never reached the game doesn't count.
      expect(
        checkDamage(thrown, use(), [held({ createdAt: ago(30_000) })], NOW),
      ).toBeUndefined()
    })

    it('rolls no dice for damage the game rolls itself', () => {
      const unplannable = use({
        result: result({ ...preview, plannable: false }),
      })
      expect(
        checkDamage(damageRequest([]), unplannable, [], NOW),
      ).toBeUndefined()
      expect(checkDamage(thrown, unplannable, [], NOW)).toBe('dice')
    })

    it.each([
      ['no attack', null],
      ['an attack still on its way', use({ status: 'claimed' })],
      ['an attack not made', use({ status: 'failed' })],
      ['a check', use({ kind: 'skill' })],
      ['an attack made too long ago', use({ createdAt: ago(600_001) })],
    ])('refuses the damage of %s', (_name, attack) => {
      expect(checkDamage(thrown, attack, [], NOW)).toBe('gone')
    })

    it("lets a use's damage be rolled, as the kinds chosen among those its rolls offer", () => {
      const fire = { key: 'fire', label: 'Fire' }
      const cold = { key: 'cold', label: 'Cold' }
      const offered = use({
        kind: 'use',
        result: result({
          ...preview,
          rolls: [
            { ...preview.rolls[0], types: [fire, cold] },
            preview.rolls[1],
          ],
        }),
      })
      const as = (types: (string | null)[]) => ({ ...thrown, types })
      expect(checkDamage(thrown, offered, [], NOW)).toBeUndefined()
      expect(checkDamage(as(['cold']), offered, [], NOW)).toBeUndefined()
      expect(checkDamage(as(['fire', null]), offered, [], NOW)).toBeUndefined()
      expect(checkDamage(as(['acid']), offered, [], NOW)).toBe('type')
      expect(checkDamage(as([null, 'fire']), offered, [], NOW)).toBe('type')
      expect(checkDamage(as(['fire', null, null]), offered, [], NOW)).toBe(
        'type',
      )
      expect(checkDamage(as(['fire']), use(), [], NOW)).toBe('type')
    })

    it('refuses the damage of an attack no damage follows', () => {
      expect(checkDamage(thrown, use({ result: result(null) }), [], NOW)).toBe(
        'no-damage',
      )
    })

    it.each([
      ['on its way', held()],
      ['being rolled', held({ status: 'claimed', claimedAt: ago(1000) })],
      ['rolled', held({ status: 'done' })],
    ])('refuses damage already %s', (_name, other) => {
      expect(checkDamage(thrown, use(), [other], NOW)).toBe('damaged')
    })

    it.each([
      ['a part missing', [{ faces: 8, results: [5] }]],
      [
        'a die too few',
        [
          { faces: 8, results: [5] },
          { faces: 6, results: [2] },
        ],
      ],
      [
        'the wrong die',
        [
          { faces: 10, results: [5] },
          { faces: 6, results: [2, 6] },
        ],
      ],
      [
        'the parts the other way about',
        [
          { faces: 6, results: [2, 6] },
          { faces: 8, results: [5] },
        ],
      ],
    ])('refuses damage with %s', (_name, dice) => {
      expect(checkDamage(damageRequest(dice), use(), [], NOW)).toBe('dice')
    })
  })

  describe('isDying', () => {
    it('is so at 0 hit points, until three successes or failures, as dnd5e has it', () => {
      const at = (value: number, success: number, failure: number) =>
        isDying({
          hp: { value, max: 44, temp: 0 },
          deathSaves: { success, failure },
        })
      expect(at(0, 0, 0)).toBe(true)
      expect(at(0, 2, 2)).toBe(true)
      expect(at(0, 3, 0)).toBe(false)
      expect(at(0, 0, 3)).toBe(false)
      expect(at(1, 0, 0)).toBe(false)
      expect(
        isDying({ hp: { value: 0, max: 44, temp: 0 }, deathSaves: null }),
      ).toBe(false)
      expect(isDying()).toBe(false)
    })
  })

  describe('rollStatus', () => {
    it('is sending until the module fetches it, then expired', () => {
      expect(rollStatus(held(), NOW)).toBe('sending')
      expect(rollStatus(held({ createdAt: ago(30_000) }), NOW)).toBe('expired')
    })

    it('is rolling once fetched, then lost without an answer', () => {
      expect(
        rollStatus(held({ status: 'claimed', claimedAt: ago(74_000) }), NOW),
      ).toBe('rolling')
      expect(
        rollStatus(held({ status: 'claimed', claimedAt: ago(75_000) }), NOW),
      ).toBe('lost')
      expect(
        rollStatus(
          held({ status: 'claimed', claimedAt: null, createdAt: ago(76_000) }),
          NOW,
        ),
      ).toBe('lost')
    })

    it('is what the module answered', () => {
      expect(rollStatus(held({ status: 'done' }), NOW)).toBe('done')
      expect(rollStatus(held({ status: 'failed' }), NOW)).toBe('failed')
    })
  })

  describe('toRollRequestView', () => {
    const summary = {
      formula: '1d20 + 4',
      total: 18,
      dice: [{ faces: 20, results: [{ result: 14, active: true }] }],
    }

    it("shows the game's roll and total once made", () => {
      expect(
        toRollRequestView(
          held({
            status: 'done',
            result: {
              id: 'req-1',
              status: 'done',
              reason: null,
              error: null,
              messageId: 'msg-1',
              visible: true,
              rolls: [summary],
            },
          }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 18,
        rolls: [
          {
            formula: '1d20 + 4',
            total: 18,
            dice: [{ faces: 20, value: 14, active: true }],
            advantage: false,
            disadvantage: false,
            critical: false,
            fumble: false,
            damageType: undefined,
          },
        ],
      })
    })

    it('shows whether a save the game asked for succeeded, where the game shows its player', () => {
      expect(answered('success')).toMatchObject({
        total: 18,
        outcome: 'success',
      })
      expect(answered('failure')).toMatchObject({ outcome: 'failure' })
      expect(answered(null)).not.toHaveProperty('outcome')
    })

    it('keeps a roll the game made blind from its player', () => {
      expect(
        toRollRequestView(
          held({
            status: 'done',
            result: {
              id: 'req-1',
              status: 'done',
              reason: null,
              error: null,
              messageId: 'msg-1',
              visible: false,
              rolls: [],
            },
          }),
          NOW,
        ),
      ).toEqual({ id: 'req-1', status: 'done', visible: false })
    })

    it("says why a roll wasn't made, and where one stands until it is", () => {
      expect(
        toRollRequestView(
          held({
            status: 'failed',
            result: { id: 'req-1', status: 'failed', reason: 'not-dying' },
          }),
          NOW,
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'not-dying' })
      expect(toRollRequestView(held({ status: 'failed' }), NOW)).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: undefined,
      })
      expect(toRollRequestView(held(), NOW)).toEqual({
        id: 'req-1',
        status: 'sending',
      })
      expect(toRollRequestView(held({ status: 'done' }), NOW)).toEqual({
        id: 'req-1',
        status: 'done',
      })
    })
  })

  describe('toRollRequestView for attacks', () => {
    const preview: DamagePreview = {
      critical: true,
      plannable: true,
      rolls: [
        {
          formula: '2d8 + 4',
          type: 'bludgeoning',
          dice: [{ faces: 8, number: 2 }],
        },
      ],
    }
    const attackResult = (visible: boolean): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible,
      rolls: visible
        ? [
            {
              formula: '1d20 + 7',
              total: 27,
              dice: [{ faces: 20, results: [{ result: 20, active: true }] }],
            },
          ]
        : [],
      attack: { critical: true, fumble: false, outcome: 'hit' },
      damage: preview,
    })

    it('shows what came of an attack, and the dice its damage throws', () => {
      expect(
        toRollRequestView(
          held({ kind: 'attack', status: 'done', result: attackResult(true) }),
          NOW,
        ),
      ).toMatchObject({
        status: 'done',
        visible: true,
        total: 27,
        attack: { critical: true, fumble: false, outcome: 'hit' },
        damage: preview,
      })
    })

    it('gives the damage of an attack its player may not see, for them to roll it', () => {
      expect(
        toRollRequestView(
          held({ kind: 'attack', status: 'done', result: attackResult(false) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        damage: preview,
      })
    })

    it('says what kind of activity a use was, and the dice its healing throws, seen or not', () => {
      const used = (visible: boolean): CommandResult => ({
        ...attackResult(visible),
        rolls: [],
        attack: undefined,
        use: { type: 'heal' },
        damage: { ...preview, healing: true },
      })
      expect(
        toRollRequestView(
          held({ kind: 'use', status: 'done', result: used(true) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        use: { type: 'heal' },
        damage: { ...preview, healing: true },
      })
      expect(
        toRollRequestView(
          held({ kind: 'use', status: 'done', result: used(false) }),
          NOW,
        ),
      ).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        use: { type: 'heal' },
        damage: { ...preview, healing: true },
      })
    })

    /** Damage the game made, with these rolls. */
    const madeDamage = (rolls: CommandResult['rolls']) =>
      held({
        kind: 'damage',
        status: 'done',
        result: {
          ...attackResult(true),
          attack: undefined,
          damage: undefined,
          rolls,
        },
      })

    it("totals damage's parts, when the game said each", () => {
      expect(
        toRollRequestView(madeDamage([damagePart(9), damagePart(7)]), NOW),
      ).toMatchObject({
        total: 16,
      })
      expect(
        toRollRequestView(madeDamage([damagePart(9), damagePart(null)]), NOW)
          .total,
      ).toBeUndefined()
      expect(toRollRequestView(madeDamage([]), NOW).total).toBeUndefined()
    })
  })

  describe('toCommand', () => {
    it('sends the module what to roll, whose, and with which dice', () => {
      expect(toCommand(held())).toEqual({
        ...request({}),
        id: 'req-1',
        actorId: 'actor-thorin',
      })
    })
  })
})
