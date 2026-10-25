/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  availableRollKinds,
  checkDamage,
  checkDamageDice,
  checkEndTurn,
  checkRoll,
  checkUndoTurn,
  GM_UNSENT,
  isDying,
  isSeatCombatant,
  rollStatus,
  sameCounter,
  toCommand,
  toGmRollView,
  toRollRequestView,
  type HeldEndTurn,
  type HeldRollRequest,
} from './roll-requests'
import {
  castingSheet,
  characterSheet,
  chargingSheet,
  counted,
  checkingSheet,
  combat,
  combatant,
  enchantingSheet,
  enchantment,
  enchantUse,
  frostBreathAction,
  fullerSheet,
  greataxeAction,
  mockCompanionEntry,
  mockCompanionSheet,
  mockTableDamage,
  rapierAction,
  sheetAction,
  sheetFavorites,
  sheetItem,
  sheetSpell,
  SLEIGHT_CHECK,
  TEXTS,
  WAND_LEVELS,
} from '@/mocks/sending-stone'
import { quillSheet, slimQuillSheet } from '@/mocks/slim-sheet'
import { parseGameEvent } from '@/schemas/sending-stone'
import type { RollRequestInput } from '@/types/roll'
import type {
  CharacterSheet,
  CommandResult,
  CriticalRule,
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

const held = (fields: Partial<HeldRollRequest> = {}): HeldRollRequest => ({
  id: 'req-1',
  actorId: 'actor-thorin',
  role: 'player',
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

/** Dice of damage that takes a d4 away: so many d4s, then so many of another, d6s unless said. */
const lessD4 = (fours: number, others: number, faces = 6) => [
  { faces: 4, results: Array.from({ length: fours }, () => 2) },
  { faces, results: Array.from({ length: others }, () => 3) },
]

/** The damage of the attack req-1 that takes a d4 away, with so many d4s and d6s, changed so. */
const lessD4Damage = (
  fours: number,
  sixes: number,
  modifiers?: RollRequestInput['modifiers'],
) => ({
  ...damageRequest(lessD4(fours, sixes)),
  ...(modifiers && { modifiers }),
})

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

/** A part of damage the game made, totalling this, or saying no total. */
const damagePart = (total: number | null) => ({
  formula: '1d8 + 4',
  total,
  dice: [{ faces: 8, results: [{ result: 5, active: true }] }],
})

/** A part of damage the game made, totalling this, of this type. */
const typedPart = (total: number, damageType: string) => ({
  ...damagePart(total),
  damageType,
})

/** A part of damage as its player is shown it, of `damagePart`, every key as it always was. */
const shownPart = (total: number, damageType?: string) => ({
  formula: '1d8 + 4',
  total,
  dice: [{ faces: 8, value: 5, active: true }],
  advantage: false,
  disadvantage: false,
  critical: false,
  fumble: false,
  damageType,
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

/** A hit die's roll, as the game made it, giving back this many. */
const hitDieRoll = (total: number) => ({
  formula: '1d10 + 3',
  total,
  dice: [{ faces: 10, results: [{ result: total - 3, active: true }] }],
})

/**
 * Hit dice spent at once, as their player is told of them, from module 0.20.0: of three, as many
 * as the game made, each giving back this many, and why it stopped, if it did.
 */
const spentAtOnce = (
  visible: boolean,
  made: number,
  reason: string | null = null,
) =>
  toRollRequestView(
    held({
      kind: 'hitDice',
      status: made === 3 ? 'done' : 'failed',
      result: {
        id: 'req-1',
        status: made === 3 ? 'done' : 'failed',
        reason,
        error: null,
        messageId: made > 0 ? `msg-${made}` : null,
        visible,
        rolls: visible
          ? [9, 5, 8].slice(0, made).map(total => hitDieRoll(total))
          : [],
        ...(made > 0 && {
          healed: [9, 5, 6].slice(0, made).reduce((a, b) => a + b, 0),
        }),
        spent: { count: 3, made },
      },
    }),
    NOW,
  )

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

const favorited = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
  toRollRequestView(
    held({
      kind: 'favorite',
      status,
      claimedAt: ago(500),
      result: {
        id: 'req-1',
        status,
        reason: null,
        error: null,
        messageId: null,
        visible: true,
        rolls: [],
        ...fields,
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
      ['takes a die away', '1d3 + 3 - 1d4', 'dice'],
      [
        'takes one away as Foundry may wrap a leading die',
        '(1d4 * -1) + 2d6',
        'dice',
      ],
      ['takes a number away', '1d3 - 1', undefined],
    ])(
      'rolls damage the game rolls itself at its highest only where its formula takes no die away: one that %s',
      (_name, formula, refusal) => {
        const unplannable = use({
          result: result({
            critical: false,
            plannable: false,
            rolls: [{ formula, type: 'bludgeoning', dice: [] }],
          }),
        })
        const maximum = {
          ...damageRequest([]),
          modifiers: { maximize: true },
        }
        expect(checkDamage(maximum, unplannable, [], NOW)).toBe(refusal)
        expect(
          checkDamage(damageRequest([]), unplannable, [], NOW),
        ).toBeUndefined()
      },
    )

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

    it("changes only a critical hit's own first die, never its critical damage's", () => {
      // A greataxe's critical hit: 3d12 + 3, and the weapon's 1d6.
      const greataxe = use({
        result: result({
          critical: true,
          plannable: true,
          rolls: [
            {
              formula: '3d12 + 3 + 1d6',
              type: 'slashing',
              dice: [
                { faces: 12, number: 3 },
                { faces: 6, number: 1, added: true },
              ],
              perDie: 2,
            },
          ],
        }),
      })
      const sent = (twelves: number) =>
        damageRequest([
          { faces: 12, results: Array.from({ length: twelves }, () => 7) },
          { faces: 6, results: [4] },
        ])
      expect(checkDamage(sent(3), greataxe, [], NOW)).toBeUndefined()
      expect(
        checkDamage({ ...sent(5), modifiers: { extra: 1 } }, greataxe, [], NOW),
      ).toBeUndefined()
      expect(
        checkDamage({ ...sent(4), modifiers: { extra: 1 } }, greataxe, [], NOW),
      ).toBe('dice')

      // "3 + 1d6": no die of its own to add to.
      const numbers = use({
        result: result({
          critical: true,
          plannable: true,
          rolls: [
            {
              formula: '3 + 1d6',
              type: 'bludgeoning',
              dice: [{ faces: 6, number: 1, added: true }],
              perDie: 2,
            },
          ],
        }),
      })
      const six = damageRequest([{ faces: 6, results: [4] }])
      expect(checkDamage(six, numbers, [], NOW)).toBeUndefined()
      expect(
        checkDamage(
          {
            ...damageRequest([{ faces: 6, results: [4, 2, 1] }]),
            modifiers: { extra: 1 },
          },
          numbers,
          [],
          NOW,
        ),
      ).toBe('dice')
      expect(
        checkDamage({ ...six, modifiers: { extra: 1 } }, numbers, [], NOW),
      ).toBe('dice')
      // At its highest, as it is.
      expect(
        checkDamage(
          { ...six, modifiers: { maximize: true } },
          numbers,
          [],
          NOW,
        ),
      ).toBeUndefined()
    })

    /** "-1d4 + 2d6", its d4 marked taken away, from module 0.21.0, or not, from one before. */
    const withering = (marked: boolean) =>
      use({
        kind: 'use',
        result: result({
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '- 1d4 + 2d6',
              type: 'necrotic',
              dice: [
                { faces: 4, number: 1, ...(marked && { subtracted: true }) },
                { faces: 6, number: 2 },
              ],
            },
          ],
        }),
      })

    describe('that takes dice away', () => {
      it('changes the first die it adds, never one the game marks taken away', () => {
        expect(
          checkDamage(lessD4Damage(1, 2), withering(true), [], NOW),
        ).toBeUndefined()
        expect(
          checkDamage(
            lessD4Damage(1, 3, { extra: 1 }),
            withering(true),
            [],
            NOW,
          ),
        ).toBeUndefined()
        expect(
          checkDamage(
            lessD4Damage(2, 2, { extra: 1 }),
            withering(true),
            [],
            NOW,
          ),
        ).toBe('dice')
      })

      it('changes none where a module before 0.21.0 would change the die it takes away', () => {
        expect(
          checkDamage(lessD4Damage(1, 2), withering(false), [], NOW),
        ).toBeUndefined()
        expect(
          checkDamage(
            lessD4Damage(1, 3, { extra: 1 }),
            withering(false),
            [],
            NOW,
          ),
        ).toBe('dice')
        expect(
          checkDamage(
            lessD4Damage(2, 2, { extra: 1 }),
            withering(false),
            [],
            NOW,
          ),
        ).toBe('dice')
      })

      it('never rolls it at its highest, as the game marks it or its formula has it', () => {
        expect(
          checkDamage(
            lessD4Damage(1, 2, { maximize: true }),
            withering(true),
            [],
            NOW,
          ),
        ).toBe('dice')
        expect(
          checkDamage(
            lessD4Damage(1, 2, { maximize: true }),
            withering(false),
            [],
            NOW,
          ),
        ).toBe('dice')
        // Damage that takes nothing away is, as ever.
        expect(
          checkDamage(
            {
              ...thrown,
              modifiers: { maximize: true },
            },
            use(),
            [],
            NOW,
          ),
        ).toBeUndefined()
      })
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

    it('shows an answer to what Midi-QOL asked that made no card, as its dice are the player’s own (module 0.27.0)', () => {
      const view = toRollRequestView(
        held({
          kind: 'skill',
          status: 'done',
          result: {
            id: 'req-1',
            status: 'done',
            reason: null,
            error: null,
            messageId: null,
            visible: true,
            rolls: [
              {
                formula: '2d20kh + 7',
                total: 24,
                dice: [
                  {
                    faces: 20,
                    results: [
                      { result: 17, active: true },
                      { result: 4, active: false },
                    ],
                  },
                ],
              },
            ],
            outcome: 'success',
          },
        }),
        NOW,
      )
      expect(view).toMatchObject({
        status: 'done',
        visible: true,
        total: 24,
        outcome: 'success',
      })
      expect(view.rolls).toHaveLength(1)
      expect(view).not.toHaveProperty('card')
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

  describe('toRollRequestView for a move of items and coins, from module 0.31.0', () => {
    const transfer = {
      from: 'groupIronCo01',
      to: 'actorThorin1',
      items: [
        {
          id: 'potionHeal01',
          quantity: 2,
          created: null,
          stacked: 'pot0Thorin01',
        },
      ],
      currency: null,
    }
    const moved = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
      toRollRequestView(
        held({
          kind: 'transfer',
          status,
          claimedAt: ago(500),
          result: {
            id: 'req-1',
            status,
            reason: null,
            error: null,
            messageId: 'm-line',
            visible: true,
            rolls: [],
            transfer,
            ...fields,
          },
        }),
        NOW,
      )

    it('passes on what moved, once made, seen or not', () => {
      expect(moved({}, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        transfer,
      })
      expect(moved({ visible: false }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
        transfer,
      })
    })

    it('passes on what moved before it failed, and none where nothing did', () => {
      expect(
        moved({ status: 'failed', reason: 'error', error: 'boom' }, 'failed'),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'error', transfer })
      expect(
        moved(
          { status: 'failed', reason: 'gone', transfer: undefined },
          'failed',
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'gone' })
    })
  })

  describe('toRollRequestView for a favorite added or removed, from module 0.37.0', () => {
    it('passes on whether it is one of the favorites now, as the game says', () => {
      expect(favorited({ favorited: true }, 'done')).toEqual({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: undefined,
        rolls: [],
        favorited: true,
      })
      expect(favorited({ favorited: false }, 'done')).toMatchObject({
        status: 'done',
        favorited: false,
      })
    })

    it('says nothing of it where the game said nothing, as a refusal says nothing', () => {
      expect(favorited({}, 'done')).not.toHaveProperty('favorited')
      expect(favorited({ status: 'failed', reason: 'gone' }, 'failed')).toEqual(
        { id: 'req-1', status: 'failed', reason: 'gone' },
      )
    })
  })

  describe('GM_UNSENT', () => {
    it('holds a favorite, from module 0.37.0, which posts nothing to mark it theirs', () => {
      expect(GM_UNSENT.has('favorite')).toBe(true)
      expect(GM_UNSENT.has('remove')).toBe(false)
    })
  })

  describe('toRollRequestView for hit dice spent at once, from module 0.20.0', () => {
    it('shows what every die the game made came to, added up, and gave back, and how many it made', () => {
      const view = spentAtOnce(true, 3)
      expect(view).toMatchObject({
        id: 'req-1',
        status: 'done',
        visible: true,
        total: 22,
        healed: 20,
        spent: { count: 3, made: 3 },
      })
      expect(view.rolls).toHaveLength(3)
      expect(spentAtOnce(false, 3)).toEqual({
        id: 'req-1',
        status: 'done',
        visible: false,
      })
    })

    it('shows how many the game made before it stopped, what they came to and gave back, and why it stopped', () => {
      const view = spentAtOnce(true, 1, 'full-hp')
      expect(view).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'full-hp',
        visible: true,
        total: 9,
        rolls: [expect.objectContaining({ formula: '1d10 + 3', total: 9 })],
        healed: 9,
        spent: { count: 3, made: 1 },
      })
    })

    it('shows how many the game made blind before it stopped, but not what they came to or gave back', () => {
      expect(spentAtOnce(false, 2, 'timeout')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'timeout',
        visible: false,
        spent: { count: 3, made: 2 },
      })
    })

    it('says only why, where the game made none of them', () => {
      expect(spentAtOnce(true, 0, 'full-hp')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'full-hp',
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

    /** The total of damage the game made of these parts, each a total and a type. */
    const typedTotal = (...parts: [number, string][]) =>
      toRollRequestView(
        madeDamage(parts.map(([total, type]) => typedPart(total, type))),
        NOW,
      ).total

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

    it("totals damage as dnd5e's card does: each kind's parts together, each kind at least 0", () => {
      const part = (total: number, damageType: string) => ({
        ...damagePart(total),
        damageType,
      })
      const totalOf = (rolls: CommandResult['rolls'], kind = 'damage') =>
        toRollRequestView(
          { ...madeDamage(rolls), kind: kind as HeldRollRequest['kind'] },
          NOW,
        ).total
      expect(totalOf([part(-4, 'slashing')])).toBe(0)
      expect(totalOf([part(-4, 'slashing'), part(5, 'fire')])).toBe(5)
      expect(totalOf([part(-4, 'slashing'), part(5, 'slashing')])).toBe(1)
      expect(totalOf([part(-4, 'slashing')], 'textDamage')).toBe(0)
      // Each roll's own total stays the game's.
      expect(
        toRollRequestView(madeDamage([part(-4, 'slashing')]), NOW).rolls?.[0]
          .total,
      ).toBe(-4)
      // Hit dice's totals are added up as they are.
      expect(totalOf([damagePart(-3), damagePart(1)], 'hitDice')).toBe(-2)
    })

    it("shows the game's rolls as before, whatever marks module 0.28.0 adds to them", () => {
      // Every field a roll may carry from module 0.28.0, as a roll request is sent them.
      const marks = {
        class: 'DamageRoll',
        damage: true,
        damageLabel: 'Piercing',
        section: 'damage',
        flavor: 'Sneak Attack',
        attack: true,
      }
      const view = toRollRequestView(
        madeDamage([
          { ...damagePart(9), damageType: 'piercing', ...marks },
          { ...damagePart(-3), damageType: 'piercing', ...marks },
          { ...damagePart(7), ...marks, section: 'bonus' },
        ] as CommandResult['rolls']),
        NOW,
      )

      expect(view.total).toBe(13)
      expect(view.rolls).toStrictEqual([
        shownPart(9, 'piercing'),
        shownPart(-3, 'piercing'),
        shownPart(7),
      ])
      for (const roll of view.rolls ?? []) {
        expect(Object.keys(roll)).toEqual([
          'formula',
          'total',
          'dice',
          'advantage',
          'disadvantage',
          'critical',
          'fumble',
          'damageType',
        ])
      }
    })

    it("counts every kind in the table's total, as it always has: Midi-QOL's none and each pool of healing too", () => {
      expect(typedTotal([5, 'piercing'], [4, 'midi-none'])).toBe(9)
      expect(typedTotal([5, 'piercing'], [4, 'none'])).toBe(9)
      expect(typedTotal([11, 'healing'], [5, 'temphp'])).toBe(16)
      expect(typedTotal([11, 'healing'], [5, 'necrotic'])).toBe(16)
    })

    it("tells the Gamemaster's damage that only raises maximum hit points as healing", () => {
      const maximum = { ...damagePart(6), damageType: 'maximum' }
      const necrotic = { ...damagePart(6), damageType: 'necrotic' }

      expect(
        toGmRollView({ ...madeDamage([maximum]), label: null }, NOW),
      ).toMatchObject({ healing: true, total: 6 })
      expect(
        toGmRollView({ ...madeDamage([maximum, necrotic]), label: null }, NOW),
      ).not.toHaveProperty('healing')
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

    it("says a roll is the Gamemaster's as the character, and a player's as ever, saying nothing of it (#156)", () => {
      expect(toCommand(held({ role: 'gm' }))).toEqual({
        ...request({}),
        id: 'req-1',
        actorId: 'actor-thorin',
        by: 'gm',
      })
      const player = toCommand(held({ role: 'player' }))
      expect(player).toEqual({
        ...request({}),
        id: 'req-1',
        actorId: 'actor-thorin',
      })
      expect(player).not.toHaveProperty('by')
      expect(JSON.stringify(player)).toBe(
        JSON.stringify({
          ...request({}),
          id: 'req-1',
          actorId: 'actor-thorin',
        }),
      )
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

  describe('toRollRequestView', () => {
    const outcome = {
      enchanted: {
        item: 'longsword',
        itemName: 'Longsword',
        effect: 'effect000000002',
        profile: 'SLSudYaACjmmmZsU',
        name: 'Magic Weapon, +1',
      },
      ended: null,
    }
    const done = (visible: boolean): CommandResult => ({
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: visible ? 'card-1' : null,
      visible,
      rolls: [],
      use: { type: 'enchant' },
      damage: null,
      enchantment: outcome,
    })

    it('says what an enchant activity applied and ended, seen or not', () => {
      for (const visible of [true, false]) {
        expect(
          toRollRequestView(
            held({ kind: 'use', status: 'done', result: done(visible) }),
          ),
        ).toEqual(
          expect.objectContaining({
            status: 'done',
            visible,
            use: { type: 'enchant' },
            enchantment: outcome,
          }),
        )
      }
    })

    it('says nothing of it for a use whose result has none, nor why one wasn’t made beyond its reason', () => {
      expect(
        toRollRequestView(
          held({
            kind: 'use',
            status: 'done',
            result: { ...done(true), enchantment: null },
          }),
        ),
      ).not.toHaveProperty('enchantment')
      expect(
        toRollRequestView(
          held({
            kind: 'use',
            status: 'failed',
            result: {
              ...done(true),
              status: 'failed',
              reason: 'enchant',
              enchantment: null,
            },
          }),
        ),
      ).toEqual({ id: 'req-1', status: 'failed', reason: 'enchant' })
    })

    it('says of one used whose card is gone from the game’s chat, or was never posted, that there is none', () => {
      const cases: [Partial<CommandResult>, Record<string, unknown>][] = [
        [{ reason: 'enchant' }, { reason: 'enchant', card: false }],
        [{ reason: 'midi' }, { reason: 'midi', card: false }],
        // Of any other use, nothing.
        [{ reason: 'consume', use: null }, { reason: 'consume' }],
      ]
      for (const [fields, view] of cases) {
        expect(
          toRollRequestView(
            held({
              kind: 'use',
              status: 'failed',
              result: {
                ...done(false),
                status: 'failed',
                enchantment: null,
                ...fields,
              },
            }),
          ),
        ).toEqual({ id: 'req-1', status: 'failed', ...view })
      }
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

/** An attack made lately, whose damage is of one roll of this formula, its dice as said. */
const attackOf = (
  formula: string,
  dice: DamagePreview['rolls'][number]['dice'],
  plannable = true,
) =>
  held({
    kind: 'attack',
    status: 'done',
    createdAt: ago(60_000),
    result: {
      id: 'req-1',
      status: 'done',
      reason: null,
      error: null,
      messageId: 'msg-1',
      visible: true,
      rolls: [],
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: {
        critical: false,
        plannable,
        rolls: [{ formula, type: 'slashing', dice }],
      },
    } satisfies CommandResult,
  })

/** The damage of the attack req-1 at its highest, with these dice. */
const maximum = (dice: RollRequestInput['dice']) => ({
  ...damageRequest(dice),
  modifiers: { maximize: true },
})

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

  describe('checkDamage', () => {
    it('takes the first throw of dice Foundry rerolls, at its highest too', () => {
      const greatsword = attackOf('2d6r<=2 + 7', [{ faces: 6, number: 2 }])
      const first = [{ faces: 6, results: [1, 5] }]
      expect(
        checkDamage(damageRequest(first), greatsword, [], NOW),
      ).toBeUndefined()
      expect(
        checkDamage(
          damageRequest([{ faces: 6, results: [1, 5, 4] }]),
          greatsword,
          [],
          NOW,
        ),
      ).toBe('dice')
      expect(
        checkDamage(
          maximum([{ faces: 6, results: [6, 6] }]),
          greatsword,
          [],
          NOW,
        ),
      ).toBeUndefined()
    })

    it.each([
      ['explodes', '1d6x + 2'],
      ['explodes once', '1d6xo + 2'],
      ['is rerolled on its highest face', '1d6r6 + 2'],
    ])('never takes damage at its highest whose die %s', (_name, formula) => {
      const thrown = [{ faces: 6, results: [6] }]
      const attack = attackOf(formula, [{ faces: 6, number: 1 }])
      expect(
        checkDamage(damageRequest(thrown), attack, [], NOW),
      ).toBeUndefined()
      expect(checkDamage(maximum(thrown), attack, [], NOW)).toBe('dice')
    })

    it('never takes damage the game rolls itself at its highest where its formula seems to explode a die', () => {
      const rolledThere = attackOf('(1d6x) * 2', [], false)
      expect(checkDamage(maximum([]), rolledThere, [], NOW)).toBe('dice')
      expect(
        checkDamage(damageRequest([]), rolledThere, [], NOW),
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

  it.each([
    [{ item: 'a' }, { item: 'a' }, true],
    [{ item: 'a', activity: 'b' }, { item: 'a', activity: 'b' }, true],
    [{ resource: 'primary' }, { resource: 'primary' }, true],
    [{ item: 'a' }, { item: 'b' }, false],
    [{ item: 'a' }, { item: 'a', activity: 'b' }, false],
    [{ item: 'a', activity: 'b' }, { item: 'a', activity: 'c' }, false],
    [{ resource: 'primary' }, { resource: 'secondary' }, false],
    [{ resource: 'primary' }, { item: 'primary' }, false],
    [undefined, undefined, false],
    [{ item: 'a' }, undefined, false],
  ] as const)('takes %j and %j for the same counter: %p', (a, b, same) => {
    expect(sameCounter(a, b)).toBe(same)
    expect(sameCounter(b, a)).toBe(same)
  })

  it.each([
    ['endConcentration', 'Concentration ended'],
    ['spend', 'Charges spent'],
    ['inspiration', 'Heroic Inspiration'],
    // From module 0.31.0.
    ['transfer', 'Items or coins moved'],
    // From module 0.33.0.
    ['remove', 'An item removed'],
    // From module 0.36.0, though the Gamemaster never sends one.
    ['endTurn', 'A turn ended'],
    ['undoEndTurn', 'A turn taken back'],
  ])(
    "calls the Gamemaster's %s from a page that didn't say %p",
    (kind, label) => {
      expect(
        toGmRollView(
          { ...held({ kind, status: 'done', result: null }), label: null },
          NOW,
        ).label,
      ).toBe(label)
    },
  )
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

describe('toRollRequestView for a distribution, from module 0.32.0', () => {
  const transfer = {
    from: 'groupIronCo01',
    to: null,
    items: [],
    currency: { gp: 25 },
    among: ['actorBram001'],
  }
  const shared = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
    toRollRequestView(
      held({
        kind: 'transfer',
        status,
        claimedAt: ago(500),
        result: {
          id: 'req-1',
          status,
          reason: null,
          error: null,
          messageId: 'm-line',
          visible: true,
          rolls: [],
          transfer,
          ...fields,
        },
      }),
      NOW,
    )

  it('passes on who was given their share, made or failed part way', () => {
    expect(shared({}, 'done')).toMatchObject({ status: 'done', transfer })
    expect(
      shared({ status: 'failed', reason: 'error', error: 'refused' }, 'failed'),
    ).toEqual({ id: 'req-1', status: 'failed', reason: 'error', transfer })
  })
})

describe('toRollRequestView for an item removed, from module 0.33.0', () => {
  const removed = { item: 'potionThorin', quantity: 2 }
  const removal = (fields: Partial<CommandResult>, status: 'done' | 'failed') =>
    toRollRequestView(
      held({
        kind: 'remove',
        status,
        claimedAt: ago(500),
        result: {
          id: 'req-1',
          status,
          reason: null,
          error: null,
          messageId: 'm-line',
          visible: true,
          rolls: [],
          removed,
          ...fields,
        },
      }),
      NOW,
    )

  it('passes on what was removed, once made, seen or not', () => {
    expect(removal({}, 'done')).toEqual({
      id: 'req-1',
      status: 'done',
      visible: true,
      total: undefined,
      rolls: [],
      removed,
    })
    expect(removal({ visible: false }, 'done')).toEqual({
      id: 'req-1',
      status: 'done',
      visible: false,
      removed,
    })
  })

  it('passes on what was removed before it failed, and nothing where the item itself was kept', () => {
    expect(
      removal(
        {
          status: 'failed',
          reason: 'error',
          error: 'Not every item was deleted',
        },
        'failed',
      ),
    ).toEqual({ id: 'req-1', status: 'failed', reason: 'error', removed })
    expect(
      removal(
        { status: 'failed', reason: 'changed', removed: undefined },
        'failed',
      ),
    ).toEqual({ id: 'req-1', status: 'failed', reason: 'changed' })
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
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
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

    it('checks its dice as an attack’s due damage is checked', () => {
      const { normal } = mockTableDamage()
      expect(checkDamageDice(alone(), normal)).toBeUndefined()
      expect(
        checkDamageDice(
          alone({
            dice: [{ faces: 8, results: [5, 6] }],
            modifiers: { extra: 1 },
          }),
          normal,
        ),
      ).toBeUndefined()
      expect(checkDamageDice(alone({ modifiers: { extra: 1 } }), normal)).toBe(
        'dice',
      )
      expect(checkDamageDice(alone({ types: [null] }), normal)).toBeUndefined()
      expect(checkDamageDice(alone({ types: ['cold'] }), normal)).toBe('type')
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
      // eslint-disable-next-line unicorn/no-useless-undefined -- found nowhere
      expect(check(undefined)).toBe('gone')
      expect(check(breathing({ recharge: undefined }))).toBe('gone')
      expect(check(breathing({}), { item: 'wolfBite' })).toBe('gone')
      // The item's own, not one of its activities'.
      expect(check(breathing({}), { activity: 'frostSave' })).toBe('gone')
    })
  })

  it('names, totals and tells healing of damage on its own as damage, and a recharge as one', () => {
    const made = held({
      kind: 'itemDamage',
      role: 'gm',
      status: 'done',
      result: {
        id: 'req-1',
        status: 'done',
        visible: true,
        rolls: [
          { formula: '2d6', total: 7, dice: [], damageType: 'healing' },
          { formula: '1d4', total: 2, dice: [], damageType: 'healing' },
        ],
      } as unknown as CommandResult,
    })
    expect(toRollRequestView(made, NOW).total).toBe(9)
    expect(toGmRollView({ ...made, label: null }, NOW)).toMatchObject({
      label: 'Damage',
      healing: true,
    })
    expect(
      toGmRollView({ ...held({ kind: 'recharge' }), label: null }, NOW).label,
    ).toBe('A recharge')
  })
})

/**
 * A fight as last heard of, from module 0.36.0: Thorin, his wolf, a goblin, Vex and her wolf, a
 * wolf of both, and an imp named a companion that isn't listed; Thorin's turn in round 2 unless
 * said.
 */
const turnFight = (fields: object = {}) =>
  combat({
    round: 2,
    combatantId: 'c-thorin',
    combatants: [
      combatant({ id: 'c-thorin', character: 'actor-thorin' }),
      combatant({ id: 'c-brakka', companion: 'wolfBrakka' }),
      combatant({ id: 'c-goblin', name: 'Goblin' }),
      combatant({ id: 'c-vex', character: 'actor-vex' }),
      combatant({ id: 'c-vex-wolf', companion: 'wolfVex' }),
      combatant({ id: 'c-shared', companion: 'wolfShared' }),
      combatant({ id: 'c-imp', companion: 'sceneFrost-tokenImp' }),
    ],
    ...fields,
  })

/** A turn as the page was shown it: this combatant's, in round 2 unless said. */
const turnOf = (combatantId: string, round = 2) => ({
  combatId: 'cmbt1',
  round,
  combatantId,
})

describe('utils/roll-requests, a turn ended, from module 0.36.0', () => {
  /**
   * Thorin's wolf, Brakka, Vex's, and one of both, as the campaign lists them: the last Vex's
   * first, so that Thorin is the second of its characters.
   */
  const roster = [
    mockCompanionEntry({ key: 'wolfBrakka', of: ['actor-thorin'] }),
    mockCompanionEntry({ key: 'wolfVex', of: ['actor-vex'] }),
    mockCompanionEntry({
      key: 'wolfShared',
      of: ['actor-vex', 'actor-thorin'],
    }),
  ]
  const fight = turnFight
  /** On whose turn the combat is, the page naming that turn. */
  const check = (
    combatantId: string,
    fields: object = {},
    turn = turnOf(combatantId),
  ) =>
    checkEndTurn(
      turn,
      [fight({ combatantId, ...fields })],
      'actor-thorin',
      roster,
    )

  it("takes the character's own turn", () => {
    expect(check('c-thorin')).toBeUndefined()
  })

  it("takes the turn of one of the character's listed companions, from the character's seat", () => {
    expect(check('c-brakka')).toBeUndefined()
  })

  it("takes the turn of a companion of two characters from either one's seat, the second listed too", () => {
    expect(check('c-shared')).toBeUndefined()
    expect(
      checkEndTurn(
        turnOf('c-shared'),
        [fight({ combatantId: 'c-shared' })],
        'actor-vex',
        roster,
      ),
    ).toBeUndefined()
  })

  it("refuses the turn of another character's companion, which isn't the seat's", () => {
    expect(check('c-vex-wolf')).toBe('not-turn')
  })

  it('refuses the turn of a creature named a companion that the campaign doesn’t list', () => {
    expect(check('c-imp')).toBe('not-turn')
  })

  it('refuses anyone else’s turn', () => {
    expect(check('c-goblin')).toBe('not-turn')
    expect(check('c-vex')).toBe('not-turn')
  })

  it('refuses a turn of a combat not held, or none named', () => {
    expect(checkEndTurn(turnOf('c-thorin'), [], 'actor-thorin', roster)).toBe(
      'not-in-combat',
    )
    expect(
      checkEndTurn(
        { ...turnOf('c-thorin'), combatId: 'cmbt2' },
        [fight()],
        'actor-thorin',
        roster,
      ),
    ).toBe('not-in-combat')
    expect(checkEndTurn(undefined, [fight()], 'actor-thorin', roster)).toBe(
      'not-in-combat',
    )
  })

  it('refuses a turn of a combat not started', () => {
    expect(check('c-thorin', { started: false })).toBe('not-started')
  })

  it('refuses a turn that has moved on: another round, or another combatant now', () => {
    // Round 2 is Thorin's, as the page last saw it; the game is on round 3.
    expect(check('c-thorin', { round: 3 })).toBe('moved')
    // The page was shown Thorin's turn; the game has gone on to his wolf's, also his.
    expect(check('c-brakka', {}, turnOf('c-thorin'))).toBe('moved')
    // Or no one is current, as while a hidden combatant acts.
    expect(check('c-thorin', { combatantId: null })).toBe('moved')
  })

  it('refuses a current combatant that is hidden, or the combat has no row of', () => {
    const hidden = fight({
      combatants: [
        combatant({ id: 'c-thorin', character: 'actor-thorin', hidden: true }),
      ],
    })
    expect(
      checkEndTurn(turnOf('c-thorin'), [hidden], 'actor-thorin', roster),
    ).toBe('moved')
    expect(
      checkEndTurn(
        turnOf('c-thorin'),
        [fight({ combatants: [] })],
        'actor-thorin',
        roster,
      ),
    ).toBe('moved')
  })

  it('sends the module a turn ended as it is, the character’s, with no companion named', () => {
    const payload = {
      kind: 'endTurn' as const,
      turn: turnOf('c-brakka'),
      mode: 0 as const,
      explicit: false,
      extras: [],
      dice: [],
    }
    const command = toCommand(
      held({ kind: 'endTurn', payload, ofActorId: null }),
    )
    expect(command).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
    expect(command).not.toHaveProperty('of')
    expect(command).not.toHaveProperty('by')
  })
})

/**
 * An End Turn of the seat's, from module 0.36.0, for this turn, as held: made 5 s ago unless
 * said.
 */
const ended = (
  turn = turnOf('c-thorin'),
  fields: Partial<{ status: string; completedAt: Date | null }> = {},
): HeldEndTurn => ({
  status: 'done',
  completedAt: new Date(NOW - 5000),
  payload: {
    kind: 'endTurn',
    turn,
    mode: 0,
    explicit: false,
    extras: [],
    dice: [],
  },
  ...fields,
})

/** That End Turn, made this long ago. */
const endedAgo = (ago: number) =>
  ended(undefined, { completedAt: new Date(NOW - ago) })

describe('utils/roll-requests, a turn taken back, from module 0.36.0', () => {
  /** Thorin's wolf, Brakka, and Vex's, as the campaign lists them. */
  const roster = [
    mockCompanionEntry({ key: 'wolfBrakka', of: ['actor-thorin'] }),
    mockCompanionEntry({ key: 'wolfVex', of: ['actor-vex'] }),
  ]
  /**
   * Thorin's End Turn taken back from the turn it left, Brakka's, the combat on that turn unless
   * said.
   */
  const check = ({
    left = turnOf('c-brakka'),
    held = ended() as HeldEndTurn | null,
    fights = [turnFight({ combatantId: 'c-brakka' })],
    actorId = 'actor-thorin',
    now = NOW,
  } = {}) => checkUndoTurn(left, held, fights, actorId, roster, now)

  it("takes back the character's own turn from the turn it left", () => {
    expect(check()).toBeUndefined()
  })

  it("takes back a listed companion's turn, from the character's seat", () => {
    expect(
      check({
        held: ended(turnOf('c-brakka')),
        left: turnOf('c-goblin'),
        fights: [turnFight({ combatantId: 'c-goblin' })],
      }),
    ).toBeUndefined()
  })

  it('takes it back across a round, to the turn that ended it', () => {
    // Brakka's End Turn began round 3 on Thorin's turn.
    expect(
      check({
        held: ended(turnOf('c-brakka')),
        left: turnOf('c-thorin', 3),
        fights: [turnFight({ round: 3, combatantId: 'c-thorin' })],
      }),
    ).toBeUndefined()
  })

  it('takes it back across a round onto the same combatant: Thorin alone to act, his turn again', () => {
    // Thorin's End Turn in round 2 began round 3 on his own turn: not the turn it ended.
    expect(
      check({
        held: ended(turnOf('c-thorin', 2)),
        left: turnOf('c-thorin', 3),
        fights: [turnFight({ round: 3, combatantId: 'c-thorin' })],
      }),
    ).toBeUndefined()
  })

  it('refuses an End Turn not held as the seat’s', () => {
    expect(check({ held: null })).toBe('not-undoable')
  })

  it('refuses an End Turn the game hasn’t made, or didn’t', () => {
    for (const status of ['pending', 'claimed', 'failed']) {
      expect(check({ held: ended(undefined, { status }) })).toBe('not-undoable')
    }
    expect(check({ held: ended(undefined, { completedAt: null }) })).toBe(
      'not-undoable',
    )
  })

  it('refuses one made too long ago, but takes one made 30 s ago', () => {
    expect(check({ held: endedAgo(31_000) })).toBe('not-undoable')
    expect(check({ held: endedAgo(30_001) })).toBe('not-undoable')
    expect(check({ held: endedAgo(30_000) })).toBeUndefined()
  })

  it('refuses one of another combat, or one naming no turn', () => {
    expect(
      check({ held: ended({ ...turnOf('c-thorin'), combatId: 'cmbt2' }) }),
    ).toBe('not-undoable')
    expect(check({ held: { ...ended(), payload: { kind: 'endTurn' } } })).toBe(
      'not-undoable',
    )
  })

  it('refuses it in a combat not held, or not started', () => {
    expect(check({ fights: [] })).toBe('not-in-combat')
    expect(
      check({
        fights: [turnFight({ combatantId: 'c-brakka', started: false })],
      }),
    ).toBe('not-started')
  })

  it('refuses it once the combat has moved on from the turn the page shows: another round, or another combatant', () => {
    expect(
      check({ fights: [turnFight({ round: 3, combatantId: 'c-brakka' })] }),
    ).toBe('moved')
    // The page shows Brakka's turn; the game has gone on to the goblin's.
    expect(check({ fights: [turnFight({ combatantId: 'c-goblin' })] })).toBe(
      'moved',
    )
    expect(check({ fights: [turnFight({ combatantId: null })] })).toBe('moved')
  })

  it('refuses it while the one acting is hidden, or the combat has no row of them', () => {
    const hidden = turnFight({
      combatantId: 'c-brakka',
      combatants: [
        combatant({ id: 'c-thorin', character: 'actor-thorin' }),
        combatant({ id: 'c-brakka', companion: 'wolfBrakka', hidden: true }),
      ],
    })
    expect(check({ fights: [hidden] })).toBe('moved')
    expect(
      check({
        fights: [
          turnFight({
            combatantId: 'c-brakka',
            combatants: [
              combatant({ id: 'c-thorin', character: 'actor-thorin' }),
            ],
          }),
        ],
      }),
    ).toBe('moved')
  })

  it('refuses it where the turn is back on the turn it ended already', () => {
    expect(
      check({
        left: turnOf('c-thorin'),
        fights: [turnFight({ combatantId: 'c-thorin' })],
      }),
    ).toBe('moved')
  })

  it('refuses it where the turn it ended is of a combatant gone, or hidden now', () => {
    expect(
      check({
        fights: [
          turnFight({
            combatantId: 'c-brakka',
            combatants: [
              combatant({ id: 'c-brakka', companion: 'wolfBrakka' }),
            ],
          }),
        ],
      }),
    ).toBe('not-undoable')
    expect(
      check({
        fights: [
          turnFight({
            combatantId: 'c-brakka',
            combatants: [
              combatant({
                id: 'c-thorin',
                character: 'actor-thorin',
                hidden: true,
              }),
              combatant({ id: 'c-brakka', companion: 'wolfBrakka' }),
            ],
          }),
        ],
      }),
    ).toBe('not-undoable')
  })

  it('refuses it where the turn it ended is no longer the seat’s: a companion not listed now, or another’s', () => {
    // An imp the campaign no longer lists as anyone's companion.
    expect(
      check({
        held: ended(turnOf('c-imp')),
        left: turnOf('c-brakka'),
      }),
    ).toBe('not-turn')
    // Vex's wolf, as Thorin's seat would have it.
    expect(
      check({
        held: ended(turnOf('c-vex-wolf')),
        left: turnOf('c-brakka'),
      }),
    ).toBe('not-turn')
    // Thorin's own turn, named from Vex's seat.
    expect(check({ actorId: 'actor-vex' })).toBe('not-turn')
  })

  it('sends the module a turn taken back as it is, the character’s, with no companion named', () => {
    const payload = {
      kind: 'undoEndTurn' as const,
      undo: 'req-0',
      turn: turnOf('c-brakka'),
      mode: 0 as const,
      explicit: false,
      extras: [],
      dice: [],
    }
    const command = toCommand(
      held({ kind: 'undoEndTurn', payload, ofActorId: null }),
    )
    expect(command).toEqual({
      ...payload,
      id: 'req-1',
      actorId: 'actor-thorin',
    })
    expect(command).not.toHaveProperty('of')
    expect(command).not.toHaveProperty('by')
  })
})
