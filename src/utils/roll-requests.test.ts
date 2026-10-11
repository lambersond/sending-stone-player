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
  TEXTS,
} from '@/mocks/sending-stone'
import type { RollRequestInput } from '@/types/roll'
import type {
  CommandResult,
  DamagePreview,
  SheetAction,
  SheetClass,
} from '@/types/sending-stone'
import type { FoundLink } from '@/utils/description-links'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const ago = (ms: number) => new Date(NOW - ms)

/** Damage's dice: `first` of a die, d6s unless said, then `fours` d4s. */
const diceOf = (first: number, fours: number, faces = 6) => [
  { faces, results: Array.from({ length: first }, () => 1) },
  { faces: 4, results: Array.from({ length: fours }, () => 2) },
]

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

/**
 * Thorin with Dragon Breath, made at two in its cone; a storm, at any number; Acid Spray, at two
 * and one more for each level higher, with 1st-level slots as given; and a warhammer.
 */
const breather = (spell1 = 2) =>
  fullerSheet({
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            id: 'breath',
            name: 'Dragon Breath',
            toHit: 5,
            attackId: 'exhale',
            attackArea: { count: 2, perLevel: null, affects: 'creature' },
          }),
          sheetAction({
            id: 'storm',
            name: 'Storm',
            toHit: 5,
            attackId: 'gust',
            attackArea: { count: null, perLevel: null, affects: null },
          }),
          sheetAction({
            id: 'spray',
            name: 'Acid Spray',
            type: 'spell',
            level: 1,
            toHit: 5,
            attackId: 'splash',
            attackArea: { count: 2, perLevel: 1, affects: 'creature' },
          }),
          sheetAction({
            id: 'warhammer',
            name: 'Warhammer',
            type: 'weapon',
            toHit: 7,
            attackId: 'warhammerAttack',
          }),
        ],
      },
    ],
    spells: [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: spell1, max: 4, level: 1 },
        spells: [sheetSpell({ id: 'spray', name: 'Acid Spray' })],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 1, max: 3, level: 2 },
        spells: [],
      },
    ],
  })

/** An area attack with an item's attack at combatants of the combat, by their ids. */
const areaRequest = (
  item: string,
  activity: string,
  at: string[],
  fields: Partial<RollRequestInput> = {},
) =>
  attackRequest({
    item,
    activity,
    targets: at.map(combatantId => ({ combatId: 'cmbt1', combatantId })),
    ...fields,
  })

/** A hit die of this size spent. */
const hitDieRequest = (denomination = 'd10') =>
  request({
    kind: 'hitDie',
    key: undefined,
    denomination,
    dice: [{ faces: Number(denomination.slice(1)), results: [4] }],
  })

/** Thorin, with a class with each of these hit dice. */
const classed = (...hitDice: SheetClass['hitDice'][]) =>
  fullerSheet({
    classes: hitDice.map((dice, index) => ({
      name: `Class ${index + 1}`,
      levels: dice?.max ?? 1,
      subclass: null,
      hitDice: dice,
    })),
  })

/** Can the character make this roll, as its sheet stands, out of combat? */
const checkSheet = (input: RollRequestInput, sheet = fullerSheet()) =>
  checkRoll(input, sheet, [], 'actor-thorin')

/** An activity the game uses on its user alone, such as a lantern's. */
const utility = (id: string) => ({
  id,
  type: 'utility' as const,
  targets: targets({ self: true, affects: 'self' }),
})

/** A hit die spent, as its player is told of it, giving back this many hit points. */
const spent = (visible: boolean, healed?: number | null) =>
  toRollRequestView(
    held({
      kind: 'hitDie',
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        reason: null,
        error: null,
        messageId: 'msg-1',
        visible,
        rolls: visible
          ? [
              {
                formula: '1d10 + 3',
                total: 9,
                dice: [{ faces: 10, results: [{ result: 6, active: true }] }],
              },
            ]
          : [],
        healed,
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

    it('lets the character roll a tool its sheet lists among its tools, from module 0.18.0, as among its favorites', () => {
      const herb = {
        id: 'herb',
        name: 'Herbalism Kit',
        ability: 'wis',
        total: 4,
        passive: null,
        proficiency: 1,
        mode: 0,
      } as const
      expect(
        checkRoll(
          request({ kind: 'tool', key: 'herb' }),
          characterSheet({ tools: [herb] }),
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

  describe('checkRoll for an area attack', () => {
    const fight = combat({
      combatants: [
        combatant({ id: 'c-goblin', name: 'Goblin' }),
        combatant({ id: 'c-hob', name: 'Hobgoblin' }),
        combatant({ id: 'c-ogre', name: 'Ogre' }),
        combatant({ id: 'c-lurker', name: 'Lurker', hidden: true }),
      ],
    })
    const check = (input: RollRequestInput, sheet = breather()) =>
      checkRoll(input, sheet, [fight], 'actor-thorin')

    it('lets an area attack be made at as many combatants as its area takes, or at none', () => {
      expect(
        check(areaRequest('breath', 'exhale', ['c-goblin', 'c-hob'])),
      ).toBeUndefined()
      expect(check(areaRequest('breath', 'exhale', ['c-ogre']))).toBeUndefined()
      expect(check(areaRequest('breath', 'exhale', []))).toBeUndefined()
      expect(
        check(areaRequest('storm', 'gust', ['c-goblin', 'c-hob', 'c-ogre'])),
      ).toBeUndefined()
    })

    it('takes more combatants for a spell whose area takes more cast higher, chosen or by default', () => {
      const three = ['c-goblin', 'c-hob', 'c-ogre']
      expect(
        check(areaRequest('spray', 'splash', three.slice(0, 2))),
      ).toBeUndefined()
      expect(check(areaRequest('spray', 'splash', three))).toBe('target')
      expect(
        check(areaRequest('spray', 'splash', three, { slot: 'spell1' })),
      ).toBe('target')
      expect(
        check(areaRequest('spray', 'splash', three, { slot: 'spell2' })),
      ).toBeUndefined()
      // With no 1st-level slot left, Acid Spray is cast at 2nd, as dnd5e would.
      expect(
        check(areaRequest('spray', 'splash', three), breather(0)),
      ).toBeUndefined()
    })

    it.each([
      [
        'more combatants than its area takes',
        areaRequest('breath', 'exhale', ['c-goblin', 'c-hob', 'c-ogre']),
      ],
      [
        'combatants, for an attack with no area',
        areaRequest('warhammer', 'warhammerAttack', ['c-goblin']),
      ],
      [
        'no one in its area, for an attack with no area',
        areaRequest('warhammer', 'warhammerAttack', []),
      ],
      [
        'a combatant its player cannot see',
        areaRequest('breath', 'exhale', ['c-goblin', 'c-lurker']),
      ],
      [
        'a combatant not in the combat',
        areaRequest('breath', 'exhale', ['c-dragon']),
      ],
    ])('refuses an area attack at %s', (_name, input) => {
      expect(check(input)).toBe('target')
    })

    it('refuses an area attack the sheet has no such attack for, or with no slot of that chosen left', () => {
      expect(check(areaRequest('breath', 'breathe', ['c-goblin']))).toBe(
        'unknown',
      )
      expect(
        check(areaRequest('spray', 'splash', ['c-goblin'], { slot: 'spell3' })),
      ).toBe('slot')
    })

    it('still lets an attack with an area be made at one target, as before', () => {
      expect(
        check(attackRequest({ item: 'breath', activity: 'exhale' })),
      ).toBeUndefined()
      expect(
        check(
          attackRequest({
            item: 'breath',
            activity: 'exhale',
            ...targetAt('c-goblin'),
          }),
        ),
      ).toBeUndefined()
    })
  })

  describe('checkRoll for a hit die', () => {
    it('lets the character spend a hit die of a size it has one of left', () => {
      // Thorin's Fighter levels have 3 of their 5 d10s left.
      expect(checkSheet(hitDieRequest())).toBeUndefined()
    })

    it("lets a hit die be spent from any class of its size with one left, or whose sheet doesn't say how many, for the game to check", () => {
      const drained = { die: 'd10', value: 0, max: 3 }
      expect(
        checkSheet(
          hitDieRequest(),
          classed(
            drained,
            { die: 'd6', value: 1, max: 1 },
            { ...drained, value: 2 },
          ),
        ),
      ).toBeUndefined()
      expect(
        checkSheet(hitDieRequest(), classed({ ...drained, value: null })),
      ).toBeUndefined()
      expect(
        checkSheet(
          hitDieRequest('d6'),
          classed(drained, { die: 'd6', value: 1, max: 1 }),
        ),
      ).toBeUndefined()
    })

    it('refuses a hit die of a size the character has none of left', () => {
      const drained = { die: 'd10', value: 0, max: 3 }
      expect(checkSheet(hitDieRequest(), classed(drained))).toBe('no-hit-dice')
      expect(
        checkSheet(
          hitDieRequest(),
          classed(
            drained,
            { ...drained, max: 2 },
            { die: 'd6', value: 1, max: 1 },
          ),
        ),
      ).toBe('no-hit-dice')
    })

    it('refuses a hit die of a size no class of the character has, or a character without a sheet', () => {
      expect(checkSheet(hitDieRequest('d8'))).toBe('unknown')
      // A sheet that says nothing of its classes' hit dice has none to spend.
      expect(checkSheet(hitDieRequest(), characterSheet())).toBe('unknown')
      expect(checkSheet(hitDieRequest(), classed(null))).toBe('unknown')
      expect(checkSheet(hitDieRequest(), classed())).toBe('unknown')
      expect(checkRoll(hitDieRequest(), undefined, [], 'actor-thorin')).toBe(
        'unknown',
      )
    })
  })

  describe('checkRoll for a formula', () => {
    /** A lantern's light, whose radius is 1d4 + 2d6 + 3. */
    const light = { formula: '1d4 + 2d6 + 3', name: 'Light radius' }
    const thrown = [
      { faces: 4, results: [3] },
      { faces: 6, results: [2, 5] },
    ]

    /** Thorin with lights of every kind, and a torch, which has no formula of its own. */
    const lit = () =>
      fullerSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'lantern',
                name: 'Lantern',
                type: 'equipment',
                activity: utility('shine'),
                rollFormula: light,
              }),
              sheetAction({
                id: 'torch',
                name: 'Torch',
                activity: utility('burn'),
              }),
              sheetAction({
                id: 'glowstone',
                name: 'Glowstone',
                rollFormula: light,
              }),
              sheetAction({
                id: 'odd',
                name: 'Odd Lamp',
                activity: utility('glow'),
                rollFormula: light,
                identified: false,
              }),
              sheetAction({
                id: 'strange',
                name: 'Strange Lamp',
                activity: utility('flicker'),
                rollFormula: { formula: '1d4 + @mod', name: null },
              }),
              sheetAction({
                id: 'candle',
                name: 'Candle',
                activity: utility('flame'),
                rollFormula: { formula: '5', name: null },
              }),
            ],
          },
        ],
      })

    /** An activity's own formula rolled, with these dice. */
    const formulaRequest = (
      item: string,
      activity: string,
      dice: RollRequestInput['dice'] = thrown,
    ) => request({ kind: 'formula', key: undefined, item, activity, dice })
    const check = (input: RollRequestInput, sheet = lit()) =>
      checkRoll(input, sheet, [], 'actor-thorin')

    it("lets the character roll an activity's own formula, with the dice it throws, in order", () => {
      expect(check(formulaRequest('lantern', 'shine'))).toBeUndefined()
      // A formula of numbers alone throws none.
      expect(check(formulaRequest('candle', 'flame', []))).toBeUndefined()
    })

    it.each([
      ['a die missing', [thrown[0]]],
      ['no dice', []],
      ['a die too few', [thrown[0], { faces: 6, results: [2] }]],
      ['a die too many', [thrown[0], { faces: 6, results: [2, 5, 1] }]],
      ['dice the formula does not throw', [...thrown, thrown[0]]],
      ['the wrong die', [{ faces: 8, results: [3] }, thrown[1]]],
      ['the dice the other way about', [thrown[1], thrown[0]]],
    ])('refuses a formula with %s', (_name, dice) => {
      expect(check(formulaRequest('lantern', 'shine', dice))).toBe('dice')
    })

    it('refuses dice for a formula of numbers alone', () => {
      expect(
        check(formulaRequest('candle', 'flame', [{ faces: 4, results: [1] }])),
      ).toBe('dice')
    })

    it.each([
      ['an action with no formula of its own', 'torch', 'burn'],
      ['an activity the action is not used through', 'lantern', 'burn'],
      ['an action the game uses through nothing', 'glowstone', 'shine'],
      ['an item the sheet has not', 'lamp', 'shine'],
      ['an item not identified yet', 'odd', 'glow'],
      ["a formula the app can't read", 'strange', 'flicker'],
    ])('refuses the formula of %s', (_name, item, activity) => {
      expect(check(formulaRequest(item, activity))).toBe('unknown')
    })

    it('refuses a formula for a character without a sheet', () => {
      expect(
        checkRoll(
          formulaRequest('lantern', 'shine'),
          undefined,
          [],
          'actor-thorin',
        ),
      ).toBe('unknown')
    })

    it("lets the formula of an item's later activity, a feature or something carried be rolled, and a spell's only while it's prepared", () => {
      const lists = lit()
      const [lantern] = lists.actions[0].actions
      const activity = {
        name: 'Shine',
        type: 'utility',
        activation: 'Action',
        range: 'Self',
        target: null,
        toHit: null,
        attackId: null,
        save: null,
        damage: [],
        uses: null,
      }
      lists.actions[0].actions[0] = {
        ...lantern,
        rollFormula: undefined,
        activity: utility('open'),
        activities: [
          { ...activity, id: 'open', activity: utility('open') },
          {
            ...activity,
            id: 'shine',
            activity: utility('shine'),
            rollFormula: light,
          },
        ],
      }
      lists.spells[0].spells.push(
        sheetSpell({
          id: 'flame',
          name: 'Eternal Flame',
          level: 0,
          prepared: 1,
          activity: utility('kindle'),
          rollFormula: light,
        }),
        sheetSpell({
          id: 'dancing',
          name: 'Dancing Lights',
          level: 0,
          prepared: 0,
          activity: utility('dance'),
          rollFormula: light,
        }),
      )
      lists.features = [
        {
          id: 'other',
          label: 'Other Features',
          text: null,
          features: [
            {
              id: 'radiance',
              name: 'Radiance',
              img: null,
              kind: null,
              requirements: null,
              activation: '1 Action',
              passive: false,
              uses: null,
              text: null,
              activity: utility('radiate'),
              rollFormula: light,
            },
          ],
        },
      ]
      lists.inventory.sections[0].items.push(
        sheetItem({
          id: 'lamp',
          name: 'Lamp',
          activity: utility('light'),
          rollFormula: light,
        }),
        sheetItem({
          id: 'orb',
          name: 'Odd Orb',
          identified: false,
          activity: utility('pulse'),
          rollFormula: light,
        }),
      )

      expect(check(formulaRequest('lantern', 'shine'), lists)).toBeUndefined()
      // Its first activity has no formula of its own.
      expect(check(formulaRequest('lantern', 'open'), lists)).toBe('unknown')
      expect(check(formulaRequest('flame', 'kindle'), lists)).toBeUndefined()
      expect(
        check(formulaRequest('radiance', 'radiate'), lists),
      ).toBeUndefined()
      expect(check(formulaRequest('lamp', 'light'), lists)).toBeUndefined()
      // The game would have it prepared first.
      expect(check(formulaRequest('dancing', 'dance'), lists)).toBe('unknown')
      expect(check(formulaRequest('orb', 'pulse'), lists)).toBe('unknown')
    })
  })

  describe('checkRoll from a link in a description', () => {
    /** Second Wind's description, which is on Thorin's sheet. */
    const TEXT = TEXTS.secondWind
    /**
     * Its links, as held: a save, one in a secret, concentration checks naming an ability and
     * none, damage, and rolls, some the app can't read.
     */
    const links = new Map<number, FoundLink>([
      [
        0,
        {
          link: {
            kind: 'save',
            n: 0,
            abilities: ['str', 'dex'],
            dc: 15,
            concentration: false,
          },
          secret: false,
        },
      ],
      [
        1,
        {
          link: {
            kind: 'save',
            n: 1,
            abilities: ['wis'],
            concentration: false,
          },
          secret: true,
        },
      ],
      [
        2,
        {
          link: {
            kind: 'save',
            n: 2,
            abilities: ['wis'],
            dc: 10,
            concentration: true,
          },
          secret: false,
        },
      ],
      [
        3,
        {
          link: {
            kind: 'damage',
            n: 3,
            parts: [
              { formula: '2d6 + 3', types: ['fire', 'cold'] },
              { formula: '1d4', types: [] },
              { formula: '5', types: ['force'] },
            ],
            healing: false,
          },
          secret: false,
        },
      ],
      [4, { link: { kind: 'roll', n: 4, formula: '1d6 + 2' }, secret: false }],
      [
        5,
        {
          link: {
            kind: 'damage',
            n: 5,
            parts: [{ formula: '2d6 * 2', types: [] }],
            healing: false,
          },
          secret: false,
        },
      ],
      [6, { link: { kind: 'roll', n: 6, formula: '(1d6)' }, secret: false }],
      [
        7,
        {
          link: {
            kind: 'damage',
            n: 7,
            parts: [
              { formula: '1d4', types: [] },
              { formula: '2d6 * 2', types: [] },
            ],
            healing: false,
          },
          secret: false,
        },
      ],
      [
        8,
        {
          link: {
            kind: 'save',
            n: 8,
            abilities: ['con'],
            concentration: true,
          },
          secret: false,
        },
      ],
      [
        10,
        {
          link: {
            kind: 'check',
            n: 10,
            checks: [
              { type: 'skill', ability: 'str', key: 'ath' },
              { type: 'skill', ability: 'dex', key: 'ste' },
              { type: 'tool', ability: 'dex', key: 'thief' },
              { type: 'tool', ability: 'int', key: 'herb' },
              { type: 'check', ability: 'int' },
            ],
            dc: 15,
          },
          secret: false,
        },
      ],
      [
        11,
        {
          link: {
            kind: 'check',
            n: 11,
            checks: [{ type: 'check', ability: 'wis' }],
          },
          secret: true,
        },
      ],
      [
        12,
        {
          link: {
            kind: 'damage',
            n: 12,
            parts: [{ formula: '2d4 + 2', types: ['healing'] }],
            healing: true,
          },
          secret: false,
        },
      ],
      [
        13,
        {
          link: {
            kind: 'damage',
            n: 13,
            parts: [
              { formula: '3', types: ['fire'] },
              { formula: '1d6', types: ['fire'] },
            ],
            healing: false,
          },
          secret: false,
        },
      ],
      [
        14,
        {
          // A saving throw's, as dnd5e's own link rolls it, which is never a critical hit's.
          link: {
            kind: 'damage',
            n: 14,
            parts: [{ formula: '1d4', types: ['poison'] }],
            healing: false,
            critical: false,
          },
          secret: false,
        },
      ],
    ])
    const linked = (fields: Partial<RollRequestInput>) =>
      request({
        kind: 'ask',
        key: undefined,
        text: TEXT,
        link: 0,
        dice: [],
        ...fields,
      })
    const check = (
      input: RollRequestInput,
      held: ReadonlyMap<number, FoundLink> | undefined = links,
      sheet = fullerSheet(),
    ) => checkRoll(input, sheet, [], 'actor-thorin', held)

    /** The dice link 3's damage throws: 2d6, then 1d4; its 5 throws none. */
    const burn = [
      { faces: 6, results: [2, 6] },
      { faces: 4, results: [3] },
    ]
    const textDamage = (fields: Partial<RollRequestInput> = {}) =>
      linked({ kind: 'textDamage', link: 3, dice: burn, ...fields })
    /** Link 13's damage, whose first part is a number alone: 3, then 1d6 fire. */
    const fire = (fields: Partial<RollRequestInput>) =>
      textDamage({ link: 13, dice: [{ faces: 6, results: [4] }], ...fields })
    const textRoll = (fields: Partial<RollRequestInput> = {}) =>
      linked({
        kind: 'textRoll',
        link: 4,
        dice: [{ faces: 6, results: [5] }],
        ...fields,
      })

    it('lets the table be asked for a saving throw a description on the sheet calls for', () => {
      expect(check(linked({}))).toBeUndefined()
      expect(check(linked({ link: 2 }))).toBeUndefined()
    })

    it('never lets the table be asked for one in a secret, which would be posted for everyone', () => {
      expect(check(linked({ link: 1 }))).toBe('secret')
    })

    it.each([
      ['damage', 3],
      ['a roll', 4],
      ['a link the description has not', 9],
    ])('refuses to ask the table for %s', (_name, link) => {
      expect(check(linked({ link }))).toBe('link')
    })

    it.each([
      ['an ask', linked({})],
      ['a saving throw', linked({ kind: 'save', key: 'dex' })],
      ['damage', textDamage()],
      ['a roll', textRoll()],
    ])(
      'refuses %s from a description no longer on the sheet, or not held here',
      (_name, input) => {
        expect(check({ ...input, text: 'ffffffffffffff' })).toBe('gone')
        expect(checkRoll(input, fullerSheet(), [], 'actor-thorin')).toBe('gone')
        expect(checkRoll(input, undefined, [], 'actor-thorin', links)).toBe(
          'unknown',
        )
      },
    )

    it("lets the player roll their own saving throw a description calls for, with an ability it names, a secret's too", () => {
      expect(check(linked({ kind: 'save', key: 'dex' }))).toBeUndefined()
      expect(check(linked({ kind: 'save', key: 'str' }))).toBeUndefined()
      expect(
        check(linked({ kind: 'save', key: 'wis', link: 1 })),
      ).toBeUndefined()
    })

    it('lets a concentration check be rolled with the ability it names, or Constitution where it names none, as the game does', () => {
      expect(
        check(linked({ kind: 'save', key: 'wis', link: 2 })),
      ).toBeUndefined()
      expect(check(linked({ kind: 'save', key: 'con', link: 2 }))).toBe('link')
      expect(check(linked({ kind: 'save', key: 'dex', link: 2 }))).toBe('link')
      expect(
        check(linked({ kind: 'save', key: 'con', link: 8 })),
      ).toBeUndefined()
      expect(check(linked({ kind: 'save', key: 'wis', link: 8 }))).toBe('link')
    })

    it.each([
      ['with an ability it does not name', { key: 'con' }],
      ['for damage', { key: 'dex', link: 3 }],
      ['for a link the description has not', { key: 'dex', link: 9 }],
    ])("refuses the player's own saving throw %s", (_name, fields) => {
      expect(check(linked({ kind: 'save', ...fields }))).toBe('link')
    })

    it('still refuses a saving throw with an ability the sheet has not, first', () => {
      expect(check(linked({ kind: 'save', key: 'luck' }))).toBe('unknown')
    })

    it('lets the table be asked for a check a description on the sheet calls for, but never one in a secret', () => {
      expect(check(linked({ link: 10 }))).toBeUndefined()
      expect(check(linked({ link: 11 }))).toBe('secret')
    })

    /** The player's own check, of this kind and key, from link 10 unless said. */
    const own = (kind: 'skill' | 'tool' | 'ability', key: string, link = 10) =>
      check(linked({ kind, key, link, dice: [{ faces: 20, results: [12] }] }))

    it("lets the player roll their own check a description calls for, each way it may be made, a secret's too", () => {
      expect(own('skill', 'ath')).toBeUndefined()
      expect(own('skill', 'ste')).toBeUndefined()
      expect(own('tool', 'thief')).toBeUndefined()
      expect(own('ability', 'int')).toBeUndefined()
      expect(own('ability', 'wis', 11)).toBeUndefined()
    })

    it('lets a tool check a description calls for be rolled with a tool the character hasn’t, as dnd5e makes one', () => {
      const herb = linked({ kind: 'tool', key: 'herb', link: 10 })

      expect(check(herb)).toBeUndefined()
      // Not one the description doesn't call for, which the sheet doesn't list either.
      expect(check({ ...herb, text: undefined, link: undefined })).toBe(
        'unknown',
      )
    })

    it.each([
      ['a skill it does not name', { kind: 'skill', key: 'prc' }],
      ['a tool it does not name', { kind: 'tool', key: 'disg' }],
      ['an ability check it does not name', { kind: 'ability', key: 'str' }],
      [
        'a skill, where it names only an ability',
        { kind: 'skill', key: 'prc', link: 11 },
      ],
      ['a skill as a tool', { kind: 'tool', key: 'ath' }],
      ['a check of a save', { kind: 'ability', key: 'dex', link: 0 }],
      ['a check of damage', { kind: 'skill', key: 'ath', link: 3 }],
      ['a check of a link it has not', { kind: 'skill', key: 'ath', link: 9 }],
      ['a save of a check', { kind: 'save', key: 'int', link: 10 }],
    ] as const)("refuses the player's own check of %s", (_name, fields) => {
      expect(check(linked({ link: 10, ...fields }))).toBe('link')
    })

    it('still refuses a check with a skill or ability the sheet has not, first', () => {
      expect(check(linked({ kind: 'skill', key: 'acr', link: 10 }))).toBe(
        'unknown',
      )
      expect(check(linked({ kind: 'ability', key: 'luck', link: 10 }))).toBe(
        'unknown',
      )
    })

    it.each([
      ['a skill check', linked({ kind: 'skill', key: 'ath', link: 10 })],
      ['a tool check', linked({ kind: 'tool', key: 'thief', link: 10 })],
      ['an ability check', linked({ kind: 'ability', key: 'int', link: 10 })],
    ])(
      'refuses %s from a description no longer on the sheet, or not held here',
      (_name, input) => {
        expect(check({ ...input, text: 'ffffffffffffff' })).toBe('gone')
        expect(checkRoll(input, fullerSheet(), [], 'actor-thorin')).toBe('gone')
      },
    )

    it("lets a description's damage be rolled with the dice its parts throw, each as a kind it offers, where chosen", () => {
      expect(check(textDamage())).toBeUndefined()
      expect(check(textDamage({ types: ['cold'] }))).toBeUndefined()
      expect(
        check(textDamage({ types: [null, null, 'force'] })),
      ).toBeUndefined()
      expect(check(textDamage({ types: [] }))).toBeUndefined()
    })

    it.each([
      ['a part does not offer', ['force']],
      ['a part offering none', [null, 'fire']],
      ['more parts than it has', [null, null, null, null]],
    ])('refuses a kind of damage %s', (_name, types) => {
      expect(check(textDamage({ types }))).toBe('type')
    })

    it.each([
      ['a die missing', [burn[0]]],
      ['no dice', []],
      ['a die too few', [{ faces: 6, results: [2] }, burn[1]]],
      ['a die too many', [...burn, { faces: 6, results: [1] }]],
      ['the wrong die', [{ faces: 8, results: [2, 6] }, burn[1]]],
      ['the dice the other way about', [burn[1], burn[0]]],
    ])("refuses a description's damage with %s", (_name, dice) => {
      expect(check(textDamage({ dice }))).toBe('dice')
    })

    it("refuses damage the app can't read, which it couldn't have rolled", () => {
      expect(
        check(textDamage({ link: 5, dice: [{ faces: 6, results: [1, 2] }] })),
      ).toBe('dice')
      // With no dice at all, as an unread part would throw none.
      expect(check(textDamage({ link: 5, dice: [] }))).toBe('dice')
      // With only the dice of the part it can read.
      expect(
        check(textDamage({ link: 7, dice: [{ faces: 4, results: [3] }] })),
      ).toBe('dice')
    })

    /** How the world rolls a critical hit's damage, as dnd5e does by default. */
    const DOUBLED = {
      perDie: 2,
      multiplyNumeric: false,
      powerfulCritical: false,
      altered: false,
    }
    /** As it does under Powerful Critical: once, the most the dice could roll added. */
    const POWERFUL = {
      perDie: 1,
      multiplyNumeric: false,
      powerfulCritical: true,
      altered: false,
    }
    /** A sheet from module 0.19.0, saying how the world rolls a critical hit's damage, or not. */
    const ruled = (critical: typeof DOUBLED | null = DOUBLED) => ({
      ...fullerSheet(),
      critical,
    })
    it("lets a description's damage be rolled as a critical hit's, every die as many times as the world's rules throw it", () => {
      const critical = textDamage({ critical: true, dice: diceOf(4, 2) })

      expect(check(critical, links, ruled())).toBeUndefined()
      expect(check(critical, links, ruled(POWERFUL))).toBe('dice')
      // Under Powerful Critical, its dice once, as they are.
      expect(
        check(textDamage({ critical: true }), links, ruled(POWERFUL)),
      ).toBeUndefined()
      expect(
        check(
          textDamage({ critical: true, types: ['cold'], dice: diceOf(4, 2) }),
          links,
          ruled(),
        ),
      ).toBeUndefined()
    })

    it.each([
      ['plainly', diceOf(2, 1)],
      ['with a die too few', diceOf(3, 2)],
      ['with a die too many', diceOf(5, 2)],
      ['with its second part’s plain', diceOf(4, 1)],
    ])("refuses a critical hit's damage thrown %s", (_name, dice) => {
      expect(check(textDamage({ critical: true, dice }), links, ruled())).toBe(
        'dice',
      )
    })

    it("refuses a critical hit's damage where the sheet doesn't say how the world rolls one", () => {
      const critical = textDamage({ critical: true, dice: diceOf(4, 2) })

      // It can't say, as under rules that add dice of their own.
      expect(check(critical, links, ruled(null))).toBe('dice')
      // From before module 0.19.0, which rolled every description's damage plainly.
      expect(check(critical, links, fullerSheet())).toBe('dice')
      expect(check(textDamage({ critical: true }), links, fullerSheet())).toBe(
        'dice',
      )
    })

    it("never lets healing be rolled as a critical hit's", () => {
      const healing = textDamage({
        link: 12,
        dice: [{ faces: 4, results: [1, 2] }],
      })

      expect(check(healing, links, ruled())).toBeUndefined()
      expect(
        check(
          {
            ...healing,
            critical: true,
            dice: [{ faces: 4, results: [1, 2, 3, 4] }],
          },
          links,
          ruled(),
        ),
      ).toBe('link')
      // But at its highest, or with more dice, as healing may be.
      expect(
        check(
          {
            ...healing,
            modifiers: { extra: 1, maximize: true },
            dice: [{ faces: 4, results: [4, 4, 4] }],
          },
          links,
          ruled(),
        ),
      ).toBeUndefined()
    })

    it("never lets damage the game marks as never a critical hit's be rolled as one, though it may be changed", () => {
      const poison = textDamage({
        link: 14,
        dice: [{ faces: 4, results: [3] }],
      })

      expect(check(poison, links, ruled())).toBeUndefined()
      expect(
        check(
          { ...poison, critical: true, dice: [{ faces: 4, results: [3, 1] }] },
          links,
          ruled(),
        ),
      ).toBe('link')
      expect(check({ ...poison, critical: true }, links, ruled())).toBe('link')
      expect(
        check(
          {
            ...poison,
            modifiers: { extra: 1 },
            dice: [{ faces: 4, results: [3, 1] }],
          },
          links,
          ruled(),
        ),
      ).toBeUndefined()
    })

    it("lets a description's damage be changed as an attack's may be: more of its first die, another size of it, its highest", () => {
      const sheet = ruled()

      expect(
        check(
          textDamage({ modifiers: { extra: 2 }, dice: diceOf(4, 1) }),
          links,
          sheet,
        ),
      ).toBeUndefined()
      expect(
        check(
          textDamage({ modifiers: { faces: 8 }, dice: diceOf(2, 1, 8) }),
          links,
          sheet,
        ),
      ).toBeUndefined()
      expect(
        check(textDamage({ modifiers: { maximize: true } }), links, sheet),
      ).toBeUndefined()
      expect(
        check(
          textDamage({
            modifiers: { extra: 1, faces: 10, maximize: true },
            dice: diceOf(3, 1, 10),
          }),
          links,
          sheet,
        ),
      ).toBeUndefined()
      // Not with the dice unchanged.
      expect(check(textDamage({ modifiers: { extra: 2 } }), links, sheet)).toBe(
        'dice',
      )
      expect(check(textDamage({ modifiers: { faces: 8 } }), links, sheet)).toBe(
        'dice',
      )
    })

    it("adds as many dice for each die added to a critical hit's as the world's rules throw of each", () => {
      expect(
        check(
          textDamage({
            critical: true,
            modifiers: { extra: 1 },
            dice: diceOf(6, 2),
          }),
          links,
          ruled(),
        ),
      ).toBeUndefined()
      expect(
        check(
          textDamage({
            critical: true,
            modifiers: { extra: 1 },
            dice: diceOf(5, 2),
          }),
          links,
          ruled(),
        ),
      ).toBe('dice')
      expect(
        check(
          textDamage({
            critical: true,
            modifiers: { extra: 2, faces: 12 },
            dice: diceOf(4, 1, 12),
          }),
          links,
          ruled(POWERFUL),
        ),
      ).toBeUndefined()
    })

    it("refuses a description's damage given more dice, or another die, where its first part throws none", () => {
      expect(check(fire({}), links, ruled())).toBeUndefined()
      expect(
        check(fire({ modifiers: { maximize: true } }), links, ruled()),
      ).toBeUndefined()
      expect(
        check(
          fire({
            modifiers: { extra: 1 },
            dice: [{ faces: 6, results: [4, 5] }],
          }),
          links,
          ruled(),
        ),
      ).toBe('dice')
      expect(
        check(
          fire({ modifiers: { faces: 8 }, dice: [{ faces: 8, results: [4] }] }),
          links,
          ruled(),
        ),
      ).toBe('dice')
    })

    it("refuses a description's damage changed where the game, before module 0.19.0, doesn't take it so", () => {
      const old = fullerSheet()

      expect(
        check(textDamage({ modifiers: { maximize: true } }), links, old),
      ).toBe('unavailable')
      expect(
        check(
          textDamage({ modifiers: { extra: 1 }, dice: diceOf(3, 1) }),
          links,
          old,
        ),
      ).toBe('unavailable')
      // Unchanged after all, it's as plain as any.
      expect(check(textDamage({ modifiers: {} }), links, old)).toBeUndefined()
      // Where the sheet can't say how the world rolls a critical hit's, it's still changed.
      expect(
        check(
          textDamage({ modifiers: { maximize: true } }),
          links,
          ruled(null),
        ),
      ).toBeUndefined()
    })

    it("lets a description's own roll be rolled with the dice its formula throws, and nothing else", () => {
      expect(check(textRoll())).toBeUndefined()
      expect(check(textRoll({ dice: [] }))).toBe('dice')
      expect(check(textRoll({ dice: [{ faces: 8, results: [5] }] }))).toBe(
        'dice',
      )
      expect(check(textRoll({ link: 6 }))).toBe('dice')
    })

    it.each([
      ['damage asked for a roll', textDamage({ link: 4 })],
      ['damage asked for a save', textDamage({ link: 0 })],
      ['a roll asked for damage', textRoll({ link: 3 })],
      ['a roll asked for a save', textRoll({ link: 0 })],
      ['a roll of a link the description has not', textRoll({ link: 9 })],
    ])('refuses %s', (_name, input) => {
      expect(check(input)).toBe('link')
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

    it('shows the hit points a hit die gave back in the game, where the game shows its player', () => {
      expect(spent(true, 9)).toMatchObject({ total: 9, healed: 9 })
      // Spent at full hit points, it gives back none.
      expect(spent(true, 0)).toMatchObject({ total: 9, healed: 0 })
      expect(spent(true, null)).not.toHaveProperty('healed')
      expect(spent(true)).not.toHaveProperty('healed')
      expect(spent(false, 9)).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
      })
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

    it("totals a description's damage's parts too", () => {
      expect(
        toRollRequestView(
          {
            ...madeDamage([damagePart(9), damagePart(7)]),
            kind: 'textDamage',
          },
          NOW,
        ),
      ).toMatchObject({ total: 16 })
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

    it("sends the link a description's roll is for, and the kinds of damage chosen", () => {
      const payload = request({
        kind: 'textDamage',
        key: undefined,
        text: TEXTS.secondWind,
        link: 3,
        dice: [{ faces: 6, results: [2, 6] }],
        types: ['cold', null],
      })

      expect(toCommand(held({ kind: 'textDamage', payload }))).toEqual({
        ...payload,
        id: 'req-1',
        actorId: 'actor-thorin',
      })
    })
  })
})
