import { checkRoll, isSeatCombatant } from './checks'
import {
  castingSheet,
  characterSheet,
  chargingSheet,
  counted,
  checkingSheet,
  combat,
  combatant,
  druidSheet,
  enchantingSheet,
  enchantment,
  enchantUse,
  frostBreathAction,
  fullerSheet,
  greataxeAction,
  aloneSheet,
  aloneSpells,
  burningHandsAction,
  hellishRebukeAction,
  pactSpells,
  mockCompanionSheet,
  rapierAction,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  shapedSheet,
  SLEIGHT_CHECK,
  TEXTS,
  WAND_LEVELS,
  wolfForm,
} from '@/mocks/sending-stone'
import { quillSheet, slimQuillSheet } from '@/mocks/slim-sheet'
import { parseGameEvent } from '@/schemas/sending-stone'
import type { RollRequestInput } from '@/types/roll'
import type {
  CharacterSheet,
  CriticalRule,
  SheetAction,
  SheetClass,
  FoundLink,
} from '@/types/sending-stone'

/** Damage's dice: `first` of a die, d6s unless said, then `fours` d4s. */
const diceOf = (first: number, fours: number, faces = 6) => [
  { faces, results: Array.from({ length: first }, () => 1) },
  { faces: 4, results: Array.from({ length: fours }, () => 2) },
]

/** A sheet saying how the world rolls a critical hit's damage, and the dice it adds. */
const ruledSo = (critical: CriticalRule | null) => ({
  ...fullerSheet(),
  critical,
})

/** A greataxe's critical hit's dice: so many d12s, then so many d6s of its critical damage. */
const greataxeDice = (twelves: number, sixes = 1) => [
  { faces: 12, results: Array.from({ length: twelves }, () => 7) },
  ...(sixes > 0
    ? [{ faces: 6, results: Array.from({ length: sixes }, () => 3) }]
    : []),
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

/** Dice of damage that takes a d4 away: so many d4s, then so many of another, d6s unless said. */
const lessD4 = (fours: number, others: number, faces = 6) => [
  { faces: 4, results: Array.from({ length: fours }, () => 2) },
  { faces, results: Array.from({ length: others }, () => 3) },
]

/** A description's link to necrotic damage of one part, of this formula, as held. */
const necroticLink = (n: number, formula: string): [number, FoundLink] => [
  n,
  {
    link: {
      kind: 'damage',
      n,
      parts: [{ formula, types: ['necrotic'] }],
      healing: false,
    },
    secret: false,
  },
]

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

/** A check of the player's own, made against an activity, from module 0.21.0. */
const own = (
  kind: 'skill' | 'tool' | 'ability',
  key: string,
  item: string,
  activity: string,
) => request({ kind, key, item, activity })

/**
 * Rook with only a feature, Quick Fingers, whose second activity uses its first, as a forward
 * does, from module 0.21.0: its check the first's, by its own id, and his own, or else another's.
 */
const quickFingers = (mine: boolean) =>
  checkingSheet({
    actions: [],
    features: [
      {
        id: 'rogue',
        label: 'Rogue Features',
        text: null,
        features: [
          {
            id: 'quick-fingers',
            name: 'Quick Fingers',
            img: null,
            kind: 'Class Feature',
            requirements: 'Rogue 3',
            activation: 'Bonus Action',
            passive: false,
            uses: { value: 2, max: 2, recovery: 'Long Rest' },
            text: null,
            activity: {
              id: 'qf-slt',
              type: 'check',
              targets: {
                self: true,
                area: false,
                count: null,
                perLevel: null,
                affects: null,
              },
            },
            check: { ...SLEIGHT_CHECK, own: mine },
            activities: [
              {
                id: 'qf-slt',
                name: 'Sleight of Hand',
                type: 'check',
                activation: 'Bonus Action',
                range: 'Self',
                target: null,
                toHit: null,
                attackId: null,
                activity: {
                  id: 'qf-slt',
                  type: 'check',
                  targets: {
                    self: true,
                    area: false,
                    count: null,
                    perLevel: null,
                    affects: null,
                  },
                },
                save: null,
                damage: [],
                check: { ...SLEIGHT_CHECK, own: mine },
                uses: null,
              },
              {
                id: 'qf-again',
                name: 'Sleight of Hand Again',
                type: 'forward',
                activation: 'Reaction',
                range: 'Self',
                target: null,
                toHit: null,
                attackId: null,
                // As the activity it's used through, by its own id.
                activity: {
                  id: 'qf-again',
                  type: 'check',
                  targets: {
                    self: true,
                    area: false,
                    count: null,
                    perLevel: null,
                    affects: null,
                  },
                },
                save: null,
                damage: [],
                check: { ...SLEIGHT_CHECK, own: mine },
                forward: { charges: 1, short: false },
                uses: { value: 2, max: 2, recovery: 'Long Rest' },
              },
            ],
          },
        ],
      },
    ],
  })

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

/** Hit dice spent at once, this many of each size, each die landing on 4. */
const hitDiceRequest = (...counts: [string, number][]) =>
  request({
    kind: 'hitDice',
    key: undefined,
    hitDice: counts.map(([denomination, count]) => ({ denomination, count })),
    dice: counts.map(([denomination, count]) => ({
      faces: Number(denomination.slice(1)),
      results: Array.from({ length: count }, () => 4),
    })),
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

/** The first so many of the combatants a spell an item casts is cast at. */
const castAt = (count: number) =>
  ['c-goblin', 'c-hob', 'c-ogre', 'c-wolf', 'c-bat', 'c-rat'].slice(0, count)

/** The sheet, the Bardic Flame casting Hex at 1st or 2nd level, for 1 or 2 charges. */
const hexHigher = (short = false) => {
  const sheet = castingSheet()
  const flame = sheet.actions[0].actions[1]
  const [strike, hex] = flame.activities!
  flame.activities = [
    strike,
    {
      ...hex,
      cast: {
        ...hex.cast!,
        levels: [
          { level: 1, charges: 1, short: false },
          { level: 2, charges: 2, short },
        ],
      },
    },
  ]
  return sheet
}

/** A staff casting a spell attack, and one whose area takes more cast higher. */
const castingStaves = () => {
  const sheet = castingSheet()
  const cast = {
    level: 1,
    concentration: false,
    charges: 1,
    short: false,
    levels: WAND_LEVELS,
  }
  sheet.actions[0].actions.push(
    sheetAction({
      id: 'staff',
      name: 'Staff of Bolts',
      type: 'weapon',
      toHit: 6,
      attackId: 'cast-bolt',
      damage: [{ formula: '4d6', type: 'Radiant', healing: false }],
      cast,
      spellId: 'bolt',
    }),
    sheetAction({
      id: 'horn',
      name: 'Horn of Spray',
      type: 'equipment',
      toHit: 6,
      attackId: 'cast-spray',
      attackArea: { count: 2, perLevel: 1, affects: 'creature' },
      cast,
      spellId: 'spray',
    }),
  )
  return sheet
}

describe('utils/roll-requests', () => {
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

  describe('checkRoll for a spell an item casts, from module 0.20.0', () => {
    const fight = combat({
      combatants: ['goblin', 'hob', 'ogre', 'wolf', 'bat', 'rat'].map(name =>
        combatant({ id: `c-${name}`, name }),
      ),
    })
    const check = (input: RollRequestInput, sheet = castingSheet()) =>
      checkRoll(input, sheet, [fight], 'actor-thorin')

    it('casts it at any level the item offers, its own too, and its copy and later activities at those of its Cast', () => {
      for (const slot of ['spell1', 'spell2', 'spell3']) {
        expect(
          check(useRequest('mm-wand', 'cast-mm', castAt(3), { slot })),
        ).toBeUndefined()
        expect(
          check(useRequest('mm', 'mm-darts', castAt(3), { slot })),
        ).toBeUndefined()
      }
      for (const activity of ['hex-curse', 'hex-dmg']) {
        expect(
          check(
            useRequest('hex', activity, castAt(1), { slot: 'spell2' }),
            hexHigher(),
          ),
        ).toBeUndefined()
      }
    })

    it('leaves whether the item has the charges for it to the game, and uses a later activity that spends none at a level it is short of', () => {
      expect(
        check(
          useRequest('flame', 'cast-hex', castAt(1), { slot: 'spell2' }),
          hexHigher(true),
        ),
      ).toBeUndefined()
      expect(
        check(
          useRequest('hex', 'hex-dmg', castAt(1), { slot: 'spell2' }),
          hexHigher(true),
        ),
      ).toBeUndefined()
    })

    it.each([
      [
        'a level it does not offer',
        useRequest('mm-wand', 'cast-mm', [], { slot: 'spell4' }),
      ],
      ['pact magic', useRequest('mm-wand', 'cast-mm', [], { slot: 'pact' })],
      [
        'a level its copy does not offer',
        useRequest('mm', 'mm-darts', [], { slot: 'spell5' }),
      ],
      [
        'any level for one cast at its own alone',
        useRequest('flame', 'cast-hex', [], { slot: 'spell1' }),
      ],
      [
        'any level for its copy',
        useRequest('hex', 'hex-curse', [], { slot: 'spell1' }),
      ],
      [
        'any level for its later activity',
        useRequest('hex', 'hex-dmg', [], { slot: 'spell1' }),
      ],
    ])('refuses it at %s', (_name, input) => {
      expect(check(input)).toBe('slot')
    })

    it('casts it with no level chosen, as before, at the one it is cast at', () => {
      expect(check(useRequest('mm-wand', 'cast-mm', castAt(3)))).toBeUndefined()
      expect(check(useRequest('mm-wand', 'cast-mm', castAt(4)))).toBe('target')
      expect(check(useRequest('flame', 'cast-hex', castAt(1)))).toBeUndefined()
      expect(check(useRequest('hex', 'hex-dmg', castAt(1)))).toBeUndefined()
    })

    it('takes more targets for each level it is cast above the one it is cast at by default', () => {
      for (const item of [
        ['mm-wand', 'cast-mm'],
        ['mm', 'mm-darts'],
      ]) {
        const [id, activity] = item
        expect(
          check(useRequest(id, activity, castAt(4), { slot: 'spell2' })),
        ).toBeUndefined()
        expect(
          check(useRequest(id, activity, castAt(5), { slot: 'spell2' })),
        ).toBe('target')
        expect(
          check(useRequest(id, activity, castAt(5), { slot: 'spell3' })),
        ).toBeUndefined()
        expect(
          check(useRequest(id, activity, castAt(6), { slot: 'spell3' })),
        ).toBe('target')
      }

      // Cast at 2nd level, Magic Missile takes 4, and one more at 3rd, as its copy does too,
      // though the copy is of a 1st-level spell.
      const sheet = castingSheet()
      const wand = sheet.actions[0].actions[0]
      const levels = WAND_LEVELS.slice(1)
      sheet.actions[0].actions[0] = {
        ...wand,
        activity: {
          ...wand.activity!,
          targets: { ...wand.activity!.targets, count: 4 },
        },
        cast: { ...wand.cast!, level: 2, charges: 2, levels },
      }
      const copy = sheet.spells[0].spells[0]
      sheet.spells[0].spells[0] = {
        ...copy,
        activity: {
          ...copy.activity!,
          targets: { ...copy.activity!.targets, count: 4 },
        },
      }
      for (const [id, activity] of [
        ['mm-wand', 'cast-mm'],
        ['mm', 'mm-darts'],
      ]) {
        expect(
          check(useRequest(id, activity, castAt(4)), sheet),
        ).toBeUndefined()
        expect(check(useRequest(id, activity, castAt(5)), sheet)).toBe('target')
        expect(
          check(useRequest(id, activity, castAt(5), { slot: 'spell3' }), sheet),
        ).toBeUndefined()
        expect(
          check(useRequest(id, activity, castAt(6), { slot: 'spell3' }), sheet),
        ).toBe('target')
      }
    })

    it('makes a spell attack at a level the item offers, its area taking more higher', () => {
      const sheet = castingStaves()
      const bolt = (slot?: string) =>
        check(
          attackRequest({
            item: 'staff',
            activity: 'cast-bolt',
            ...targetAt('c-goblin'),
            ...(slot && { slot }),
          }),
          sheet,
        )
      expect(bolt()).toBeUndefined()
      expect(bolt('spell3')).toBeUndefined()
      expect(bolt('spell4')).toBe('slot')
      expect(bolt('pact')).toBe('slot')

      const spray = (count: number, slot?: string) =>
        check(
          areaRequest(
            'horn',
            'cast-spray',
            castAt(count),
            slot ? { slot } : {},
          ),
          sheet,
        )
      expect(spray(2)).toBeUndefined()
      expect(spray(3)).toBe('target')
      expect(spray(3, 'spell2')).toBeUndefined()
      expect(spray(5, 'spell3')).toBe('target')
    })
  })

  describe('checkRoll for checks activities ask for, and activities that use others, from module 0.21.0', () => {
    const fight = combat({
      combatants: [
        combatant({ id: 'c-goblin', name: 'Goblin' }),
        combatant({ id: 'c-hob', name: 'Hobgoblin' }),
        combatant({ id: 'c-ogre', name: 'Ogre' }),
        combatant({ id: 'c-vex', name: 'Vex', playerOwned: true }),
      ],
    })
    const check = (input: RollRequestInput, sheet = checkingSheet()) =>
      checkRoll(input, sheet, [fight], 'actor-rook')

    it("lets the player roll their own check an activity asks for, each way it may be made, wherever it's listed", () => {
      // Fast Hands, whose Sleight of Hand is its first activity, and Thieves' Tools a later one.
      expect(check(own('skill', 'slt', 'fast-hands', 'fh-slt'))).toBeUndefined()
      expect(
        check(own('tool', 'thief', 'fast-hands', 'fh-thief')),
      ).toBeUndefined()
      // Thieves' Tools, listed as an action and in the inventory.
      expect(check(own('tool', 'thief', 'tools', 'pick'))).toBeUndefined()
      expect(
        check(own('tool', 'thief', 'tools', 'pick'), {
          ...checkingSheet(),
          actions: [],
        }),
      ).toBeUndefined()
    })

    it('lets an ability check an activity asks for be rolled by its ability', () => {
      const sheet = checkingSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'manacles',
                name: 'Manacles',
                type: 'equipment',
                activity: {
                  id: 'burst',
                  type: 'check',
                  targets: {
                    self: true,
                    area: false,
                    count: null,
                    perLevel: null,
                    affects: null,
                  },
                },
                check: {
                  checks: [{ type: 'check', ability: 'str' }],
                  dc: 25,
                  own: true,
                },
              }),
            ],
          },
        ],
      })
      expect(
        check(own('ability', 'str', 'manacles', 'burst'), sheet),
      ).toBeUndefined()
      expect(check(own('ability', 'dex', 'manacles', 'burst'), sheet)).toBe(
        'unknown',
      )
      expect(check(own('skill', 'str', 'manacles', 'burst'), sheet)).toBe(
        'unknown',
      )
    })

    it('reads the check from the activity alone, not the sheet’s skills and tools', () => {
      // dnd5e makes a tool's check with the tool or without it.
      expect(
        check(own('tool', 'thief', 'tools', 'pick'), {
          ...checkingSheet(),
          tools: [],
          skills: [],
        }),
      ).toBeUndefined()
      expect(
        check(own('skill', 'slt', 'fast-hands', 'fh-slt'), {
          ...checkingSheet(),
          skills: [],
        }),
      ).toBeUndefined()
    })

    it.each([
      ['a way it may not be made', own('skill', 'ste', 'fast-hands', 'fh-slt')],
      ['a tool check of its skill', own('tool', 'slt', 'fast-hands', 'fh-slt')],
      ['another activity’s way', own('tool', 'thief', 'fast-hands', 'fh-slt')],
      [
        'an activity that asks for none',
        own('skill', 'slt', 'fast-hands', 'fh-use'),
      ],
      ['one another creature makes', own('skill', 'inv', 'maze', 'maze-cast')],
      ['an item the sheet hasn’t', own('skill', 'slt', 'gloves', 'fh-slt')],
      [
        'an activity its item hasn’t',
        own('skill', 'slt', 'fast-hands', 'nope'),
      ],
    ])('refuses a check made against %s', (_name, input) => {
      expect(check(input)).toBe('unknown')
    })

    it('lets a check a feature asks for through an activity that uses another be rolled by that activity’s id, where it’s the character’s own', () => {
      expect(
        check(
          own('skill', 'slt', 'quick-fingers', 'qf-again'),
          quickFingers(true),
        ),
      ).toBeUndefined()
      expect(
        check(
          own('skill', 'slt', 'quick-fingers', 'qf-slt'),
          quickFingers(true),
        ),
      ).toBeUndefined()
      expect(
        check(
          own('skill', 'slt', 'quick-fingers', 'qf-again'),
          quickFingers(false),
        ),
      ).toBe('unknown')
      expect(
        check(
          own('skill', 'slt', 'quick-fingers', 'qf-slt'),
          quickFingers(false),
        ),
      ).toBe('unknown')
    })

    it('refuses a check made against an activity of an item not identified, or without a sheet', () => {
      const sheet = checkingSheet()
      sheet.actions[0].actions[0] = {
        ...sheet.actions[0].actions[0],
        identified: false,
      }
      sheet.inventory.sections = []
      expect(check(own('tool', 'thief', 'tools', 'pick'), sheet)).toBe(
        'unknown',
      )
      expect(
        checkRoll(own('tool', 'thief', 'tools', 'pick'), undefined, [], 'x'),
      ).toBe('unknown')
    })

    it('lets an activity that asks for a check be used, at no more than it takes, with a slot left for a spell', () => {
      expect(check(useRequest('tools', 'pick', []))).toBeUndefined()
      expect(check(useRequest('fast-hands', 'fh-thief', []))).toBeUndefined()
      expect(check(useRequest('maze', 'maze-cast', ['c-goblin']))).toBe(
        undefined,
      )
      expect(
        check(
          useRequest('maze', 'maze-cast', ['c-goblin'], { slot: 'spell8' }),
        ),
      ).toBeUndefined()
      expect(
        check(useRequest('maze', 'maze-cast', ['c-goblin', 'c-hob'])),
      ).toBe('target')
      expect(
        check(useRequest('maze', 'maze-cast', [], { slot: 'spell1' })),
      ).toBe('slot')
    })

    it('lets an activity that uses another be used as the other is, by its own id, with any slot chosen or none', () => {
      const three = ['c-goblin', 'c-hob', 'c-vex']
      expect(check(useRequest('bless', 'bless-free', three))).toBeUndefined()
      // Its spell is cast at its own level, whatever slot is chosen, as dnd5e casts it, though
      // none of its 1st-level slots are left.
      for (const slot of ['spell1', 'spell3', 'spell8', 'pact', null]) {
        expect(
          check(useRequest('bless', 'bless-free', three, { slot })),
        ).toBeUndefined()
      }
      // At its own level, it takes no more.
      expect(
        check(useRequest('bless', 'bless-free', [...three, 'c-ogre'])),
      ).toBe('target')
      // The spell itself is cast with a slot as ever.
      expect(
        check(useRequest('bless', 'bless-cast', three, { slot: 'spell1' })),
      ).toBe('slot')
      expect(
        check(useRequest('bless', 'bless-cast', three, { slot: 'spell8' })),
      ).toBeUndefined()
    })

    it("lets a spell's check activity that spends no slot, such as Silent Image's, be used at any of its pools, left or not", () => {
      const investigate = {
        id: 'investigate',
        name: 'Investigate',
        type: 'check',
        activation: null,
        range: '60 ft',
        target: null,
        toHit: null,
        attackId: null,
        activity: {
          id: 'investigate',
          type: 'check' as const,
          targets: {
            self: false,
            area: false,
            count: 1,
            perLevel: null,
            affects: 'creature',
          },
        },
        save: null,
        damage: [],
        consumesSlot: false,
        check: {
          checks: [{ type: 'skill' as const, ability: 'int', key: 'inv' }],
          dc: 13,
          own: false,
        },
        uses: null,
      }
      const image = sheetSpell({
        id: 'image',
        name: 'Silent Image',
        prepared: 1,
        activity: {
          id: 'illusion',
          type: 'utility',
          targets: {
            self: false,
            area: true,
            count: null,
            perLevel: null,
            affects: null,
          },
        },
        toHit: null,
        save: null,
        damage: [],
        activities: [
          { ...investigate, id: 'illusion', type: 'utility', check: undefined },
          investigate,
        ],
      })
      const sheet = checkingSheet()
      sheet.spells[0].spells.push(image)
      for (const slot of ['spell1', 'spell8', null]) {
        expect(
          check(
            useRequest('image', 'investigate', ['c-goblin'], { slot }),
            sheet,
          ),
        ).toBeUndefined()
      }
      expect(
        check(
          useRequest('image', 'investigate', ['c-goblin'], { slot: 'pact' }),
          sheet,
        ),
      ).toBe('slot')
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

  describe('checkRoll for hit dice spent at once, from module 0.20.0', () => {
    it('lets the character spend as many of each size as its classes of that size have left, together', () => {
      // Thorin's Fighter levels have 3 of their 5 d10s left.
      expect(checkSheet(hitDiceRequest(['d10', 3]))).toBeUndefined()
      // Two classes of one size, each with some left: as many as both together.
      const sheet = classed(
        { die: 'd10', value: 1, max: 3 },
        { die: 'd10', value: 2, max: 2 },
        { die: 'd8', value: 2, max: 2 },
      )
      expect(
        checkSheet(hitDiceRequest(['d10', 3], ['d8', 2]), sheet),
      ).toBeUndefined()
      expect(checkSheet(hitDiceRequest(['d8', 1]), sheet)).toBeUndefined()
    })

    it("leaves how many there are of a size to the game where the sheet doesn't say for one of its classes", () => {
      expect(
        checkSheet(
          hitDiceRequest(['d10', 5], ['d6', 1]),
          classed(
            { die: 'd10', value: null, max: 3 },
            { die: 'd10', value: 0, max: 2 },
            { die: 'd6', value: 1, max: 1 },
          ),
        ),
      ).toBeUndefined()
      // Only for that size: a size after it is checked all the same.
      const unsaid = classed(
        { die: 'd10', value: null, max: 3 },
        { die: 'd8', value: 1, max: 2 },
      )
      expect(checkSheet(hitDiceRequest(['d10', 1], ['d8', 3]), unsaid)).toBe(
        'no-hit-dice',
      )
      expect(checkSheet(hitDiceRequest(['d10', 1], ['d6', 1]), unsaid)).toBe(
        'unknown',
      )
    })

    it('refuses more of a size than the character has left of it', () => {
      const sheet = classed(
        { die: 'd10', value: 1, max: 3 },
        { die: 'd10', value: 2, max: 2 },
        { die: 'd8', value: 0, max: 2 },
      )
      expect(checkSheet(hitDiceRequest(['d10', 4]), sheet)).toBe('no-hit-dice')
      expect(checkSheet(hitDiceRequest(['d10', 1], ['d8', 1]), sheet)).toBe(
        'no-hit-dice',
      )
      expect(checkSheet(hitDiceRequest(['d10', 4]))).toBe('no-hit-dice')
    })

    it('refuses a size no class of the character has, or a character without a sheet', () => {
      expect(checkSheet(hitDiceRequest(['d10', 1], ['d8', 1]))).toBe('unknown')
      expect(checkSheet(hitDiceRequest(['d10', 1]), characterSheet())).toBe(
        'unknown',
      )
      expect(
        checkRoll(hitDiceRequest(['d10', 1]), undefined, [], 'actor-thorin'),
      ).toBe('unknown')
    })

    it('leaves whether the character is at full hit points to the game', () => {
      expect(
        checkSheet(
          hitDiceRequest(['d10', 2]),
          fullerSheet({ hp: { value: 44, max: 44, temp: 0 } }),
        ),
      ).toBeUndefined()
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
      features?: readonly string[],
    ) => checkRoll(input, sheet, [], 'actor-thorin', held, features)

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

    /** Damage of 3 less 1d4, and 2d6, at link 0 of those that take dice away; plain unless said. */
    const withering = (fields: Partial<RollRequestInput> = {}) =>
      textDamage({ link: 0, dice: lessD4(1, 2), ...fields })
    /** A Reduced Unarmed Strike's bare damage, - 1d4 + 4, at their link 1; plain unless said. */
    const strike = (fields: Partial<RollRequestInput> = {}) =>
      textDamage({ link: 1, dice: lessD4(1, 0).slice(0, 1), ...fields })

    describe('that takes dice away', () => {
      /** Links to damage that takes dice away. */
      const taken = new Map([
        necroticLink(0, '3 - 1d4 + 2d6'),
        necroticLink(1, '- 1d4 + 4'),
        necroticLink(2, '2d6 - 1d4'),
      ])
      /** What a module from 0.21.0 says it does: changes only a die damage adds. */
      const SIGNED = ['modifiers', 'signedDice']
      /** What one before says: it changes damage's first die whatever its sign. */
      const UNSIGNED = ['modifiers']

      it('changes the first die it adds, never one it takes away', () => {
        expect(check(withering(), taken, ruled(), SIGNED)).toBeUndefined()
        expect(
          check(
            withering({ modifiers: { extra: 1 }, dice: lessD4(1, 3) }),
            taken,
            ruled(),
            SIGNED,
          ),
        ).toBeUndefined()
        expect(
          check(
            withering({ modifiers: { faces: 8 }, dice: lessD4(1, 2, 8) }),
            taken,
            ruled(),
            SIGNED,
          ),
        ).toBeUndefined()
        expect(
          check(
            withering({ modifiers: { extra: 1 }, dice: lessD4(2, 2) }),
            taken,
            ruled(),
            SIGNED,
          ),
        ).toBe('dice')
        // Damage that adds no die of its own has none to change.
        expect(check(strike(), taken, ruled(), SIGNED)).toBeUndefined()
        expect(
          check(
            strike({
              modifiers: { extra: 1 },
              dice: [{ faces: 4, results: [1, 2] }],
            }),
            taken,
            ruled(),
            SIGNED,
          ),
        ).toBe('dice')
      })

      it('changes none, for a module before 0.21.0, where the die it would change is one it takes away', () => {
        // It would throw the d4 more, and less damage: none changed.
        expect(
          check(
            withering({ modifiers: { extra: 1 }, dice: lessD4(1, 3) }),
            taken,
            ruled(),
            UNSIGNED,
          ),
        ).toBe('dice')
        expect(
          check(
            withering({ modifiers: { extra: 1 }, dice: lessD4(2, 2) }),
            taken,
            ruled(),
            UNSIGNED,
          ),
        ).toBe('dice')
        // Unchanged, as it was.
        expect(check(withering(), taken, ruled(), UNSIGNED)).toBeUndefined()
        // Where its first die is one it adds, that one, as either module changes it.
        const first = textDamage({
          link: 2,
          modifiers: { extra: 1 },
          dice: [
            { faces: 6, results: [3, 3, 3] },
            { faces: 4, results: [2] },
          ],
        })
        expect(check(first, taken, ruled(), UNSIGNED)).toBeUndefined()
        expect(check(first, taken, ruled(), SIGNED)).toBeUndefined()
        // Never at its highest where it takes a die away, whichever the module.
        expect(
          check(
            strike({ modifiers: { maximize: true } }),
            taken,
            ruled(),
            UNSIGNED,
          ),
        ).toBe('dice')
      })

      it('takes the game for a module before 0.21.0 where the campaign says nothing of its dice', () => {
        const more = withering({ modifiers: { extra: 1 }, dice: lessD4(1, 3) })
        expect(checkRoll(more, ruled(), [], 'actor-thorin', taken)).toBe('dice')
        expect(
          checkRoll(more, ruled(), [], 'actor-thorin', taken, SIGNED),
        ).toBeUndefined()
      })

      it('never rolls it at its highest, which would take the most away', () => {
        expect(
          check(withering({ modifiers: { maximize: true } }), taken, ruled()),
        ).toBe('dice')
        expect(
          check(strike({ modifiers: { maximize: true } }), taken, ruled()),
        ).toBe('dice')
      })

      it("rolls it as a critical hit's, the die it takes away doubled too, but not under Powerful Critical", () => {
        const critical = strike({
          critical: true,
          dice: [{ faces: 4, results: [1, 2] }],
        })
        expect(check(critical, taken, ruled())).toBeUndefined()
        // Whose most some rules add and others take away.
        expect(
          check(
            strike({ critical: true }),
            taken,
            ruledSo({ ...POWERFUL, bonusDice: 'rolled' }),
          ),
        ).toBe('dice')
      })
    })

    describe('with what a critical hit adds, from module 0.20.0', () => {
      /** A greataxe's 1d12 + 4, to which Savage Attacks adds a die, and the weapon 1d6. */
      const greataxe: FoundLink = {
        link: {
          kind: 'damage',
          n: 0,
          parts: [{ formula: '1d12 + 4', types: ['slashing'] }],
          healing: false,
          criticalAdds: { dice: [1], damage: ['1d6'] },
        },
        secret: false,
      }
      /** A javelin's 1d6 + 4, to which a critical hit adds 4. */
      const javelin: FoundLink = {
        link: {
          kind: 'damage',
          n: 1,
          parts: [{ formula: '1d6 + 4', types: ['piercing'] }],
          healing: false,
          criticalAdds: { dice: [0], damage: ['4'] },
        },
        secret: false,
      }
      const adding = new Map([
        [0, greataxe],
        [1, javelin],
      ])
      const rolled = { ...DOUBLED, bonusDice: 'rolled' as const }
      const chop = (fields: Partial<RollRequestInput> = {}) =>
        textDamage({
          link: 0,
          critical: true,
          dice: greataxeDice(3),
          ...fields,
        })

      it('takes its extra dice on its first die and its critical damage after, as the world throws them', () => {
        expect(check(chop(), adding, ruledSo(rolled))).toBeUndefined()
        // Under Powerful Critical, its die once and the extra die thrown with it.
        expect(
          check(
            chop({ dice: greataxeDice(2) }),
            adding,
            ruledSo({ ...POWERFUL, bonusDice: 'rolled' }),
          ),
        ).toBeUndefined()
        // Under Midi-QOL's maxCrit, the extra die's most added, not thrown.
        expect(
          check(
            chop({ dice: greataxeDice(1) }),
            adding,
            ruledSo({ ...POWERFUL, bonusDice: 'maximized' }),
          ),
        ).toBeUndefined()
        // Changed, the extra die thrown at the size its first die is made.
        expect(
          check(
            chop({
              modifiers: { extra: 1, faces: 10 },
              dice: [
                { faces: 10, results: [1, 2, 3, 4, 5] },
                { faces: 6, results: [3] },
              ],
            }),
            adding,
            ruledSo(rolled),
          ),
        ).toBeUndefined()
      })

      it.each([
        ['without the extra die', greataxeDice(2)],
        ['without the critical damage', greataxeDice(3, 0)],
        ['with the critical damage first', greataxeDice(3).toReversed()],
        ['with its dice doubled alone', greataxeDice(2, 2)],
      ])('refuses it %s', (_, dice) => {
        expect(check(chop({ dice }), adding, ruledSo(rolled))).toBe('dice')
      })

      it.each([
        ['can’t say', null],
        ['is from a module before 0.20.0', undefined],
      ])(
        'refuses dice added where the world’s rule %s how it throws them, but takes numbers added',
        (_, bonusDice) => {
          const rule = { ...DOUBLED, bonusDice }
          expect(check(chop(), adding, ruledSo(rule))).toBe('dice')
          expect(
            check(chop({ dice: greataxeDice(2, 0) }), adding, ruledSo(rule)),
          ).toBe('dice')
          // A javelin's 4 throws no die.
          expect(
            check(
              textDamage({
                link: 1,
                critical: true,
                dice: [{ faces: 6, results: [2, 5] }],
              }),
              adding,
              ruledSo(rule),
            ),
          ).toBeUndefined()
        },
      )

      it('refuses it where the sheet doesn’t say how the world makes one at all', () => {
        expect(check(chop(), adding, ruledSo(null))).toBe('dice')
        expect(check(chop(), adding, fullerSheet())).toBe('dice')
      })

      it('takes it plainly, as it is, what a critical hit adds left out', () => {
        expect(
          check(
            chop({ critical: undefined, dice: greataxeDice(1, 0) }),
            adding,
            ruledSo(rolled),
          ),
        ).toBeUndefined()
        expect(
          check(chop({ critical: undefined }), adding, ruledSo(rolled)),
        ).toBe('dice')
      })

      it('still refuses damage marked never a critical hit’s without what one adds', () => {
        const poison = textDamage({
          link: 14,
          critical: true,
          dice: [{ faces: 4, results: [3, 1] }],
        })
        expect(check(poison, links, ruledSo(rolled))).toBe('link')
      })
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
})

/** A use or an enchantment ended, as Ari's sheet has it, checked. */
const enchantCheck = (
  fields: Partial<RollRequestInput>,
  sheet = enchantingSheet(),
) =>
  checkRoll(
    request({ mode: 0, dice: [], key: undefined, ...fields }),
    sheet,
    [],
    'actor-ari',
  )

/** Magic Weapon cast so, its way and item chosen. */
const magicWeapon = (
  profile: string | undefined,
  slot?: string | null,
  fields: Partial<RollRequestInput> = {},
) =>
  enchantCheck({
    kind: 'use',
    item: 'magicweapon',
    activity: 'mw-cast',
    targets: [],
    ...(slot !== undefined && { slot }),
    ...(profile && { enchant: { profile, item: 'longsword' } }),
    ...fields,
  })

const PLUS_ONE = 'SLSudYaACjmmmZsU'
const PLUS_TWO = '8OhsRxK3dF1JeQXO'
const PLUS_THREE = '7L1wKfaEdN85IA0Z'

/** Shillelagh cast in its only way, on this item or none. */
const shillelagh = (item?: string) =>
  enchantCheck({
    kind: 'use',
    item: 'shillelagh',
    activity: 'shill-cast',
    targets: [],
    enchant: { profile: 'Oy8fP2N3q4R5s6T7', ...(item && { item }) },
  })

/** Engulf in Flames set alight, in this way or its one, on this item or none. */
const engulf = (
  item?: string,
  profile = 'ablazeProfile01',
  sheet?: ReturnType<typeof enchantingSheet>,
) =>
  enchantCheck(
    {
      kind: 'use',
      item: 'flametongue',
      activity: 'engulf',
      targets: [],
      enchant: { profile, ...(item && { item }) },
    },
    sheet,
  )

/**
 * Ari's sheet with her Flame Tongue alight, its Engulf in Flames setting it alight in two ways, as
 * a module might, the first of them on it.
 */
const alight = () => {
  const sheet = enchantingSheet()
  const engulfing = sheet.inventory.sections[0].items[3].activities![1]
  engulfing.activity = enchantUse('engulf', {
    ...engulfing.activity!.enchant,
    profiles: [
      { id: 'ablazeProfile01', name: 'Ablaze', min: null, max: null },
      { id: 'frostProfile001', name: 'Frost', min: null, max: null },
    ],
    applied: [
      {
        item: 'flametongue',
        effect: 'ablazeEffect001',
        profile: 'ablazeProfile01',
      },
    ],
  })
  return sheet
}

/** An enchantment ended. */
const end = (
  item: string,
  effect: string,
  sheet?: ReturnType<typeof enchantingSheet>,
) =>
  enchantCheck({ kind: 'endEnchantment', enchantment: { item, effect } }, sheet)

describe('utils/roll-requests for enchant activities, from module 0.21.0', () => {
  describe('checkRoll for a use', () => {
    it('lets Magic Weapon enchant in a way offered at the level it is cast at', () => {
      expect(magicWeapon(PLUS_ONE, 'spell2')).toBeUndefined()
      expect(magicWeapon(PLUS_ONE, 'spell3')).toBeUndefined()
      expect(magicWeapon(PLUS_TWO, 'spell4')).toBeUndefined()
    })

    it('refuses a way not offered at the level it is cast at, or chosen with no slot where there are slots', () => {
      expect(magicWeapon(PLUS_TWO, 'spell2')).toBe('profile')
      expect(magicWeapon(PLUS_ONE, 'spell4')).toBe('profile')
      expect(magicWeapon(PLUS_THREE, 'spell4')).toBe('profile')
      expect(magicWeapon(PLUS_ONE)).toBe('profile')
      expect(magicWeapon(PLUS_ONE, null)).toBe('profile')
    })

    it('refuses a use of an enchant activity with no way, or one it hasn’t', () => {
      expect(magicWeapon(undefined, 'spell2')).toBe('profile')
      expect(magicWeapon('Oy8fP2N3q4R5s6T7', 'spell2')).toBe('profile')
    })

    it('still refuses a slot of which none is left, first', () => {
      const spent = enchantingSheet()
      spent.spells[3].slots = { value: 0, max: 1, level: 4 }
      expect(
        enchantCheck(
          {
            kind: 'use',
            item: 'magicweapon',
            activity: 'mw-cast',
            targets: [],
            slot: 'spell4',
            enchant: { profile: PLUS_TWO },
          },
          spent,
        ),
      ).toBe('slot')
    })

    it('lets a cantrip enchant in its only way with no slot, an item it may, or none', () => {
      expect(shillelagh('club')).toBeUndefined()
      expect(shillelagh()).toBeUndefined()
      expect(shillelagh('longsword')).toBe('enchant-target')
      expect(shillelagh('flametongue')).toBe('enchant-target')
    })

    it('refuses an item for one that enchants its own', () => {
      expect(engulf()).toBeUndefined()
      expect(engulf('flametongue')).toBe('enchant-target')
      expect(engulf('longsword')).toBe('enchant-target')
    })

    it('refuses one that enchants its own item in the way it is on it already, as only a sheet out of date sends, but lets it in another', () => {
      expect(engulf(undefined, 'ablazeProfile01', alight())).toBe('applied')
      expect(engulf(undefined, 'frostProfile001', alight())).toBeUndefined()
    })

    it('refuses an item for one that enchants its own before the way it is on it already', () => {
      expect(engulf('flametongue', 'ablazeProfile01', alight())).toBe(
        'enchant-target',
      )
    })

    it('lets one that enchants another item enchant one in the way it is on already, which the game replaces', () => {
      const sheet = enchantingSheet()
      sheet.spells[0].spells[0].activity!.enchant!.applied = [
        { item: 'club', effect: 'shillEffect02', profile: 'Oy8fP2N3q4R5s6T7' },
      ]
      expect(
        enchantCheck(
          {
            kind: 'use',
            item: 'shillelagh',
            activity: 'shill-cast',
            targets: [],
            enchant: { profile: 'Oy8fP2N3q4R5s6T7', item: 'club' },
          },
          sheet,
        ),
      ).toBeUndefined()
    })

    it('refuses targets for an enchant activity', () => {
      const fight = combat({
        combatants: [combatant({ id: 'c-goblin', name: 'Goblin' })],
      })
      expect(
        checkRoll(
          request({
            kind: 'use',
            key: undefined,
            dice: [],
            item: 'magicweapon',
            activity: 'mw-cast',
            slot: 'spell2',
            targets: [{ combatId: fight.id, combatantId: 'c-goblin' }],
            enchant: { profile: PLUS_ONE },
          }),
          enchantingSheet(),
          [fight],
          'actor-ari',
        ),
      ).toBe('target')
    })

    it('refuses how an enchant activity enchants for any other activity', () => {
      const sheet = enchantingSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'breath',
                name: 'Breath Weapon',
                save: { ability: 'dex', dc: 13 },
                activity: {
                  ...enchantUse('breath-save'),
                  type: 'save',
                  enchant: undefined,
                },
              }),
            ],
          },
        ],
      })
      const breathe = (fields: Partial<RollRequestInput>) =>
        enchantCheck(
          {
            kind: 'use',
            item: 'breath',
            activity: 'breath-save',
            targets: [],
            ...fields,
          },
          sheet,
        )
      expect(breathe({})).toBeUndefined()
      expect(breathe({ enchant: { profile: PLUS_ONE } })).toBe('unknown')
    })

    it('refuses an enchant activity the module can’t say what it enchants of, as one it doesn’t send', () => {
      const sheet = enchantingSheet()
      sheet.spells[1].spells[0].activity = {
        ...sheet.spells[1].spells[0].activity!,
        enchant: undefined,
      }
      expect(
        enchantCheck(
          {
            kind: 'use',
            item: 'magicweapon',
            activity: 'mw-cast',
            targets: [],
            slot: 'spell2',
            enchant: { profile: PLUS_ONE },
          },
          sheet,
        ),
      ).toBe('unknown')
    })
  })

  describe('checkRoll for an enchantment ended', () => {
    it('lets the player end an enchantment they may, on an item, a spell, a feature or an action', () => {
      expect(end('quarterstaff', 'shillEffect01')).toBeUndefined()
      // On loot, which rolls nothing.
      expect(end('pebble', 'contFlame01')).toBeUndefined()
      const blade = enchantment({ id: 'bladeEffect01', name: 'Pact Weapon' })
      const sheet = enchantingSheet()
      sheet.spells[1].spells[0].enchantments = [blade]
      sheet.features[0].features[0].enchantments = [blade]
      sheet.actions = [
        {
          id: 'action',
          label: 'Actions',
          actions: [
            sheetAction({
              id: 'warhammer',
              name: 'Warhammer',
              enchantments: [blade],
            }),
          ],
        },
      ]
      expect(end('magicweapon', 'bladeEffect01', sheet)).toBeUndefined()
      expect(end('spear', 'bladeEffect01', sheet)).toBeUndefined()
      expect(end('warhammer', 'bladeEffect01', sheet)).toBeUndefined()
    })

    it("lets the player end another's on an item of theirs, as its owner, where the module says they may", () => {
      expect(end('club', 'brynMagicWeap')).toBeUndefined()
    })

    it('refuses one the player may not end, on another item, of an item the sheet has not, or with no sheet', () => {
      expect(end('greataxe', 'weaponPlusOne1')).toBe('enchantment')
      expect(end('longsword', 'shillEffect01')).toBe('enchantment')
      expect(end('quarterstaff', 'missing00000001')).toBe('enchantment')
      expect(end('greataxe', 'shillEffect01')).toBe('enchantment')
      expect(
        checkRoll(
          request({
            kind: 'endEnchantment',
            key: undefined,
            dice: [],
            enchantment: { item: 'quarterstaff', effect: 'shillEffect01' },
          }),
          undefined,
          [],
          'actor-ari',
        ),
      ).toBe('enchantment')
    })

    it('refuses one on the item named that it may not end, though one on another item by the same id it may', () => {
      const sheet = enchantingSheet()
      const [, club, staff] = sheet.inventory.sections[0].items
      club.enchantments = [
        enchantment({
          id: 'sharedEffect01',
          name: 'Weapon, +1',
          endable: false,
        }),
      ]
      staff.enchantments = [
        enchantment({ id: 'sharedEffect01', name: 'Shillelagh (1d10)' }),
      ]
      expect(end('club', 'sharedEffect01', sheet)).toBe('enchantment')
      expect(end('quarterstaff', 'sharedEffect01', sheet)).toBeUndefined()
    })
  })
})

/** A sheet as this app reads and keeps it, from the post it came in. */
const kept = (sheet: unknown) =>
  (
    parseGameEvent('character.updated', {
      character: { id: 'actor-quill', name: 'Quill', sheet },
    })?.data as { character: { sheet: CharacterSheet } }
  ).character.sheet

describe('utils/roll-requests for a sheet sent slim, from module 0.22.0', () => {
  const full = kept(quillSheet())
  const slim = kept(slimQuillSheet())
  const fight = combat({
    combatants: [
      combatant({ id: 'c-goblin', name: 'Goblin' }),
      combatant({ id: 'c-quill', character: 'actor-quill' }),
    ],
  })
  /** The answer to a roll, judged on a sheet as it's kept. */
  const judged = (input: RollRequestInput, sheet: CharacterSheet) =>
    checkRoll(input, sheet, [fight], 'actor-quill')

  it('keeps the sheet the module built', () => {
    expect(slim).toEqual(full)
  })

  it.each([
    [
      'an action’s attack, its row in Inventory',
      attackRequest({ item: 'staff', activity: 'staffAttack' }),
      undefined,
    ],
    [
      'in an attack mode of its weapon',
      attackRequest({
        item: 'staff',
        activity: 'staffAttack',
        attackMode: 'twoHanded',
      }),
      undefined,
    ],
    [
      'in an attack mode its weapon lacks',
      attackRequest({
        item: 'staff',
        activity: 'staffAttack',
        attackMode: 'thrown',
      }),
      'mode',
    ],
    [
      'at a combatant',
      attackRequest({
        item: 'staff',
        activity: 'staffAttack',
        ...targetAt('c-goblin'),
      }),
      undefined,
    ],
    [
      'by another activity of its item',
      attackRequest({ item: 'embers', activity: 'fireBolt' }),
      undefined,
    ],
    [
      'its row in a container in a container',
      attackRequest({ item: 'wand', activity: 'sparks' }),
      undefined,
    ],
    [
      'by an attack it has not',
      attackRequest({ item: 'staff', activity: 'embersAttack' }),
      'unknown',
    ],
    [
      'a split activity’s use, at no one',
      useRequest('embers', 'flameStep', []),
      undefined,
    ],
    [
      'a split activity’s use, at too many',
      useRequest('embers', 'flameStep', ['c-goblin']),
      'target',
    ],
    ['a feature’s use', useRequest('wind', 'windHeal', []), undefined],
    [
      'a spell’s use, at as many as it takes',
      useRequest('missile', 'missileDamage', ['c-goblin']),
      undefined,
    ],
    [
      'the use of a staff’s Cast, its row without it',
      useRequest('frost', 'coneCast', []),
      undefined,
    ],
  ])('judges %s the same as on the full sheet', (_, input, answer) => {
    expect(judged(input, full)).toBe(answer)
    expect(judged(input, slim)).toBe(answer)
  })
})
/** Thorin with a Wild Magic surge whose formula's die explodes. */
const surging = () =>
  fullerSheet({
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          sheetAction({
            id: 'surge',
            name: 'Wild Surge',
            activity: utility('roll'),
            rollFormula: { formula: '1d4x + 2', name: null },
          }),
        ],
      },
    ],
  })

/** The surge's formula rolled with these dice, as checked. */
const surge = (dice: RollRequestInput['dice']) =>
  checkRoll(
    request({
      kind: 'formula',
      key: undefined,
      item: 'surge',
      activity: 'roll',
      dice,
    }),
    surging(),
    [],
    'actor-thorin',
  )

describe('utils/roll-requests for dice Foundry works out once thrown, from module 0.22.0', () => {
  /** How dnd5e makes a critical hit by default, which the sheet says, so damage may be changed. */
  const DEFAULT_CRITICAL: CriticalRule = {
    perDie: 2,
    multiplyNumeric: false,
    powerfulCritical: false,
    altered: false,
    bonusDice: 'rolled',
  }

  describe('checkRoll for a formula', () => {
    it('takes each die’s first throw, Foundry throwing again any it explodes', () => {
      expect(surge([{ faces: 4, results: [4] }])).toBeUndefined()
      expect(surge([{ faces: 4, results: [2] }])).toBeUndefined()
      expect(surge([{ faces: 4, results: [4, 2] }])).toBe('dice')
    })
  })

  describe('checkRoll from a link in a description', () => {
    const TEXT = TEXTS.secondWind
    const links = new Map<number, FoundLink>([
      [
        0,
        {
          link: {
            kind: 'damage',
            n: 0,
            parts: [{ formula: '2d6r<=2 + 1d8 + 7', types: ['slashing'] }],
            healing: false,
          },
          secret: false,
        },
      ],
      [
        1,
        {
          link: {
            kind: 'damage',
            n: 1,
            parts: [{ formula: '1d6x + 2', types: ['thunder'] }],
            healing: false,
          },
          secret: false,
        },
      ],
      [2, { link: { kind: 'roll', n: 2, formula: '4d6kh3' }, secret: false }],
    ])
    const check = (fields: Partial<RollRequestInput>) =>
      checkRoll(
        request({ key: undefined, text: TEXT, ...fields }),
        ruledSo(DEFAULT_CRITICAL),
        [],
        'actor-thorin',
        links,
        ['signedDice'],
      )

    it("takes a description's damage and roll with each die's first throw", () => {
      expect(
        check({
          kind: 'textDamage',
          link: 0,
          dice: [
            { faces: 6, results: [1, 5] },
            { faces: 8, results: [3] },
          ],
        }),
      ).toBeUndefined()
      expect(
        check({
          kind: 'textDamage',
          link: 0,
          dice: [
            { faces: 6, results: [1, 5, 4] },
            { faces: 8, results: [3] },
          ],
        }),
      ).toBe('dice')
      expect(
        check({
          kind: 'textRoll',
          link: 2,
          dice: [{ faces: 6, results: [1, 2, 3, 4] }],
        }),
      ).toBeUndefined()
    })

    it('never takes damage at its highest whose die explodes, but where it’s rerolled below its highest', () => {
      const exploding = {
        kind: 'textDamage' as const,
        link: 1,
        dice: [{ faces: 6, results: [6] }],
      }
      expect(check(exploding)).toBeUndefined()
      expect(check({ ...exploding, modifiers: { maximize: true } })).toBe(
        'dice',
      )
      expect(
        check({
          kind: 'textDamage',
          link: 0,
          dice: [
            { faces: 6, results: [6, 6] },
            { faces: 8, results: [8] },
          ],
          modifiers: { maximize: true },
        }),
      ).toBeUndefined()
    })
  })
})

describe('utils/roll-requests for a use at its user, from module 0.22.0', () => {
  const fight = combat({
    combatants: [
      combatant({ id: 'c-goblin', name: 'Goblin' }),
      combatant({ id: 'c-hob', name: 'Hobgoblin' }),
      combatant({ id: 'c-vex', name: 'Vex', playerOwned: true }),
      combatant({ id: 'c-thorin', character: 'actor-thorin' }),
    ],
  })
  const check = (
    input: RollRequestInput,
    features: readonly string[] = ['selfTargets'],
  ) => checkRoll(input, cleric(), [fight], 'actor-thorin', undefined, features)
  const atSelf = { self: true as const }

  it('lets a use be made at its user, besides those picked, as one of them', () => {
    expect(check(useRequest('cure', 'mend', [], atSelf))).toBeUndefined()
    expect(
      check(useRequest('bless', 'blessing', ['c-vex', 'c-hob'], atSelf)),
    ).toBeUndefined()
    expect(
      check(useRequest('fireball', 'blast', ['c-goblin'], atSelf)),
    ).toBeUndefined()
  })

  it('refuses an enchant activity at its user, which is used at no one', () => {
    expect(
      checkRoll(
        request({
          kind: 'use',
          key: undefined,
          item: 'shillelagh',
          activity: 'shill-cast',
          targets: [],
          self: true,
          enchant: { profile: 'Oy8fP2N3q4R5s6T7' },
          dice: [],
        }),
        enchantingSheet(),
        [],
        'actor-ari',
        undefined,
        ['selfTargets'],
      ),
    ).toBe('target')
  })

  it.each([
    [
      'from a game that makes no use at its user, as before module 0.22.0',
      useRequest('cure', 'mend', [], atSelf),
      [],
    ],
    [
      'of one used on its user alone, which needs no asking',
      useRequest('wind', 'breather', [], atSelf),
      undefined,
    ],
    [
      'whose own combatant is among those picked too',
      useRequest('bless', 'blessing', ['c-thorin'], atSelf),
      undefined,
    ],
    [
      'with more targets than it takes, its user one of them',
      useRequest('cure', 'mend', ['c-vex'], atSelf),
      undefined,
    ],
    [
      'with as many targets as it takes besides',
      useRequest('bless', 'blessing', ['c-goblin', 'c-hob', 'c-vex'], atSelf),
      undefined,
    ],
  ])('refuses a use at its user %s', (_name, input, features) => {
    expect(check(input, features)).toBe('target')
  })
})

/** What a request of the kinds from module 0.29.0 throws: nothing. */
const plain = { mode: 0, explicit: false, extras: [], dice: [] } as const

/** Whether Ember may have this done, as her sheet stands; or with no sheet, for null. */
const charge = (
  fields: Partial<RollRequestInput>,
  sheet: CharacterSheet | null = chargingSheet(),
) =>
  checkRoll(
    { kind: 'spend', ...plain, ...fields } as RollRequestInput,
    sheet ?? undefined,
    [],
    'actor-ember',
  )

/** Spending this many of a counter, as Ember's sheet stands. */
const spend = (
  counter: RollRequestInput['counter'],
  count: number,
  sheet?: CharacterSheet,
) => charge({ kind: 'spend', counter, count }, sheet)

/** Ending one of Ember's concentrations, as her sheet stands. */
const endOf = (effect: string, sheet?: CharacterSheet) =>
  charge({ kind: 'endConcentration', concentration: { effect } }, sheet)

/** Using or gaining Heroic Inspiration, inspired or not; with no sheet, unsaid. */
const inspire = (inspiration: 'use' | 'gain', inspired?: boolean) =>
  charge(
    { kind: 'inspiration', inspiration },
    inspired === undefined ? null : chargingSheet({ inspiration: inspired }),
  )

describe('utils/roll-requests for concentration, charges and Heroic Inspiration, from module 0.29.0', () => {
  describe('checkRoll for a concentration ended', () => {
    it('lets the player end one the sheet says the character keeps', () => {
      expect(endOf('concBless0001')).toBeUndefined()
    })

    it("refuses one the sheet doesn't list, or with none, or no sheet, as already ended", () => {
      expect(endOf('concHex000001')).toBe('concentration')
      expect(
        endOf(
          'concBless0001',
          chargingSheet({ concentration: { effects: [] } }),
        ),
      ).toBe('concentration')
      // As from a module before 0.29.0, which says nothing of them.
      expect(
        endOf('concBless0001', chargingSheet({ concentration: undefined })),
      ).toBe('concentration')
      expect(
        charge(
          {
            kind: 'endConcentration',
            concentration: { effect: 'concBless0001' },
          },
          null,
        ),
      ).toBe('concentration')
    })
  })

  describe('checkRoll for charges spent', () => {
    it.each([
      ["a feature's", { item: 'sorcery' }, 8],
      ["an item's", { item: 'wand' }, 2],
      ["a resource's, among the favorites", { resource: 'primary' }, 3],
    ] as const)(
      'lets the player spend %s, up to as many as are left',
      (_name, counter, left) => {
        expect(spend(counter, 1)).toBeUndefined()
        expect(spend(counter, left)).toBeUndefined()
        expect(spend(counter, left + 1)).toBe('short')
      },
    )

    it("lets the player spend an activity's own, as the action's activities, or a favorite activity, list them", () => {
      const own = counted(2, 2, { item: 'staff', activity: 'staffWisp001' })
      const wisp = {
        id: 'staffWisp001',
        name: 'Starry Wisp',
        type: 'utility',
        activation: 'Action',
        range: null,
        target: null,
        toHit: null,
        save: null,
        damage: [],
        uses: own,
      }
      const listed = chargingSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [
              sheetAction({
                id: 'staff',
                name: 'Staff of Stars',
                activities: [{ ...wisp, id: 'staffFirst01', uses: null }, wisp],
              }),
            ],
          },
        ],
      })
      const favorite = chargingSheet({
        favorites: [
          {
            ...wisp,
            type: 'activity',
            itemId: 'staff',
            itemType: 'equipment',
            itemName: 'Staff of Stars',
            img: null,
          },
        ],
      })
      const counter = { item: 'staff', activity: 'staffWisp001' }
      expect(spend(counter, 2, listed)).toBeUndefined()
      expect(spend(counter, 3, listed)).toBe('short')
      expect(spend(counter, 2, favorite)).toBeUndefined()
      // The item's own uses aren't the activity's.
      expect(spend({ item: 'staff' }, 1, listed)).toBe('uses')
    })

    it("refuses a counter the sheet doesn't say may be spent so, or doesn't show, or with no sheet", () => {
      // The potion's, which only using it spends.
      expect(spend({ item: 'potion' }, 1)).toBe('uses')
      expect(spend({ item: 'nowhere' }, 1)).toBe('uses')
      expect(spend({ resource: 'secondary' }, 1)).toBe('uses')
      // The feature's, as an activity of it.
      expect(spend({ item: 'sorcery', activity: 'spUtility' }, 1)).toBe('uses')
      expect(charge({ counter: { item: 'sorcery' }, count: 1 }, null)).toBe(
        'uses',
      )
      // As from a module before 0.29.0, which names no counter.
      const before = chargingSheet()
      before.features[0].features[0].uses = {
        value: 8,
        max: 20,
        recovery: null,
      }
      before.actions = []
      expect(spend({ item: 'sorcery' }, 1, before)).toBe('uses')
    })

    it('refuses more than are left of one used up', () => {
      expect(spend({ item: 'lucky' }, 1)).toBe('short')
    })
  })

  describe('checkRoll for Heroic Inspiration', () => {
    it('lets the player use it while inspired, and gain it while not', () => {
      expect(inspire('use', true)).toBeUndefined()
      expect(inspire('gain', false)).toBeUndefined()
    })

    it('refuses using it without it, and gaining it with it', () => {
      expect(inspire('use', false)).toBe('not-inspired')
      expect(inspire('gain', true)).toBe('inspired')
      expect(inspire('use')).toBe('not-inspired')
    })
  })
})

/** Thorin's sheet, with his rapier, which dnd5e gives Elven Accuracy, and his greataxe. */
const elven = (rapier = rapierAction()) =>
  characterSheet({
    actions: [
      {
        id: 'action',
        label: 'Action',
        actions: [rapier, greataxeAction()],
      },
    ],
  })

/** An attack with advantage, its d20s these. */
const withAdvantage = (item: string, activity: string, d20s: number[]) =>
  request({
    kind: 'attack',
    key: undefined,
    item,
    activity,
    target: null,
    mode: 1,
    explicit: true,
    dice: [{ faces: 20, results: d20s }],
  })

describe('utils/roll-requests, an attack with Elven Accuracy, from module 0.32.0', () => {
  it('takes three d20s only for an attack whose action dnd5e gives Elven Accuracy', () => {
    expect(
      checkSheet(
        withAdvantage('rapierThorin', 'rapierAttack', [3, 18, 7]),
        elven(),
      ),
    ).toBeUndefined()
    expect(
      checkSheet(
        withAdvantage('greataxeThor', 'greataxeAttack', [3, 18, 7]),
        elven(),
      ),
    ).toBe('dice')
    expect(
      checkSheet(
        withAdvantage('rapierThorin', 'rapierAttack', [3, 18, 7]),
        elven(rapierAction({ elvenAccuracy: undefined })),
      ),
    ).toBe('dice')
  })

  it('still takes two d20s with advantage, Elven Accuracy or not', () => {
    expect(
      checkSheet(
        withAdvantage('rapierThorin', 'rapierAttack', [3, 18]),
        elven(),
      ),
    ).toBeUndefined()
    expect(
      checkSheet(
        withAdvantage('greataxeThor', 'greataxeAttack', [3, 18]),
        elven(),
      ),
    ).toBeUndefined()
  })
})

const alone = (fields: Partial<RollRequestInput> = {}) =>
  request({
    kind: 'itemDamage',
    key: undefined,
    item: 'wolfBite',
    activity: 'biteAttack',
    dice: [{ faces: 8, results: [5] }],
    ...fields,
  })

const recharge = (fields: Partial<RollRequestInput> = {}) =>
  request({
    kind: 'recharge',
    key: undefined,
    item: 'frostBreath',
    dice: [{ faces: 6, results: [5] }],
    ...fields,
  })

const breathing = (uses: object) =>
  mockCompanionSheet({
    actions: [
      {
        id: 'action',
        label: 'Actions',
        actions: [
          frostBreathAction({
            uses: {
              value: 0,
              max: 1,
              recovery: 'Recharge [5+]',
              recharge: 5,
              counter: { item: 'frostBreath' },
              ...uses,
            },
          }),
        ],
      },
    ],
  })

const check = (
  sheet: CharacterSheet | undefined,
  fields: Partial<RollRequestInput> = {},
) => checkRoll(recharge(fields), sheet, [], 'wolfBrakka')

describe('utils/roll-requests for companions, from module 0.36.0', () => {
  /** A fight with Thorin, his wolf and a goblin, the wolf yet to roll. */
  const fight = combat({
    combatants: [
      combatant({ id: 'c-thorin', character: 'actor-thorin', initiative: 18 }),
      combatant({ id: 'c-wolf', companion: 'wolfBrakka', initiative: null }),
      combatant({ id: 'c-goblin', name: 'Goblin' }),
    ],
  })

  it('takes the seat’s own combatant as its character’s, or the companion’s by its key', () => {
    const [thorin, wolf, goblin] = fight.combatants
    expect(isSeatCombatant(thorin, 'actor-thorin')).toBe(true)
    expect(isSeatCombatant(wolf, 'wolfBrakka')).toBe(true)
    expect(isSeatCombatant(wolf, 'actor-thorin')).toBe(false)
    expect(isSeatCombatant(goblin, 'wolfBrakka')).toBe(false)
    expect(isSeatCombatant(thorin, 'wolfBrakka')).toBe(false)
  })

  it("rolls a companion's initiative as its own combatant's, by its key", () => {
    const initiative = request({
      kind: 'initiative',
      key: undefined,
      combatId: 'cmbt1',
    })
    expect(
      checkRoll(initiative, mockCompanionSheet(), [fight], 'wolfBrakka'),
    ).toBeUndefined()
    // Thorin rolled his already.
    expect(checkRoll(initiative, fullerSheet(), [fight], 'actor-thorin')).toBe(
      'already-rolled',
    )
    // One not in the fight rolls none.
    expect(
      checkRoll(
        initiative,
        mockCompanionSheet(),
        [fight],
        'sceneFrost-tokenImp',
      ),
    ).toBe('not-in-combat')
  })

  it("takes a companion's use at itself, by its own combatant, as one of those picked", () => {
    const atSelf = { self: true as const }
    const check = (at: string[], actorId: string) =>
      checkRoll(
        useRequest('bless', 'blessing', at, atSelf),
        cleric(),
        [fight],
        actorId,
        undefined,
        ['selfTargets'],
      )
    // Its own combatant picked too, by its key, is its user twice.
    expect(check(['c-wolf'], 'wolfBrakka')).toBe('target')
    expect(check(['c-thorin'], 'wolfBrakka')).toBeUndefined()
    expect(check(['c-wolf'], 'actor-thorin')).toBeUndefined()
  })

  describe('damage on its own', () => {
    const check = (
      fields: Partial<RollRequestInput> = {},
      sheet: CharacterSheet | null = mockCompanionSheet(),
    ) => checkRoll(alone(fields), sheet ?? undefined, [], 'wolfBrakka')

    it('takes an attack’s, as the game plans it, and its critical hit’s', () => {
      expect(check(undefined)).toBeUndefined()
      expect(
        check({ critical: true, dice: [{ faces: 8, results: [5, 2] }] }),
      ).toBeUndefined()
      // A save's, by its use's activity.
      expect(
        check({
          item: 'frostBreath',
          activity: 'frostSave',
          dice: [{ faces: 6, results: [3, 4] }],
        }),
      ).toBeUndefined()
    })

    it.each([
      ['no sheet', {}, 'gone', null],
      ['an item it hasn’t', { item: 'claw' }, 'gone', mockCompanionSheet()],
      [
        'an activity its row isn’t',
        { activity: 'frostSave' },
        'gone',
        mockCompanionSheet(),
      ],
      [
        'a critical hit of a save’s',
        {
          item: 'frostBreath',
          activity: 'frostSave',
          critical: true,
          dice: [{ faces: 6, results: [3, 4, 5, 6] }],
        },
        'critical',
        mockCompanionSheet(),
      ],
      [
        'the wrong dice',
        { dice: [{ faces: 8, results: [5, 2] }] },
        'dice',
        mockCompanionSheet(),
      ],
      [
        'a kind it doesn’t offer',
        { types: ['fire'] },
        'type',
        mockCompanionSheet(),
      ],
    ])('refuses one with %s', (_, fields, reason, sheet) => {
      expect(check(fields as Partial<RollRequestInput>, sheet)).toBe(reason)
    })

    it('refuses one whose damage can’t go alone', () => {
      const plain = mockCompanionSheet({
        actions: [
          {
            id: 'action',
            label: 'Actions',
            actions: [frostBreathAction({ tableDamage: null })],
          },
        ],
      })
      expect(
        check(
          {
            item: 'frostBreath',
            activity: 'frostSave',
            dice: [{ faces: 6, results: [3, 4] }],
          },
          plain,
        ),
      ).toBe('no-damage')
    })
  })

  describe('recharges', () => {
    it('takes one of uses that recharge with some spent, an item’s or an activity’s own', () => {
      expect(check(breathing({}))).toBeUndefined()
      expect(check(breathing({ value: 1, max: 2 }))).toBeUndefined()
      expect(
        check(
          breathing({
            counter: { item: 'frostBreath', activity: 'frostSave' },
          }),
          { activity: 'frostSave' },
        ),
      ).toBeUndefined()
    })

    it('refuses one of uses not spent', () => {
      expect(check(breathing({ value: 1, max: 1 }))).toBe('charged')
      expect(check(breathing({ value: 3, max: 2 }))).toBe('charged')
    })

    it('refuses one of uses that don’t recharge, or aren’t its', () => {
      expect(check(undefined)).toBe('gone')
      expect(check(breathing({ recharge: undefined }))).toBe('gone')
      expect(check(breathing({}), { item: 'wolfBite' })).toBe('gone')
      // The item's own, not one of its activities'.
      expect(check(breathing({}), { activity: 'frostSave' })).toBe('gone')
    })
  })
})

/** Damage on its own of one of Thorin's rows, with these dice and fields. */
const choosing = (
  item: string,
  activity: string,
  dice: { faces: number; results: number[] }[],
  fields: Partial<RollRequestInput> = {},
) =>
  request({
    kind: 'itemDamage',
    key: undefined,
    item,
    activity,
    dice,
    ...fields,
  })
/** Burning Hands' fire: so many d6s. */
const handsAlone = (count: number, fields: Partial<RollRequestInput> = {}) =>
  choosing(
    'hands',
    'handsSave',
    [{ faces: 6, results: Array.from({ length: count }, () => 3) }],
    fields,
  )
/** The Battleaxe's slashing: one die of these faces, two for a critical hit's. */
const axeAlone = (faces: number, fields: Partial<RollRequestInput> = {}) =>
  choosing(
    'battleaxe',
    'axeAttack',
    [{ faces, results: fields.critical ? [5, 2] : [5] }],
    fields,
  )
/** The Longbow's piercing, and an Arrow of Fire's d4 where said. */
const bowAlone = (fire: boolean, fields: Partial<RollRequestInput> = {}) =>
  choosing(
    'longbow',
    'bowAttack',
    [{ faces: 8, results: [6] }, ...(fire ? [{ faces: 4, results: [3] }] : [])],
    fields,
  )
/**
 * Is Thorin's damage on its own taken, as his sheet of choices has it, or this one, by a game that
 * takes its choices, or does what else is given?
 */
const checkAlone = (
  input: RollRequestInput,
  sheet = aloneSheet(),
  features: readonly string[] = ['aloneChoices'],
) => checkRoll(input, sheet, [], 'actor-thorin', undefined, features)
/** Burning Hands' plans, as module 0.41.0 sends them: 3d6, 4d6 at 2nd level, spending a slot. */
const handsPlan = () => burningHandsAction().tableDamage!
/** Thorin with this Burning Hands alone among his actions, and his slots as given. */
const handsSheet = (
  hands: SheetAction,
  spells: CharacterSheet['spells'] = aloneSpells(),
) =>
  aloneSheet({
    actions: [{ id: 'action', label: 'Actions', actions: [hands] }],
    spells,
  })
/**
 * A Fighter's Burning Hands from a 2024 origin feat, Magic Initiate, as module 0.41.0 sends it: the
 * character has no spell slots, so its own level's section holds none of none, no pool to cast it
 * with, and the row offers no level, though the spell spends a slot.
 */
const slotlessSheet = () =>
  handsSheet(
    burningHandsAction({ tableDamage: { ...handsPlan(), choices: [] } }),
    [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 0, max: 0, level: 1 },
        spells: [sheetSpell({ id: 'hands', name: 'Burning Hands' })],
      },
    ],
  )
/**
 * A 1st-level wizard's Shatter, a 2nd-level spell copied into the spellbook: its section holds none
 * of none, and the wizard's 1st-level slots are below it, so no pool casts it. 3d8 thunder.
 */
const shatterSheet = () =>
  handsSheet(
    burningHandsAction({
      id: 'shatter',
      name: 'Shatter',
      level: 2,
      activity: { ...burningHandsAction().activity!, id: 'shatterSave' },
      save: { ability: 'CON', dc: 13 },
      damage: [{ formula: '3d8', type: 'Thunder', healing: false }],
      tableDamage: {
        normal: {
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '3d8',
              type: 'Thunder',
              dice: [{ faces: 8, number: 3 }],
              perDie: 1,
            },
          ],
        },
        critical: null,
        choices: [],
        spends: ['slot'],
      },
    }),
    [
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 2, max: 2, level: 1 },
        spells: [],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 0, max: 0, level: 2 },
        spells: [sheetSpell({ id: 'shatter', name: 'Shatter', level: 2 })],
      },
    ],
  )
/** Shatter's thunder: 3d8. */
const shatterAlone = (fields: Partial<RollRequestInput> = {}) =>
  choosing('shatter', 'shatterSave', [{ faces: 8, results: [4, 4, 4] }], fields)
/** Hellish Rebuke's fire: so many d10s. */
const rebukeAlone = (count: number, fields: Partial<RollRequestInput> = {}) =>
  choosing(
    'rebuke',
    'rebukeSave',
    [{ faces: 10, results: Array.from({ length: count }, () => 4) }],
    fields,
  )

describe("utils/roll-requests, damage on its own's choices, from module 0.41.0", () => {
  it('takes a level’s dice at its slot, and the spell’s own at its own', () => {
    expect(checkAlone(handsAlone(4, { slot: 'spell2' }))).toBeUndefined()
    expect(checkAlone(handsAlone(3, { slot: 'spell1' }))).toBeUndefined()
    // With one spent: 2nd level's slot is spent, its own level's isn't.
    expect(
      checkAlone(handsAlone(4, { slot: 'spell2', consume: true })),
    ).toBeUndefined()
  })

  it("refuses the row's own dice at a level whose dice differ, and a level's at its own", () => {
    expect(checkAlone(handsAlone(3, { slot: 'spell2' }))).toBe('dice')
    expect(checkAlone(handsAlone(4, { slot: 'spell1' }))).toBe('dice')
  })

  it('refuses a slot that isn’t one of its pools, and none named where it’s cast with one', () => {
    expect(checkAlone(handsAlone(4, { slot: 'spell3' }))).toBe('slot')
    expect(checkAlone(handsAlone(4, { slot: 'pact' }))).toBe('slot')
    expect(checkAlone(handsAlone(3))).toBe('slot')
    expect(checkAlone(handsAlone(3, { consume: true }))).toBe('slot')
  })

  it('refuses a spend with none left of the slot, and takes it with the switch off', () => {
    const spent = aloneSheet({ spells: aloneSpells(2, 0) })
    expect(
      checkAlone(handsAlone(4, { slot: 'spell2', consume: true }), spent),
    ).toBe('slots')
    expect(checkAlone(handsAlone(4, { slot: 'spell2' }), spent)).toBeUndefined()
  })

  it('refuses a spend with none left of the slot only where the use spends a slot', () => {
    // Its own uses spent and never a slot: the slot names its level alone, none left or some.
    const unslotted = handsSheet(
      burningHandsAction({
        consumesSlot: false,
        tableDamage: { ...handsPlan(), spends: ['uses'] },
      }),
      aloneSpells(0, 0),
    )
    expect(
      checkAlone(handsAlone(3, { slot: 'spell1', consume: true }), unslotted),
    ).toBeUndefined()
    // Spending nothing, as Hex's Bonus Hex Damage: refused as that, not for the slot.
    const free = handsSheet(
      burningHandsAction({
        consumesSlot: false,
        tableDamage: { ...handsPlan(), spends: [] },
      }),
      aloneSpells(0, 0),
    )
    expect(
      checkAlone(handsAlone(3, { slot: 'spell1', consume: true }), free),
    ).toBe('consume')
  })

  it('rolls a spell with no pool to cast it with at its own level, naming no slot', () => {
    // A Fighter's Magic Initiate spell: no slot at all.
    const fighter = slotlessSheet()
    expect(checkAlone(handsAlone(3), fighter)).toBeUndefined()
    expect(checkAlone(handsAlone(4), fighter)).toBe('dice')
    // No pool to name, so none named is one.
    expect(checkAlone(handsAlone(3, { slot: 'spell1' }), fighter)).toBe('slot')
    // Spending it goes to the game, which finds no slot left and says so.
    expect(
      checkAlone(handsAlone(3, { consume: true }), fighter),
    ).toBeUndefined()
    // A wizard's spell above the highest slot they have.
    const wizard = shatterSheet()
    expect(checkAlone(shatterAlone(), wizard)).toBeUndefined()
    expect(checkAlone(shatterAlone({ consume: true }), wizard)).toBeUndefined()
    expect(checkAlone(shatterAlone({ slot: 'spell1' }), wizard)).toBe('slot')
    expect(checkAlone(shatterAlone({ slot: 'spell2' }), wizard)).toBe('slot')
  })

  it("rolls a pact slot's level, the spell's own refused", () => {
    const warlock = aloneSheet({
      actions: [
        {
          id: 'reaction',
          label: 'Reactions',
          actions: [hellishRebukeAction()],
        },
      ],
      spells: pactSpells(),
    })
    expect(
      checkAlone(rebukeAlone(4, { slot: 'pact', consume: true }), warlock),
    ).toBeUndefined()
    expect(checkAlone(rebukeAlone(2, { slot: 'pact' }), warlock)).toBe('dice')
    expect(checkAlone(rebukeAlone(4), warlock)).toBe('slot')
    const spent = { ...warlock, spells: pactSpells(0) }
    expect(
      checkAlone(rebukeAlone(4, { slot: 'pact', consume: true }), spent),
    ).toBe('slots')
  })

  it("takes an attack mode's dice and its critical hit's, refusing a mode the weapon hasn't", () => {
    expect(
      checkAlone(axeAlone(10, { attackMode: 'twoHanded' })),
    ).toBeUndefined()
    expect(
      checkAlone(axeAlone(10, { attackMode: 'twoHanded', critical: true })),
    ).toBeUndefined()
    expect(checkAlone(axeAlone(8, { attackMode: 'oneHanded' }))).toBeUndefined()
    expect(checkAlone(axeAlone(8))).toBeUndefined()
    expect(checkAlone(axeAlone(8, { attackMode: 'twoHanded' }))).toBe('dice')
    expect(checkAlone(axeAlone(10, { attackMode: 'thrown' }))).toBe('mode')
    // A slot for a weapon, which casts nothing.
    expect(checkAlone(axeAlone(8, { slot: 'spell1' }))).toBe('slot')
  })

  it("takes an ammunition's dice of a single-mode bow, refusing one it hasn't, or none left of it spent", () => {
    expect(
      checkAlone(bowAlone(true, { ammunition: 'arrowsFire', consume: true })),
    ).toBeUndefined()
    expect(
      checkAlone(bowAlone(false, { ammunition: 'arrows' })),
    ).toBeUndefined()
    expect(checkAlone(bowAlone(false, { ammunition: 'arrowsFire' }))).toBe(
      'dice',
    )
    expect(checkAlone(bowAlone(true, { ammunition: 'arrows' }))).toBe('dice')
    expect(checkAlone(bowAlone(false, { ammunition: 'bolts' }))).toBe('ammo')
    // Plain arrows, none left: refused only where they're spent.
    expect(
      checkAlone(bowAlone(false, { ammunition: 'arrows', consume: true })),
    ).toBe('ammo')
    // A mode the bow, of one, doesn't list.
    expect(checkAlone(bowAlone(false, { attackMode: 'twoHanded' }))).toBe(
      'mode',
    )
  })

  it('refuses a spend where using it spends nothing, and takes one where it spends uses', () => {
    expect(
      checkAlone(axeAlone(10, { attackMode: 'twoHanded', consume: true })),
    ).toBe('consume')
    const potion = choosing('potion', 'potionHeal', [
      { faces: 4, results: [2, 3] },
    ])
    expect(checkAlone({ ...potion, consume: true })).toBeUndefined()
    expect(checkAlone(potion)).toBeUndefined()
  })

  it('refuses any choice on a row the game sends no choices for, rolling it as before', () => {
    const old = aloneSheet({
      actions: [
        {
          id: 'action',
          label: 'Actions',
          actions: aloneSheet().actions[0].actions.map(action => ({
            ...action,
            tableDamage: action.tableDamage && {
              normal: action.tableDamage.normal,
              critical: action.tableDamage.critical,
            },
          })),
        },
      ],
    })
    expect(checkAlone(handsAlone(3), old)).toBeUndefined()
    expect(checkAlone(handsAlone(4, { slot: 'spell2' }), old)).toBe('slot')
    expect(checkAlone(handsAlone(3, { consume: true }), old)).toBe('consume')
    expect(checkAlone(axeAlone(8, { attackMode: 'twoHanded' }), old)).toBe(
      'mode',
    )
    expect(checkAlone(bowAlone(false, { ammunition: 'arrows' }), old)).toBe(
      'ammo',
    )
    expect(checkAlone(bowAlone(false), old)).toBeUndefined()
  })

  it('rolls the row’s own plan, naming no choice, where the game takes none, though its sheet has them', () => {
    // A sheet kept from module 0.41.0 rolled back to an earlier one, until that one sends it again.
    for (const features of [[], ['modifiers', 'manualDice']]) {
      expect(checkAlone(handsAlone(3), aloneSheet(), features)).toBeUndefined()
      expect(checkAlone(handsAlone(4), aloneSheet(), features)).toBe('dice')
      expect(
        checkAlone(handsAlone(4, { slot: 'spell2' }), aloneSheet(), features),
      ).toBe('slot')
      expect(
        checkAlone(handsAlone(3, { consume: true }), aloneSheet(), features),
      ).toBe('consume')
      expect(
        checkAlone(
          axeAlone(10, { attackMode: 'twoHanded' }),
          aloneSheet(),
          features,
        ),
      ).toBe('mode')
    }
  })
})

/** Thorin's spellbook: 1st-level slots `first` of 4, and Pact Magic's at 3rd level, `pact` of 2. */
const slotted = (first = 3, pact = 1, fields: Partial<CharacterSheet> = {}) =>
  characterSheet({
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [sheetSpell({ id: 'light', name: 'Light', level: 0 })],
      },
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: first, max: 4, level: 1 },
        spells: [sheetSpell({ id: 'shield', name: 'Shield' })],
      },
      {
        id: 'spell2',
        label: '2nd Level',
        slots: { value: 0, max: 0, level: 2 },
        spells: [],
      },
      {
        id: 'pact',
        label: 'Pact Magic',
        slots: { value: pact, max: 2, level: 3 },
        spells: [],
      },
    ],
    ...fields,
  })

/**
 * A spell slot of this pool spent or restored, from the count shown, as the sheet stands; with no
 * sheet, for null.
 */
const slotCheck = (
  op: 'spend' | 'restore',
  id: string,
  from: number,
  sheet: CharacterSheet | null = slotted(),
) =>
  checkRoll(
    {
      kind: 'spellSlot',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      spellSlot: { op, id, from },
    },
    sheet ?? undefined,
    [],
    'actor-thorin',
  )

describe('utils/roll-requests, a spell slot spent or restored, from module 0.42.1', () => {
  describe('checkRoll', () => {
    it('lets the player spend one of the slots left, from the count the page showed', () => {
      expect(slotCheck('spend', 'spell1', 3)).toBeUndefined()
      expect(slotCheck('spend', 'spell1', 1, slotted(1))).toBeUndefined()
    })

    it('lets the player restore one that’s used, from the count the page showed', () => {
      expect(slotCheck('restore', 'spell1', 3)).toBeUndefined()
      expect(slotCheck('restore', 'spell1', 0, slotted(0))).toBeUndefined()
    })

    it('spends and restores Pact Magic’s alike', () => {
      expect(slotCheck('spend', 'pact', 1)).toBeUndefined()
      expect(slotCheck('restore', 'pact', 1)).toBeUndefined()
      expect(slotCheck('spend', 'pact', 0, slotted(3, 0))).toBe('slots')
      expect(slotCheck('restore', 'pact', 2, slotted(3, 2))).toBe('full')
    })

    it('refuses one from a count that isn’t the sheet’s any more, either way', () => {
      expect(slotCheck('spend', 'spell1', 4)).toBe('changed')
      expect(slotCheck('spend', 'spell1', 2)).toBe('changed')
      expect(slotCheck('restore', 'spell1', 2)).toBe('changed')
      expect(slotCheck('restore', 'pact', 0)).toBe('changed')
    })

    it('refuses spending with none left, and restoring with none used', () => {
      expect(slotCheck('spend', 'spell1', 0, slotted(0))).toBe('slots')
      expect(slotCheck('restore', 'spell1', 4, slotted(4))).toBe('full')
    })

    it('spends a pool above its maximum, as dnd5e’s temporary slots leave it, but never restores one', () => {
      expect(slotCheck('spend', 'spell1', 5, slotted(5))).toBeUndefined()
      expect(slotCheck('restore', 'spell1', 5, slotted(5))).toBe('full')
    })

    it.each([
      ['a pool the spellbook doesn’t have', 'spell9'],
      ['cantrips, which have no slots', 'spell0'],
      ['a pool with a maximum of 0', 'spell2'],
    ])('refuses %s as no such spell slots', (_name, id) => {
      expect(slotCheck('spend', id, 0)).toBe('slot')
      expect(slotCheck('restore', id, 0)).toBe('slot')
    })

    it('refuses any with no sheet, or one naming no slot', () => {
      expect(slotCheck('spend', 'spell1', 3, null)).toBe('slot')
      expect(
        checkRoll(
          { kind: 'spellSlot', mode: 0, explicit: false, extras: [], dice: [] },
          slotted(),
          [],
          'actor-thorin',
        ),
      ).toBe('slot')
    })

    it('says no such pool before a count that changed, and a changed count before none left', () => {
      expect(slotCheck('spend', 'spell9', 3)).toBe('slot')
      expect(slotCheck('spend', 'spell1', 1, slotted(0))).toBe('changed')
      expect(slotCheck('restore', 'spell1', 3, slotted(4))).toBe('changed')
    })

    it('refuses any while the character is transformed, whose slots wait, before anything else', () => {
      const shaped = shapedSheet()
      expect(shaped.spells.find(({ id }) => id === 'spell1')?.slots).toEqual({
        value: 4,
        max: 4,
        level: 1,
      })
      expect(slotCheck('spend', 'spell1', 4, shaped)).toBe('shaped')
      expect(slotCheck('spend', 'spell9', 0, shaped)).toBe('shaped')
      // Back in her own form, hers again.
      expect(slotCheck('spend', 'spell1', 4, druidSheet())).toBeUndefined()
    })
  })
})

/**
 * Thorin's spellbook, as module 0.42.1 sends it: Light, a cantrip; Witch Bolt not prepared, Bless
 * prepared and Sanctuary always prepared; Misty Step cast innately; and a wand's Magic Missile,
 * which an item casts.
 */
const spellbook = (fields: Partial<CharacterSheet> = {}) =>
  characterSheet({
    spells: [
      {
        id: 'spell0',
        label: 'Cantrips',
        slots: null,
        spells: [sheetSpell({ id: 'light', name: 'Light', level: 0 })],
      },
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 3, max: 4, level: 1 },
        spells: [
          sheetSpell({ id: 'witch', name: 'Witch Bolt', prepared: 0 }),
          sheetSpell({ id: 'bless', name: 'Bless', prepared: 1 }),
          sheetSpell({ id: 'sanctuary', name: 'Sanctuary', prepared: 2 }),
        ],
      },
      {
        id: 'innate',
        label: 'Innate',
        slots: null,
        spells: [sheetSpell({ id: 'misty', name: 'Misty Step', level: 2 })],
      },
      {
        id: 'item',
        label: 'Item Spells',
        slots: null,
        spells: [
          sheetSpell({
            id: 'mm',
            name: 'Magic Missile',
            castFrom: { id: 'wand', name: 'Wand of Magic Missiles' },
          }),
        ],
      },
    ],
    ...fields,
  })

/** A preparation, as its row's menu sends it, with these fields. */
const preparing = (
  fields: Partial<RollRequestInput> = {},
): RollRequestInput => ({
  kind: 'prepare',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
  ...fields,
})

/** A spell of this id prepared or unprepared, as the sheet stands; with no sheet, for null. */
const prepareCheck = (
  op: 'prepare' | 'unprepare',
  id: string,
  sheet: CharacterSheet | null = spellbook(),
) =>
  checkRoll(
    preparing({ prepare: { op, id } }),
    sheet ?? undefined,
    [],
    'actor-thorin',
  )

describe('utils/roll-requests, a spell prepared or unprepared, from module 0.42.1', () => {
  describe('checkRoll', () => {
    it('lets the player prepare or unprepare a spell they prepare, either way, already so or not', () => {
      expect(prepareCheck('prepare', 'witch')).toBeUndefined()
      expect(prepareCheck('unprepare', 'bless')).toBeUndefined()
      // Already so: the game says so, and writes nothing.
      expect(prepareCheck('unprepare', 'witch')).toBeUndefined()
      expect(prepareCheck('prepare', 'bless')).toBeUndefined()
    })

    it.each([
      ['one always prepared', 'sanctuary'],
      ['a cantrip', 'light'],
      ['one cast innately', 'misty'],
      ['one an item casts', 'mm'],
    ])('refuses %s, either way, as not one they prepare', (_name, id) => {
      expect(prepareCheck('prepare', id)).toBe('prepare')
      expect(prepareCheck('unprepare', id)).toBe('prepare')
    })

    it('refuses one the sheet doesn’t list, or with no sheet, as gone', () => {
      expect(prepareCheck('prepare', 'nope')).toBe('gone')
      expect(prepareCheck('prepare', 'spell1')).toBe('gone')
      expect(prepareCheck('prepare', 'witch', null)).toBe('gone')
      expect(checkRoll(preparing(), spellbook(), [], 'actor-thorin')).toBe(
        'gone',
      )
    })

    it('finds the spell in any section of the spellbook', () => {
      const pact = spellbook({
        spells: [
          {
            id: 'pact',
            label: 'Pact Magic',
            slots: { value: 1, max: 2, level: 3 },
            spells: [sheetSpell({ id: 'hex', name: 'Hex', prepared: 0 })],
          },
        ],
      })
      expect(prepareCheck('prepare', 'hex', pact)).toBeUndefined()
      expect(prepareCheck('prepare', 'witch', pact)).toBe('gone')
    })

    it('refuses any while the character is transformed, whose spells are then the form’s, before anything else', () => {
      const own = [
        {
          id: 'spell1',
          label: '1st Level',
          slots: { value: 4, max: 4, level: 1 },
          spells: [
            sheetSpell({ id: 'goodberry', name: 'Goodberry', prepared: 0 }),
          ],
        },
      ]
      // Thorin's spellbook in the mocks' Wolf form, not the spell slots' druid sheets, so that
      // these stand with the spell slots taken out.
      const form = wolfForm()
      // The form lists none of hers: shaped, not gone.
      expect(
        prepareCheck('prepare', 'goodberry', spellbook({ form, spells: [] })),
      ).toBe('shaped')
      // Even one its sheet lists as one she prepares.
      expect(
        prepareCheck('prepare', 'goodberry', spellbook({ form, spells: own })),
      ).toBe('shaped')
      // Back in her own form, hers again.
      expect(
        prepareCheck('prepare', 'goodberry', spellbook({ spells: own })),
      ).toBeUndefined()
    })
  })
})
