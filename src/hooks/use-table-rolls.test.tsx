/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import { act, renderHook } from '@testing-library/react'
import {
  ALONE_KEY,
  BUSY_FOR,
  BUSY_WAIT,
  CHECK_EVERY,
  choicesOf,
  damageDue,
  damageRollOf,
  FOLLOW_FOR,
  GM_ALONE_KEY,
  GM_SEND_KEY,
  gmRollsOf,
  LATE_FOLLOW,
  needsPlayer,
  SEND_KEY,
  toFormulaRequest,
  toHitDiceRequest,
  toHitDieRequests,
  toRollRequest,
  useTableRolls,
} from './use-table-rolls'
import { MAX_ROLL_LABEL } from '@/constants/sending-stone'
import { TableApiContext } from '@/hooks/use-table-api'
import {
  aloneResult,
  aloneSpells,
  beastsResult,
  burningHandsAction,
  FORM_IDS,
  longbowAction,
  mockTableDamage,
  potionAction,
  wildShapeResult,
} from '@/mocks/sending-stone'
import { aloneRollOf } from '@/utils/damage-alone'
import {
  firstDie,
  modifiedDice,
  MOST_DICE,
  withModifiers,
  type DamageModifiers,
} from '@/utils/damage-modifiers'
import type {
  LocalAsk,
  LocalCheck,
  LocalDamage,
  LocalFormula,
  LocalUse,
  SheetDamageRoll,
  SheetFormulaRoll,
  SheetRoll,
} from './use-sheet-roller'
import type {
  FormulaSource,
  GmRollView,
  RollFeature,
  RollKind,
  RollSource,
} from '@/types/roll'
import type { DamagePreview } from '@/types/sending-stone'

const perception: SheetRoll = {
  label: 'Perception check',
  modifier: 4,
  advantage: 'adv',
  extras: [
    { sign: 1, count: 1, sides: 4 },
    { sign: -1, flat: 1 },
    { sign: 1, count: 2, sides: 6 },
  ],
  source: { kind: 'skill', key: 'prc' },
  explicit: true,
}

const check = (fields: Partial<LocalCheck> = {}): LocalCheck => ({
  kind: 'check',
  id: 'r1',
  label: 'Perception check',
  total: 28,
  modifier: 4,
  advantage: 'adv',
  d20s: [17, 3],
  natural: 17,
  extras: [
    { text: '+1d4', values: [2], value: 2 },
    { text: '−1', values: [], value: -1 },
    { text: '+2d6', values: [5, 1], value: 6 },
  ],
  at: 0,
  ...fields,
})

const longsword: SheetRoll = {
  label: 'Longsword attack',
  modifier: 7,
  source: {
    kind: 'attack',
    item: 'longsword',
    activity: 'swing',
    target: { combatId: 'cmbt1', combatantId: 'goblin' },
  },
}

/** The damage the game said a hit with the longsword throws: 1d8 + 4, then 1d6 fire. */
const preview = (fields: Partial<DamagePreview> = {}): DamagePreview => ({
  critical: false,
  plannable: true,
  rolls: [
    { formula: '1d8 + 4', type: 'slashing', dice: [{ faces: 8, number: 1 }] },
    { formula: '1d6', type: 'fire', dice: [{ faces: 6, number: 1 }] },
  ],
  ...fields,
})

/** A greataxe's damage of one roll, as the game said it, to roll at the table. */
const one = (
  formula: string,
  dice: DamagePreview['rolls'][number]['dice'],
  fields: Partial<DamagePreview> = {},
) =>
  damageRollOf('Greataxe', {
    use: 'req-1',
    damage: preview({
      rolls: [{ formula, type: 'slashing', dice }],
      ...fields,
    }),
  })

const thrownDamage = (fields: Partial<LocalDamage> = {}): LocalDamage => ({
  kind: 'damage',
  id: 'r2',
  label: 'Longsword damage',
  total: 15,
  critical: false,
  healing: false,
  parts: [
    {
      type: 'slashing',
      total: 9,
      terms: [
        { text: '1d8', values: [5], value: 5 },
        { text: '+4', values: [], value: 4 },
      ],
    },
    { type: 'fire', total: 6, terms: [{ text: '1d6', values: [6], value: 6 }] },
  ],
  at: 0,
  ...fields,
})

/** A d10 hit die spent, with Thorin's Constitution modifier of +3. */
const hitDie: SheetFormulaRoll = {
  label: 'Hit die (d10)',
  terms: [
    { sign: 1, count: 1, sides: 10 },
    { sign: 1, flat: 3 },
  ],
  healing: true,
  minimum: 1,
  source: { kind: 'hitDie', denomination: 'd10' },
}

/** It landed on 6, giving back 9. */
const spent = (fields: Partial<LocalFormula> = {}): LocalFormula => ({
  kind: 'formula',
  id: 'f1',
  label: 'Hit die (d10)',
  total: 9,
  healing: true,
  terms: [
    { text: '1d10', values: [6], value: 6 },
    { text: '+3', values: [], value: 3 },
  ],
  at: 0,
  ...fields,
})

/** Two d10 hit dice and a d8 spent at once, thrown together, the largest first. */
const hitDice: SheetFormulaRoll = {
  label: 'Hit dice (2d10 + 1d8)',
  terms: [],
  sets: [
    { terms: hitDie.terms, times: 2 },
    {
      terms: [
        { sign: 1, count: 1, sides: 8 },
        { sign: 1, flat: 3 },
      ],
      times: 1,
    },
  ],
  healing: true,
  minimum: 1,
  source: {
    kind: 'hitDice',
    hitDice: [
      { denomination: 'd10', count: 2 },
      { denomination: 'd8', count: 1 },
    ],
  },
}

/** The d10s landed on 6 and 2, the d8 on 5, giving back 9, 5 and 8. */
const spentThree = (): LocalFormula =>
  spent({
    label: 'Hit dice (2d10 + 1d8)',
    total: 22,
    terms: [
      { text: '2d10', values: [6, 2], value: 8 },
      { text: '+1d8', values: [5], value: 5 },
      { text: '+9', values: [], value: 9 },
    ],
    times: 3,
  })

/** The three spent at once as a game from module 0.20.0 is asked to spend them. */
const hitDiceRequest = {
  kind: 'hitDice',
  hitDice: [
    { denomination: 'd10', count: 2 },
    { denomination: 'd8', count: 1 },
  ],
  mode: 0,
  explicit: false,
  extras: [],
  dice: [
    { faces: 10, results: [6, 2] },
    { faces: 8, results: [5] },
  ],
}

/** A hit die as a game before module 0.20.0 is asked to spend one of several spent at once. */
const oneHitDie = (denomination: string, faces: number, value: number) => ({
  kind: 'hitDie',
  denomination,
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces, results: [value] }],
})

/** Whether a roll sent threw the second of the three dice spent at once, a d10 that landed on 2. */
const isSecond = (dice: unknown) =>
  JSON.stringify(dice) === JSON.stringify([{ faces: 10, results: [2] }])

/** The bodies of the rolls sent, in order. */
const posted = () =>
  jest
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === 'POST')
    .map(
      ([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>,
    )

/** A lantern's light, whose radius is 2 + 1d4 − 1d6, as dnd5e has it. */
const lantern: SheetFormulaRoll = {
  label: 'Lantern: Light radius',
  terms: [
    { sign: 1, flat: 2 },
    { sign: 1, count: 1, sides: 4 },
    { sign: -1, count: 1, sides: 6 },
  ],
  source: { kind: 'formula', item: 'lantern', activity: 'shine' },
}

const shone: LocalFormula = {
  kind: 'formula',
  id: 'f2',
  label: 'Lantern: Light radius',
  total: 1,
  healing: false,
  terms: [
    { text: '2', values: [], value: 2 },
    { text: '+1d4', values: [3], value: 3 },
    { text: '−1d6', values: [4], value: -4 },
  ],
  at: 0,
}

/** Pick a Lock, with Thieves' Tools, against its DC, as a check of this kind and key. */
const lock = (kind: 'skill' | 'tool' | 'ability', key: string): SheetRoll => ({
  label: "Thieves' Tools check",
  modifier: 6,
  source: { kind, key, item: 'tools', activity: 'pick' },
  dc: 15,
})

const respond = (status: number, body?: unknown) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  }) as Response

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms)
  })

const render = (
  kinds: RollKind[] = ['skill', 'save'],
  features: RollFeature[] = [],
) =>
  renderHook(props => useTableRolls('char-1', props.kinds, props.features), {
    initialProps: { kinds, features },
  })

/** What was sent last, as the app has it. */
const sent = () =>
  JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)) as Record<
    string,
    unknown
  >

describe('hooks/use-table-rolls', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('toRollRequest', () => {
    it('asks for the roll as it was made, with every die thrown, in order', () => {
      expect(
        toRollRequest(perception, { kind: 'skill', key: 'prc' }, check()),
      ).toEqual({
        kind: 'skill',
        key: 'prc',
        mode: 1,
        explicit: true,
        extras: perception.extras,
        dice: [
          { faces: 20, results: [17, 3] },
          { faces: 4, results: [2] },
          { faces: 6, results: [5, 1] },
        ],
      })
    })

    it('asks for initiative in its combat, and a death save, which name nothing', () => {
      const plain = { label: 'Initiative', modifier: 2 }
      const thrown = check({ advantage: 'dis', d20s: [9, 4], extras: [] })
      expect(
        toRollRequest(plain, { kind: 'initiative', combatId: 'cmbt1' }, thrown),
      ).toEqual({
        kind: 'initiative',
        combatId: 'cmbt1',
        mode: -1,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [9, 4] }],
      })
      expect(
        toRollRequest(
          plain,
          { kind: 'death' },
          check({ advantage: undefined, d20s: [11], extras: [] }),
        ),
      ).toMatchObject({ kind: 'death', mode: 0 })
    })

    it('asks for an attack with its item, its attack and its target', () => {
      const thrown = check({ advantage: undefined, d20s: [15], extras: [] })
      expect(toRollRequest(longsword, longsword.source!, thrown)).toEqual({
        kind: 'attack',
        item: 'longsword',
        activity: 'swing',
        target: { combatId: 'cmbt1', combatantId: 'goblin' },
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [15] }],
      })
      expect(
        toRollRequest(
          longsword,
          { kind: 'attack', item: 'longsword', activity: 'swing' },
          thrown,
        ),
      ).toMatchObject({ kind: 'attack', target: null })
    })

    it('asks for an attack with the spell slot, ammunition and attack mode chosen', () => {
      const thrown = check({ advantage: undefined, d20s: [15], extras: [] })
      expect(
        toRollRequest(
          longsword,
          {
            kind: 'attack',
            item: 'bow',
            activity: 'shoot',
            slot: 'spell2',
            ammunition: 'arrows',
            attackMode: 'twoHanded',
          },
          thrown,
        ),
      ).toMatchObject({
        slot: 'spell2',
        ammunition: 'arrows',
        attackMode: 'twoHanded',
      })
    })

    it('asks for an area attack at those in its area, in place of a target', () => {
      const thrown = check({ advantage: undefined, d20s: [15], extras: [] })
      const targets = [
        { combatId: 'cmbt1', combatantId: 'goblin' },
        { combatId: 'cmbt1', combatantId: 'ogre' },
      ]
      const request = toRollRequest(
        longsword,
        {
          kind: 'attack',
          item: 'breath',
          activity: 'exhale',
          targets,
          slot: 'spell2',
        },
        thrown,
      )
      expect(request).toEqual({
        kind: 'attack',
        item: 'breath',
        activity: 'exhale',
        targets,
        slot: 'spell2',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [15] }],
      })
      expect(request).not.toHaveProperty('target')
      // At no one in its area, it's still an area attack.
      expect(
        toRollRequest(
          longsword,
          { kind: 'attack', item: 'breath', activity: 'exhale', targets: [] },
          thrown,
        ),
      ).not.toHaveProperty('target')
    })
  })

  describe('toFormulaRequest', () => {
    it('asks for a hit die by its size, with its die as thrown, and none of its numbers', () => {
      expect(
        toFormulaRequest(
          hitDie,
          { kind: 'hitDie', denomination: 'd10' },
          spent(),
        ),
      ).toEqual({
        kind: 'hitDie',
        denomination: 'd10',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 10, results: [6] }],
      })
    })

    it('asks for hit dice spent at once by how many of each size, with the dice of each, in order', () => {
      const source = hitDice.source as Extract<
        FormulaSource,
        { kind: 'hitDice' }
      >
      expect(toHitDiceRequest(source, spentThree())).toEqual(hitDiceRequest)
    })

    it('asks a game before module 0.20.0 for hit dice spent at once a hit die each, with its own die, the largest first', () => {
      const source = hitDice.source as Extract<
        FormulaSource,
        { kind: 'hitDice' }
      >
      expect(toHitDieRequests(source, spentThree())).toEqual([
        oneHitDie('d10', 10, 6),
        oneHitDie('d10', 10, 2),
        oneHitDie('d8', 8, 5),
      ])
    })

    it("asks for an activity's own formula by its item and activity, with the dice of each term, in order", () => {
      const request = toFormulaRequest(
        lantern,
        { kind: 'formula', item: 'lantern', activity: 'shine' },
        shone,
      )
      expect(request).toEqual({
        kind: 'formula',
        item: 'lantern',
        activity: 'shine',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 4, results: [3] },
          { faces: 6, results: [4] },
        ],
      })
      expect(request).not.toHaveProperty('denomination')
    })
  })

  describe('damageRollOf', () => {
    it('rolls the damage the game said, part by part, with its formula', () => {
      expect(
        damageRollOf('Longsword', { use: 'req-1', damage: preview() }),
      ).toEqual<SheetDamageRoll>({
        label: 'Longsword damage',
        critical: false,
        healing: false,
        exact: true,
        use: 'req-1',
        perDie: 1,
        parts: [
          {
            type: 'slashing',
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 4 },
            ],
          },
          { type: 'fire', terms: [{ sign: 1, count: 1, sides: 6 }] },
        ],
      })
    })

    it("rolls a critical hit's dice as the game doubled them, and only dice the app can't read", () => {
      const critical = preview({
        critical: true,
        rolls: [
          {
            formula: '2d8 + 4',
            type: 'slashing',
            dice: [{ faces: 8, number: 2 }],
            perDie: 2,
          },
          {
            formula: '1d6 + @mod',
            type: 'fire',
            dice: [{ faces: 6, number: 2 }],
            perDie: 2,
          },
        ],
      })
      expect(
        damageRollOf('Longsword', { use: 'req-1', damage: critical }),
      ).toEqual({
        label: 'Longsword damage',
        critical: true,
        healing: false,
        exact: true,
        use: 'req-1',
        perDie: 2,
        // A formula the app can't read loses its numbers: its total is the game's (module 0.32.0).
        gameTotal: true,
        parts: [
          {
            type: 'slashing',
            terms: [
              { sign: 1, count: 2, sides: 8 },
              { sign: 1, flat: 4 },
            ],
          },
          { type: 'fire', terms: [{ sign: 1, count: 2, sides: 6 }] },
        ],
      })
    })

    it("marks a critical hit's critical damage's dice added, as the game does, from its formula or its dice alone", () => {
      // A greataxe's critical hit: 3d12 + 3, and the weapon's 1d6.
      const greataxe = preview({
        critical: true,
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
      })
      const { parts } = damageRollOf('Greataxe', {
        use: 'req-1',
        damage: greataxe,
      })
      expect(parts[0].terms).toEqual([
        { sign: 1, count: 3, sides: 12 },
        { sign: 1, flat: 3 },
        { sign: 1, count: 1, sides: 6, added: true },
      ])
      // A flavor is left out of its formula.
      const flavoured = damageRollOf('Greataxe', {
        use: 'req-1',
        damage: {
          ...greataxe,
          rolls: [{ ...greataxe.rolls[0], formula: '3d12 + 3 + 1d6[fire]' }],
        },
      })
      expect(flavoured.parts[0].terms).toEqual(parts[0].terms)
      // Where the app can't read its formula, its dice alone, marked as well.
      const unread = damageRollOf('Greataxe', {
        use: 'req-1',
        damage: {
          ...greataxe,
          rolls: [{ ...greataxe.rolls[0], formula: '3d12 + 3 + 1d6ro' }],
        },
      })
      expect(unread.parts[0].terms).toEqual([
        { sign: 1, count: 3, sides: 12 },
        { sign: 1, count: 1, sides: 6, added: true },
      ])
    })

    it('keeps how the player changed it, now or as they used it, and how many dice the game throws for each added', () => {
      const critical = preview({
        critical: true,
        rolls: [
          {
            formula: '2d8 + 4',
            type: 'slashing',
            dice: [{ faces: 8, number: 2 }],
            perDie: 2,
          },
        ],
      })
      const used = { use: 'req-1', damage: critical, modifiers: { extra: 1 } }

      expect(damageRollOf('Longsword', used)).toMatchObject({
        modifiers: { extra: 1 },
        perDie: 2,
      })
      expect(
        damageRollOf('Longsword', used, undefined, { maximize: true }),
      ).toMatchObject({ modifiers: { maximize: true } })
      // Changes that change nothing aren't kept.
      expect(
        damageRollOf('Longsword', used, undefined, { extra: 0 }),
      ).not.toHaveProperty('modifiers')
    })

    it('rolls healing as healing, and the kind of damage chosen for each roll that offers it', () => {
      const fire = { key: 'fire', label: 'Fire' }
      const cold = { key: 'cold', label: 'Cold' }
      expect(
        damageRollOf('Cure Wounds', {
          use: 'req-1',
          damage: preview({
            healing: true,
            rolls: [
              {
                formula: '2d8 + 3',
                type: 'Healing',
                dice: [{ faces: 8, number: 2 }],
              },
            ],
          }),
        }),
      ).toMatchObject({ label: 'Cure Wounds healing', healing: true })

      const orb = preview({
        rolls: [
          {
            formula: '3d8',
            type: 'Acid',
            types: [{ key: 'acid', label: 'Acid' }, fire, cold],
            dice: [{ faces: 8, number: 3 }],
          },
          {
            formula: '1d6',
            type: 'Acid',
            types: [fire, cold],
            dice: [{ faces: 6, number: 1 }],
          },
          { formula: '2', type: 'Force', dice: [] },
        ],
      })
      expect(choicesOf(orb)).toEqual([
        { key: 'acid', label: 'Acid' },
        fire,
        cold,
      ])
      expect(choicesOf(preview())).toEqual([])
      const chosen = damageRollOf(
        'Chromatic Orb',
        { use: 'req-1', damage: orb },
        'acid',
      )
      expect(chosen.types).toEqual(['acid', null, null])
      expect(chosen.parts.map(part => part.type)).toEqual([
        'Acid',
        'Acid',
        'Force',
      ])
      const cooled = damageRollOf(
        'Chromatic Orb',
        { use: 'req-1', damage: orb },
        'cold',
      )
      expect(cooled.types).toEqual(['cold', 'cold', null])
      expect(cooled.parts.map(part => part.type)).toEqual([
        'Cold',
        'Cold',
        'Force',
      ])
      expect(
        damageRollOf('Chromatic Orb', { use: 'req-1', damage: orb }).types,
      ).toBeUndefined()
    })

    it('throws no dice for damage the game rolls itself', () => {
      const roll = damageRollOf('Club', {
        use: 'req-1',
        damage: preview({ plannable: false }),
      })
      expect(roll.parts).toEqual([
        { type: 'slashing', terms: [] },
        { type: 'fire', terms: [] },
      ])
    })

    describe('dice the damage takes away', () => {
      /** A greataxe under Reduce: 1d12 + 3, less 1d4, as the harness builds it. */
      const reduced = [
        { sign: 1, count: 1, sides: 12 },
        { sign: 1, flat: 3 },
        { sign: -1, count: 1, sides: 4 },
      ]

      /** -1d4 + 2d6, from a module before 0.21.0, which marks nothing, or from 0.21.0. */
      const said = (marked: boolean) =>
        preview({
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
        })

      it('takes away the dice the game marks, from its formula, and changes its first die', () => {
        const roll = one('1d12 + 3 - 1d4', [
          { faces: 12, number: 1 },
          { faces: 4, number: 1, subtracted: true },
        ])
        expect(roll.parts[0].terms).toEqual(reduced)
        expect(roll).not.toHaveProperty('fixed')
      })

      it('reads which a module before 0.21.0 takes away from its formula', () => {
        const roll = one('1d12 + 3 - 1d4', [
          { faces: 12, number: 1 },
          { faces: 4, number: 1 },
        ])
        expect(roll.parts[0].terms).toEqual(reduced)
        expect(roll).not.toHaveProperty('fixed')
      })

      it('changes no dice where a module before 0.21.0 would change one it takes away', () => {
        const roll = one('- 1d4 + 2d6', [
          { faces: 4, number: 1 },
          { faces: 6, number: 2 },
        ])
        expect(roll.parts[0].terms).toEqual([
          { sign: -1, count: 1, sides: 4 },
          { sign: 1, count: 2, sides: 6 },
        ])
        expect(roll.fixed).toBe(true)
        // From module 0.21.0, which changes the d6, they're changed.
        expect(
          one('- 1d4 + 2d6', [
            { faces: 4, number: 1, subtracted: true },
            { faces: 6, number: 2 },
          ]),
        ).not.toHaveProperty('fixed')
        // Nor where it adds no die of its own.
        expect(
          one('1 + 3 - 1d4', [{ faces: 4, number: 1, subtracted: true }]).fixed,
        ).toBe(true)
      })

      it("reads Midi-QOL's copies, each at least its highest, with their marks", () => {
        const roll = one('1d8 + 1d8min8 - 1d4 - 1d4min4', [
          { faces: 8, number: 1 },
          { faces: 8, number: 1, added: true },
          { faces: 4, number: 1, subtracted: true },
          { faces: 4, number: 1, added: true, subtracted: true },
        ])
        expect(roll.parts[0].terms).toEqual([
          { sign: 1, count: 1, sides: 8 },
          { sign: 1, count: 1, sides: 8, added: true, modifiers: ['min8'] },
          { sign: -1, count: 1, sides: 4 },
          { sign: -1, count: 1, sides: 4, added: true, modifiers: ['min4'] },
        ])
        expect(roll).not.toHaveProperty('fixed')
      })

      it("throws dice alone with their marks where the app can't read the formula", () => {
        const roll = one('1d8 + 1d8ro - 1d4 - 1d4ro', [
          { faces: 8, number: 1 },
          { faces: 8, number: 1, added: true },
          { faces: 4, number: 1, subtracted: true },
          { faces: 4, number: 1, added: true, subtracted: true },
        ])
        expect(roll.parts[0].terms).toEqual([
          { sign: 1, count: 1, sides: 8 },
          { sign: 1, count: 1, sides: 8, added: true },
          { sign: -1, count: 1, sides: 4 },
          { sign: -1, count: 1, sides: 4, added: true },
        ])
        expect(roll).not.toHaveProperty('fixed')
      })

      it('changes the same die of the dice the game said as of the parts it rolls', () => {
        const unmarked = said(false)
        expect(
          damageRollOf('Withering Touch', { use: 'req-1', damage: unmarked })
            .fixed,
        ).toBe(true)
        expect(modifiedDice(unmarked, { extra: 1 })).toBeUndefined()
        // The d6 among its parts, the second of the dice the game said: both changed there.
        const marked = said(true)
        const roll = damageRollOf('Withering Touch', {
          use: 'req-1',
          damage: marked,
        })
        expect(roll).not.toHaveProperty('fixed')
        expect(firstDie(roll.parts)).toBe(roll.parts[0].terms[1])
        expect(firstDie(roll.parts)).toEqual({ sign: 1, count: 2, sides: 6 })
        expect(modifiedDice(marked, { extra: 1 })).toEqual([
          { faces: 4, number: 1, subtracted: true },
          { faces: 6, number: 3 },
        ])
      })

      it.each<
        [string, DamagePreview, DamageModifiers, DamageModifiers | undefined]
      >([
        [
          'none where it adds no die of its own',
          preview({
            rolls: [
              {
                formula: '1 + 3 - 1d4',
                type: 'bludgeoning',
                dice: [{ faces: 4, number: 1, subtracted: true }],
              },
            ],
          }),
          { extra: 1 },
          undefined,
        ],
        [
          'its die changed, never at its highest where it takes a die away',
          preview({
            rolls: [
              {
                formula: '1d12 + 3 - 1d4',
                type: 'slashing',
                dice: [
                  { faces: 12, number: 1 },
                  { faces: 4, number: 1, subtracted: true },
                ],
              },
            ],
          }),
          { extra: 1, maximize: true },
          { extra: 1 },
        ],
        [
          'all of them where the game rolls it itself',
          preview({
            plannable: false,
            rolls: [{ formula: '1d3 - 1d4', type: 'slashing', dice: [] }],
          }),
          { extra: 1 },
          { extra: 1 },
        ],
        [
          'never at its highest where the game rolls it itself and its formula takes a die away',
          preview({
            plannable: false,
            rolls: [{ formula: '1d3 - 1d4', type: 'slashing', dice: [] }],
          }),
          { extra: 1, maximize: true },
          { extra: 1 },
        ],
        [
          'no more dice than its die cast higher may still take, as Cure Wounds at 3rd level, whose label had 2d8',
          preview({
            rolls: [
              {
                formula: '6d8 + 3',
                type: 'healing',
                dice: [{ faces: 8, number: 6 }],
              },
            ],
          }),
          { extra: 38 },
          { extra: 34 },
        ],
      ])(
        'rolls it with the changes chosen as it was used that the game takes: %s',
        (_, damage, modifiers, kept) => {
          const roll = damageRollOf('Greataxe', {
            use: 'req-1',
            damage,
            modifiers,
          })
          if (kept) expect(roll.modifiers).toEqual(kept)
          else expect(roll).not.toHaveProperty('modifiers')
          // Never more of a die than a request may carry, so the game is never asked in vain.
          const thrown = withModifiers(roll.parts, roll.modifiers, roll.perDie)
          expect(
            thrown.every(part =>
              part.terms.every(
                term => !('sides' in term) || term.count <= MOST_DICE,
              ),
            ),
          ).toBe(true)
        },
      )

      it("takes away a critical hit's doubled dice as the game marks them", () => {
        const roll = one(
          '- 2d4 + 4d6',
          [
            { faces: 4, number: 2, subtracted: true },
            { faces: 6, number: 4 },
          ],
          { critical: true },
        )
        expect(roll.parts[0].terms).toEqual([
          { sign: -1, count: 2, sides: 4 },
          { sign: 1, count: 4, sides: 6 },
        ])
      })
    })
  })

  it('sends a roll the game takes, and follows it until the game has made it', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'rolling' }))
      .mockResolvedValueOnce(
        respond(200, { id: 'req-1', status: 'done', visible: true, total: 23 }),
      )
    const { result } = render()
    expect(result.current.available).toBe(true)
    expect(result.current.sending).toBe(true)

    act(() => result.current.send(perception, check()))
    expect(result.current.states.get('r1')).toEqual({ status: 'sending' })
    expect(fetch).toHaveBeenCalledWith('/api/characters/char-1/rolls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toRollRequest(perception, { kind: 'skill', key: 'prc' }, check()),
      ),
      signal: expect.any(AbortSignal),
    })

    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/characters/char-1/rolls/req-1',
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    )
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'rolling',
    })

    await advance(CHECK_EVERY)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'done',
      visible: true,
      total: 23,
    })
    await advance(CHECK_EVERY * 5)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each<[string, RollKind[], SheetRoll]>([
    ['a roll the game does not take', ['save'], perception],
    ['a roll the game cannot make', ['skill'], { label: 'Axe', modifier: 5 }],
  ])("doesn't send %s", (_, kinds, roll) => {
    const { result } = render(kinds)

    act(() => result.current.send(roll, check()))

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.states.size).toBe(0)
  })

  it('takes no rolls while the game takes none', () => {
    const { result } = render([])

    expect(result.current.available).toBe(false)
    act(() => result.current.send(perception, check()))
    expect(fetch).not.toHaveBeenCalled()
  })

  it("doesn't send rolls from a device the player turned sending off on, remembering it", () => {
    const { result } = render()

    act(() => result.current.setSending(false))
    expect(result.current.sending).toBe(false)
    expect(globalThis.localStorage.getItem(SEND_KEY)).toBe('off')
    act(() => result.current.send(perception, check()))
    expect(fetch).not.toHaveBeenCalled()

    act(() => result.current.setSending(true))
    act(() => result.current.send(perception, check()))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('sends with what the game takes as it changes', () => {
    const { result, rerender } = render(['save'])

    rerender({ kinds: ['skill'], features: [] })
    act(() => result.current.send(perception, check()))

    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['the app refused it', respond(422, { reason: 'not-dying' }), 'not-dying'],
    ['too many were sent', respond(429, { reason: 'busy' }), 'busy'],
    ['the app failed', respond(500), 'error'],
  ])('says why a roll was not sent when %s', async (_, response, reason) => {
    jest.mocked(fetch).mockResolvedValueOnce(response)
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)

    expect(result.current.states.get('r1')).toEqual({
      status: 'refused',
      reason,
    })
  })

  it('says when the app could not be reached', async () => {
    jest.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)

    expect(result.current.states.get('r1')).toEqual({
      status: 'refused',
      reason: 'network',
    })
  })

  it("keeps asking through a failed check, and gives up on a roll that's never answered", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue(respond(200, { id: 'req-1', status: 'rolling' }))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY * 2)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'rolling',
    })

    await advance(FOLLOW_FOR)
    expect(result.current.states.get('r1')).toEqual({
      status: 'lost',
      requestId: 'req-1',
    })
  })

  it('stops following a roll the page may no longer see', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(404))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY)

    expect(result.current.states.get('r1')).toEqual({
      status: 'lost',
      requestId: 'req-1',
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('goes on asking after a roll that took the game too long, which it may make after all', async () => {
    const timedOut = { id: 'req-1', status: 'failed', reason: 'timeout' }
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValueOnce(respond(200, timedOut))
      .mockResolvedValueOnce(respond(200, timedOut))
      .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'done' }))
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(CHECK_EVERY)
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'failed',
      reason: 'timeout',
    })

    await advance(CHECK_EVERY * 2)
    expect(result.current.states.get('r1')).toMatchObject({ status: 'done' })
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it("stops asking after a roll that took too long, once the game can't make it any more", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      .mockResolvedValue(
        respond(200, { id: 'req-1', status: 'failed', reason: 'timeout' }),
      )
    const { result } = render()

    act(() => result.current.send(perception, check()))
    await advance(LATE_FOLLOW + CHECK_EVERY * 2)
    const asked = jest.mocked(fetch).mock.calls.length
    await advance(CHECK_EVERY * 5)

    expect(fetch).toHaveBeenCalledTimes(asked)
    // It stays as the game last said, rather than lost.
    expect(result.current.states.get('r1')).toMatchObject({
      status: 'failed',
      reason: 'timeout',
    })
  })

  describe('attacks', () => {
    const made = {
      id: 'req-1',
      status: 'done',
      visible: true,
      total: 19,
      attack: { critical: false, fumble: false, outcome: 'hit' },
      damage: preview(),
    }
    const attackCheck = check({
      label: 'Longsword attack',
      advantage: undefined,
      d20s: [12],
      extras: [],
    })

    it('sends an attack, then rolls its damage at the table once, with the dice the game said', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, made))
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result } = render(['attack', 'damage'])
      expect(result.current.takes('attack')).toBe(true)

      act(() => result.current.send(longsword, attackCheck))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('r1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        source: { item: 'longsword', activity: 'swing' },
        attack: { outcome: 'hit' },
      })
      const due = { use: 'req-1', damage: preview() }
      expect(result.current.dueDamage('req-1')).toEqual(due)
      expect(
        result.current.dueFor({ item: 'longsword', activity: 'swing' }),
      ).toEqual(due)
      expect(
        result.current.dueFor({ item: 'longsword', activity: 'thrown' }),
      ).toBeUndefined()

      act(() =>
        result.current.sendDamage(
          damageRollOf('Longsword', due),
          thrownDamage(),
        ),
      )
      expect(fetch).toHaveBeenLastCalledWith('/api/characters/char-1/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'damage',
          use: 'req-1',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [
            { faces: 8, results: [5] },
            { faces: 6, results: [6] },
          ],
        }),
        signal: expect.any(AbortSignal),
      })
      expect(result.current.states.get('r1')).toMatchObject({ damaged: true })
      expect(result.current.states.get('r2')).toEqual({ status: 'sending' })
      // Its damage is on its way: it isn't offered again.
      expect(result.current.dueDamage('req-1')).toBeUndefined()
      expect(
        result.current.dueFor({ item: 'longsword', activity: 'swing' }),
      ).toBeUndefined()
    })

    it("rolls Great Weapon Fighting's damage as its formula has it, sending each die's first throw", () => {
      const greatsword = preview({
        rolls: [
          {
            formula: '2d6r<=2 + 7',
            type: 'slashing',
            dice: [{ faces: 6, number: 2 }],
          },
        ],
      })
      const roll = damageRollOf('Greatsword', {
        use: 'req-1',
        damage: greatsword,
      })
      expect(roll.parts[0].terms).toEqual([
        { sign: 1, count: 2, sides: 6, modifiers: ['r<=2'] },
        { sign: 1, flat: 7 },
      ])
      const { result } = render(['attack', 'damage'])

      // Its 1 rerolled to a 4: the game is sent the 1 and the 5, and rerolls the 1 itself.
      act(() =>
        result.current.sendDamage(
          roll,
          thrownDamage({
            total: 16,
            gameTotal: true,
            parts: [
              {
                type: 'slashing',
                total: 16,
                terms: [
                  {
                    text: '2d6r<=2',
                    values: [1, 5],
                    value: 9,
                    thrown: [
                      { value: 1, active: false, rerolled: true },
                      { value: 5, active: true },
                      { value: 4, active: true },
                    ],
                  },
                  { text: '+7', values: [], value: 7 },
                ],
              },
            ],
          }),
        ),
      )
      expect(sent()).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 6, results: [1, 5] }],
      })
    })

    it('offers no damage for an attack that missed, or whose damage the game rolls with nothing to follow', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, { ...made, damage: null }))
      const { result } = render(['attack', 'damage'])

      act(() => result.current.send(longsword, attackCheck))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('r1')).toMatchObject({ status: 'done' })
      expect(result.current.dueDamage('req-1')).toBeUndefined()
    })

    it("sends no damage the game doesn't take, nor damage of no attack at the table", () => {
      const { result } = render(['attack'])
      const due = { use: 'req-1', damage: preview() }

      act(() =>
        result.current.sendDamage(
          damageRollOf('Longsword', due),
          thrownDamage(),
        ),
      )
      expect(fetch).not.toHaveBeenCalled()

      const { result: taking } = render(['attack', 'damage'])
      act(() =>
        taking.current.sendDamage(
          { label: 'Longsword damage', parts: [] },
          thrownDamage(),
        ),
      )
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('uses', () => {
    const fireball: LocalUse = {
      kind: 'use',
      id: 'u1',
      label: 'Fireball',
      spell: true,
      at: 0,
    }
    const cast = {
      kind: 'use' as const,
      item: 'fireball',
      activity: 'blast',
      targets: [{ combatId: 'cmbt1', combatantId: 'goblin' }],
      slot: 'spell4',
    }

    it('sends a use, with no dice, and follows it until the game has made it, its damage then due', async () => {
      const fire = { key: 'fire', label: 'Fire' }
      const damage = preview({
        rolls: [
          {
            formula: '9d6',
            type: 'Fire',
            types: [fire, { key: 'cold', label: 'Cold' }],
            dice: [{ faces: 6, number: 9 }],
          },
        ],
      })
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
            use: { type: 'save' },
            damage,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result } = render(['use', 'damage'])
      expect(result.current.takes('use')).toBe(true)

      act(() => result.current.sendUse(fireball, cast))
      expect(fetch).toHaveBeenLastCalledWith('/api/characters/char-1/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'use',
          item: 'fireball',
          activity: 'blast',
          targets: cast.targets,
          slot: 'spell4',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [],
        }),
        signal: expect.any(AbortSignal),
      })
      await advance(CHECK_EVERY)

      expect(result.current.states.get('u1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        name: 'Fireball',
        source: { item: 'fireball', activity: 'blast' },
        use: { type: 'save' },
      })
      const due = { use: 'req-1', damage }
      expect(
        result.current.dueFor({ item: 'fireball', activity: 'blast' }),
      ).toEqual(due)

      act(() =>
        result.current.sendDamage(damageRollOf('Fireball', due, 'fire'), {
          ...thrownDamage(),
          parts: [
            {
              type: 'Fire',
              total: 9,
              terms: [
                { text: '9d6', values: [1, 1, 1, 1, 1, 1, 1, 1, 1], value: 9 },
              ],
            },
          ],
        }),
      )
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toEqual({
        kind: 'damage',
        use: 'req-1',
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 6, results: [1, 1, 1, 1, 1, 1, 1, 1, 1] }],
        types: ['fire'],
      })
      expect(
        result.current.dueFor({ item: 'fireball', activity: 'blast' }),
      ).toBeUndefined()
    })

    it('keeps how the player changed the damage that follows a use, to roll it so, where the game takes it', async () => {
      const damage = preview({
        rolls: [
          {
            formula: '8d6',
            type: 'Fire',
            dice: [{ faces: 6, number: 8 }],
            perDie: 1,
          },
        ],
      })
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            rolls: [],
            use: { type: 'save' },
            damage,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result, rerender } = render(['use', 'damage'])
      expect(result.current.modifies).toBe(false)
      rerender({ kinds: ['use', 'damage'], features: ['modifiers'] })
      expect(result.current.modifies).toBe(true)

      act(() => result.current.sendUse(fireball, cast, { maximize: true }))
      // The use itself carries none: they're its damage's.
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).not.toHaveProperty('modifiers')
      await advance(CHECK_EVERY)

      const due = result.current.dueFor({ item: 'fireball', activity: 'blast' })
      expect(due).toEqual({
        use: 'req-1',
        damage,
        modifiers: { maximize: true },
      })
      const roll = damageRollOf('Fireball', due as NonNullable<typeof due>)
      act(() =>
        result.current.sendDamage(roll, {
          ...thrownDamage(),
          maximized: true,
          parts: [
            {
              type: 'Fire',
              total: 48,
              terms: [
                {
                  text: '8d6',
                  values: [6, 6, 6, 6, 6, 6, 6, 6],
                  value: 48,
                },
              ],
            },
          ],
        }),
      )
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toMatchObject({
        kind: 'damage',
        use: 'req-1',
        dice: [{ faces: 6, results: [6, 6, 6, 6, 6, 6, 6, 6] }],
        modifiers: { maximize: true },
      })
    })

    it("sends the game's own slot for none chosen, and no use the game doesn't take", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['attack', 'damage'])
      act(() => result.current.sendUse(fireball, cast))
      expect(fetch).not.toHaveBeenCalled()

      const { result: taking } = render(['use'])
      act(() => taking.current.sendUse(fireball, { ...cast, slot: undefined }))
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toMatchObject({
        kind: 'use',
        slot: null,
      })
    })
  })

  describe('area attacks', () => {
    const targets = [
      { combatId: 'cmbt1', combatantId: 'goblin' },
      { combatId: 'cmbt1', combatantId: 'ogre' },
    ]
    const targetNames = { goblin: 'Goblin', ogre: 'Ogre' }
    const breath: SheetRoll = {
      label: 'Dragon Breath attack',
      modifier: 5,
      source: { kind: 'attack', item: 'breath', activity: 'exhale', targets },
      targetNames,
    }
    const breathCheck = check({
      label: 'Dragon Breath attack',
      advantage: undefined,
      d20s: [12],
      extras: [],
    })

    it('makes area attacks only where the game makes them at those picked, from a device sending rolls', () => {
      const { result, rerender } = render(['attack', 'damage'])
      expect(result.current.areas).toBe(false)

      rerender({ kinds: ['attack', 'damage'], features: ['areaAttacks'] })
      expect(result.current.areas).toBe(true)
      rerender({ kinds: ['damage'], features: ['areaAttacks'] })
      expect(result.current.areas).toBe(false)

      rerender({ kinds: ['attack', 'damage'], features: ['areaAttacks'] })
      act(() => result.current.setSending(false))
      expect(result.current.areas).toBe(false)
    })

    it('sends an area attack at those picked, keeping their names, to show what came of it at each', async () => {
      const attack = {
        critical: false,
        fumble: false,
        outcome: null,
        targets: [
          { ...targets[0], outcome: 'hit' },
          { ...targets[1], outcome: 'miss' },
        ],
      }
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 17,
            attack,
            damage: preview(),
          }),
        )
      const { result } = render(['attack', 'damage'], ['areaAttacks'])

      act(() => result.current.send(breath, breathCheck))
      const sent = JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body))
      expect(sent).toMatchObject({
        kind: 'attack',
        item: 'breath',
        activity: 'exhale',
        targets,
      })
      expect(sent).not.toHaveProperty('target')
      expect(result.current.states.get('r1')).toEqual({
        status: 'sending',
        source: { item: 'breath', activity: 'exhale' },
        targetNames,
      })

      await advance(CHECK_EVERY)
      expect(result.current.states.get('r1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        targetNames,
        attack,
      })
      expect(
        result.current.dueFor({ item: 'breath', activity: 'exhale' }),
      ).toEqual({ use: 'req-1', damage: preview() })
    })

    it("keeps no combatants' names for a roll that isn't an attack", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render()

      act(() => result.current.send({ ...perception, targetNames }, check()))
      expect(result.current.states.get('r1')).toEqual({ status: 'sending' })
    })
  })

  describe('hit dice and formulas', () => {
    it('sends a hit die spent where the game takes them, and follows it until the game has made it', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 7,
          }),
        )
      const { result } = render(['hitDie', 'formula'])
      expect(result.current.takes('hitDie')).toBe(true)

      act(() => result.current.sendFormula(hitDie, spent()))
      expect(fetch).toHaveBeenCalledWith('/api/characters/char-1/rolls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'hitDie',
          denomination: 'd10',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 10, results: [6] }],
        }),
        signal: expect.any(AbortSignal),
      })
      expect(result.current.states.get('f1')).toEqual({ status: 'sending' })

      await advance(CHECK_EVERY)
      expect(result.current.states.get('f1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
        total: 9,
        healed: 7,
      })
      await advance(CHECK_EVERY * 3)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('sends hit dice spent at once to a game before module 0.20.0 a request a die, the largest first, each once the game has made the one before, keeping where they are as one', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'rolling' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-2',
            status: 'done',
            visible: true,
            total: 5,
            healed: 5,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-3' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-3',
            status: 'done',
            visible: true,
            total: 8,
            healed: 6,
          }),
        )
      const { result } = render(['hitDie'])
      const state = () => result.current.states.get('f1')

      act(() => result.current.sendFormula(hitDice, spentThree()))
      // The first die alone, as the game spends one a request.
      expect(posted()).toEqual([
        {
          kind: 'hitDie',
          denomination: 'd10',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 10, results: [6] }],
        },
      ])
      expect(state()).toEqual({
        status: 'sending',
        together: { count: 3, made: 0 },
      })

      // While the game makes it, the next waits, so that no more than one is on its way at once.
      await advance(CHECK_EVERY)
      expect(state()).toEqual({
        status: 'rolling',
        together: { count: 3, made: 0 },
      })
      expect(posted()).toHaveLength(1)

      await advance(CHECK_EVERY)
      expect(posted().map(({ dice }) => dice)).toEqual([
        [{ faces: 10, results: [6] }],
        [{ faces: 10, results: [2] }],
      ])
      expect(state()).toEqual({
        status: 'sending',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })

      await advance(CHECK_EVERY)
      expect(posted()).toHaveLength(3)
      // The d8 last, by its own size.
      expect(posted()[2]).toMatchObject({
        kind: 'hitDie',
        denomination: 'd8',
        dice: [{ faces: 8, results: [5] }],
      })

      // Once each is made, what they came to, and gave back, added up.
      await advance(CHECK_EVERY)
      expect(state()).toEqual({
        status: 'done',
        visible: true,
        total: 22,
        healed: 20,
        together: { count: 3, made: 3 },
      })
      await advance(CHECK_EVERY * 3)
      expect(fetch).toHaveBeenCalledTimes(7)
    })

    it("sends none after one the game didn't take or make, keeping how many it made, and why not the rest", async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(422, { reason: 'no-hit-dice' }))
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('f1')).toEqual({
        status: 'refused',
        reason: 'no-hit-dice',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })
      await advance(CHECK_EVERY * 3)
      expect(posted()).toHaveLength(2)
    })

    it('sends one the app turned away as one too many at once again a moment later, with the same dice, then the rest', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(429, { reason: 'busy' }))
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-2',
            status: 'done',
            visible: true,
            total: 5,
            healed: 5,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-3' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-3',
            status: 'done',
            visible: true,
            total: 8,
            healed: 6,
          }),
        )
      const { result } = render(['hitDie'])
      const state = () => result.current.states.get('f1')

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)
      // Turned away, the second is still on its way, rather than the rest given up on.
      expect(posted()).toHaveLength(2)
      expect(state()).toEqual({
        status: 'sending',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })

      await advance(BUSY_WAIT - 1)
      expect(posted()).toHaveLength(2)
      await advance(1)
      expect(posted().map(({ dice }) => dice)).toEqual([
        [{ faces: 10, results: [6] }],
        [{ faces: 10, results: [2] }],
        [{ faces: 10, results: [2] }],
      ])

      await advance(CHECK_EVERY * 2)
      expect(posted()).toHaveLength(4)
      expect(posted()[3].dice).toEqual([{ faces: 8, results: [5] }])
      expect(state()).toEqual({
        status: 'done',
        visible: true,
        total: 22,
        healed: 20,
        together: { count: 3, made: 3 },
      })
    })

    it('gives up on one the app turns away for over a minute, keeping how many it made, and why not the rest', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValue(respond(429, { reason: 'busy' }))
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY + BUSY_FOR - BUSY_WAIT)
      expect(result.current.states.get('f1')).toMatchObject({
        status: 'sending',
        together: { count: 3, made: 1 },
      })
      await advance(BUSY_WAIT)

      expect(result.current.states.get('f1')).toEqual({
        status: 'refused',
        reason: 'busy',
        visible: true,
        total: 9,
        healed: 9,
        together: { count: 3, made: 1 },
      })
      // The second, sent again every few seconds; the third never.
      const sent = posted()
      expect(sent.slice(1).every(({ dice }) => isSecond(dice))).toBe(true)
      expect(sent).toHaveLength(2 + BUSY_FOR / BUSY_WAIT)
      await advance(BUSY_WAIT * 3)
      expect(posted()).toHaveLength(sent.length)
    })

    it('sends none of the rest once the page is left, nor sends one turned away again', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'done', visible: true }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result, unmount } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)
      expect(posted()).toHaveLength(2)
      unmount()
      await advance(CHECK_EVERY * 5)

      // The second, on its way, isn't asked after; the third isn't sent.
      expect(fetch).toHaveBeenCalledTimes(3)

      // Nor is one turned away sent again.
      jest
        .mocked(fetch)
        .mockClear()
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'done', visible: true }),
        )
        .mockResolvedValueOnce(respond(429, { reason: 'busy' }))
      const again = render(['hitDie'])
      act(() => again.result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)
      again.unmount()
      await advance(BUSY_WAIT * 2)
      expect(posted()).toHaveLength(2)
    })

    it('says no total or hit points given back where the game made any of them blind', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 9,
            healed: 9,
          }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-2', status: 'done', visible: false }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-3' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-3',
            status: 'done',
            visible: true,
            total: 8,
            healed: 6,
          }),
        )
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY * 3)

      expect(result.current.states.get('f1')).toEqual({
        status: 'done',
        visible: false,
        together: { count: 3, made: 3 },
      })
    })

    it('keeps that the game made none of them, where it made the first not', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'failed', reason: 'gone' }),
        )
      const { result } = render(['hitDie'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('f1')).toEqual({
        status: 'failed',
        reason: 'gone',
        together: { count: 3, made: 0 },
      })
      await advance(CHECK_EVERY * 3)
      expect(posted()).toHaveLength(1)
    })

    it('sends hit dice spent at once as one request, from module 0.20.0, and follows it until the game has spent them all', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(respond(200, { id: 'req-1', status: 'rolling' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'done',
            visible: true,
            total: 22,
            healed: 20,
            spent: { count: 3, made: 3 },
          }),
        )
      const { result } = render(['hitDie', 'hitDice'])
      const state = () => result.current.states.get('f1')

      act(() => result.current.sendFormula(hitDice, spentThree()))
      expect(posted()).toEqual([hitDiceRequest])
      // As one, not a die at a time, which the game refuses for want of dice as one too.
      expect(state()).toEqual({ status: 'sending', hitDice: true })
      await advance(CHECK_EVERY)
      expect(state()).toEqual({
        id: 'req-1',
        status: 'rolling',
        requestId: 'req-1',
        hitDice: true,
      })

      await advance(CHECK_EVERY)
      expect(state()).toEqual({
        id: 'req-1',
        status: 'done',
        requestId: 'req-1',
        hitDice: true,
        visible: true,
        total: 22,
        healed: 20,
        spent: { count: 3, made: 3 },
      })
      await advance(CHECK_EVERY * 3)
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('sends one hit die alone as a hit die, where the game takes several at once too', () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['hitDie', 'hitDice'])

      act(() => result.current.sendFormula(hitDie, spent()))

      expect(posted()).toEqual([
        {
          kind: 'hitDie',
          denomination: 'd10',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 10, results: [6] }],
        },
      ])
    })

    it('keeps how many of the hit dice sent as one the game made, where it stopped part way, and why not the rest', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'failed',
            reason: 'full-hp',
            visible: true,
            total: 9,
            healed: 9,
            spent: { count: 3, made: 1 },
          }),
        )
      const { result } = render(['hitDie', 'hitDice'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY)

      expect(result.current.states.get('f1')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'full-hp',
        requestId: 'req-1',
        hitDice: true,
        visible: true,
        total: 9,
        healed: 9,
        spent: { count: 3, made: 1 },
        together: { count: 3, made: 1 },
      })
      await advance(CHECK_EVERY * 3)
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('keeps asking after hit dice sent as one that took the game too long, until it says how many it made', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'failed', reason: 'timeout' }),
        )
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'failed', reason: 'timeout' }),
        )
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-1',
            status: 'failed',
            reason: 'timeout',
            visible: false,
            spent: { count: 3, made: 1 },
          }),
        )
      const { result } = render(['hitDie', 'hitDice'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(CHECK_EVERY * 2)
      // The game may yet say it made some.
      expect(result.current.states.get('f1')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'timeout',
        requestId: 'req-1',
        hitDice: true,
      })

      await advance(CHECK_EVERY)
      expect(result.current.states.get('f1')).toEqual({
        id: 'req-1',
        status: 'failed',
        reason: 'timeout',
        requestId: 'req-1',
        hitDice: true,
        visible: false,
        spent: { count: 3, made: 1 },
        together: { count: 3, made: 1 },
      })
      // Settled, once it says.
      await advance(CHECK_EVERY * 5)
      expect(fetch).toHaveBeenCalledTimes(4)
    })

    it('keeps that hit dice refused for want of dice were sent as one, which wants fewer, not none of a size', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(422, { reason: 'no-hit-dice' }))
      const { result } = render(['hitDie', 'hitDice'])

      act(() => result.current.sendFormula(hitDice, spentThree()))
      await advance(0)

      expect(result.current.states.get('f1')).toEqual({
        status: 'refused',
        reason: 'no-hit-dice',
        hitDice: true,
      })
    })

    it("sends an activity's own formula where the game takes it", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-2' }))
      const { result } = render(['formula'])

      act(() => result.current.sendFormula(lantern, shone))
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.lastCall?.[1]?.body)),
      ).toEqual(
        toFormulaRequest(
          lantern,
          { kind: 'formula', item: 'lantern', activity: 'shine' },
          shone,
        ),
      )
      expect(result.current.states.get('f2')).toEqual({ status: 'sending' })
    })

    it.each<[string, RollKind[], SheetFormulaRoll]>([
      ['a hit die where the game takes only formulas', ['formula'], hitDie],
      [
        'hit dice spent at once where the game takes only formulas',
        ['formula'],
        hitDice,
      ],
      [
        'a hit die alone where the game takes only several at once',
        ['formula', 'hitDice'],
        hitDie,
      ],
      ['a formula where the game takes only hit dice', ['hitDie'], lantern],
      [
        'a formula the game cannot make',
        ['hitDie', 'formula'],
        { ...lantern, source: undefined },
      ],
    ])("doesn't send %s", (_name, kinds, roll) => {
      const { result } = render(kinds)

      act(() => result.current.sendFormula(roll, spent()))

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })

    it("doesn't send a hit die, hit dice or a formula from a device the player turned sending off on", () => {
      const { result } = render(['hitDie', 'hitDice', 'formula'])

      act(() => result.current.setSending(false))
      act(() => result.current.sendFormula(hitDie, spent()))
      act(() => result.current.sendFormula(hitDice, spentThree()))
      act(() => result.current.sendFormula(lantern, shone))

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })
  })

  describe('saves the game asked for', () => {
    /** A Dexterity saving throw answering the game's prompt. */
    const answer: SheetRoll = {
      label: 'Dexterity saving throw',
      modifier: 1,
      source: { kind: 'save', key: 'dex', prompt: 'msg1-thorin' },
    }

    it("sends a save answering the game's prompt, and says it's answering it until it fails", async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'failed', reason: 'cancelled' }),
        )
        .mockResolvedValueOnce(respond(202, { id: 'req-2' }))
        .mockResolvedValueOnce(
          respond(200, {
            id: 'req-2',
            status: 'done',
            visible: true,
            total: 16,
            outcome: 'success',
          }),
        )
      const { result } = render(['save'], ['prompts'])

      act(() => result.current.send(answer, check({ advantage: undefined })))
      expect(
        JSON.parse(String(jest.mocked(fetch).mock.calls[0][1]?.body)),
      ).toMatchObject({ kind: 'save', key: 'dex', prompt: 'msg1-thorin' })
      expect(result.current.answering).toEqual(new Set(['msg1-thorin']))

      // One that failed may be answered again.
      await advance(CHECK_EVERY)
      expect(result.current.answering).toEqual(new Set())

      act(() =>
        result.current.send(answer, check({ id: 'r2', advantage: undefined })),
      )
      await advance(CHECK_EVERY)
      expect(result.current.states.get('r2')).toMatchObject({
        status: 'done',
        total: 16,
        outcome: 'success',
        prompt: 'msg1-thorin',
      })
      expect(result.current.answering).toEqual(new Set(['msg1-thorin']))
    })
  })

  describe('what Midi-QOL asked for, from module 0.27.0', () => {
    it.each([
      ['skill', 'ath', 'adv', 1, [4, 17]],
      ['ability', 'str', undefined, 0, [9]],
      ['save', 'wis', 'dis', -1, [15, 2]],
    ] as const)(
      'sends a %s answering it, rolled as Midi-QOL has it, with as many d20s, and says it answers it',
      (kind, key, advantage, mode, d20s) => {
        jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        const { result } = render([kind], ['prompts'])

        act(() =>
          result.current.send(
            {
              label: 'Answering Midi-QOL',
              modifier: 3,
              advantage,
              source: { kind, key, prompt: 'k3y-thorin' },
              explicit: false,
            },
            check({ advantage, d20s: [...d20s], extras: [] }),
          ),
        )

        expect(sent()).toEqual({
          kind,
          key,
          prompt: 'k3y-thorin',
          mode,
          explicit: false,
          extras: [],
          dice: [{ faces: 20, results: d20s }],
        })
        expect(result.current.answering).toEqual(new Set(['k3y-thorin']))
      },
    )
  })

  describe('checks activities ask for, from module 0.21.0', () => {
    it.each([
      ['skill', 'slt'],
      ['tool', 'thief'],
      ['ability', 'dex'],
    ] as const)(
      "sends a %s check an activity asks for, the player's own, by its item and activity, where the game makes it so",
      (kind, key) => {
        jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        const { result } = render([kind], ['activityChecks'])

        act(() =>
          result.current.send(
            lock(kind, key),
            check({ advantage: undefined, d20s: [9], extras: [] }),
          ),
        )

        expect(sent()).toEqual({
          kind,
          key,
          item: 'tools',
          activity: 'pick',
          mode: 0,
          explicit: false,
          extras: [],
          dice: [{ faces: 20, results: [9] }],
        })
        expect(result.current.states.get('r1')?.status).toBe('sending')
      },
    )

    it("keeps one the player's alone where the game doesn't make it against the activity, or take the kind", () => {
      const { result, rerender } = render(['tool'], ['modifiers'])

      act(() =>
        result.current.send(
          lock('tool', 'thief'),
          check({ advantage: undefined, d20s: [9], extras: [] }),
        ),
      )
      rerender({ kinds: ['skill'], features: ['activityChecks'] })
      act(() =>
        result.current.send(
          lock('tool', 'thief'),
          check({ advantage: undefined, d20s: [9], extras: [] }),
        ),
      )

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })

    it('still sends a plain check, which names no activity, without the feature', () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['tool'])

      act(() =>
        result.current.send(
          { ...lock('tool', 'thief'), source: { kind: 'tool', key: 'thief' } },
          check({ advantage: undefined, d20s: [9], extras: [] }),
        ),
      )

      expect(sent()).toEqual(
        expect.not.objectContaining({ item: expect.anything() }),
      )
      expect(sent()).toMatchObject({ kind: 'tool', key: 'thief' })
    })
  })

  describe('links in descriptions', () => {
    const HASH = '0f1a2b3c4d5e6f'

    it("sends a saving throw a description calls for, the player's own, by its link", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['save'])

      act(() =>
        result.current.send(
          {
            label: 'Dexterity saving throw',
            modifier: 1,
            source: { kind: 'save', key: 'dex', text: HASH, link: 3 },
            dc: 15,
          },
          check({ advantage: undefined, d20s: [11], extras: [] }),
        ),
      )

      expect(sent()).toEqual({
        kind: 'save',
        key: 'dex',
        text: HASH,
        link: 3,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 20, results: [11] }],
      })
    })

    it.each([
      ['skill', 'ath'],
      ['tool', 'thief'],
      ['ability', 'int'],
    ] as const)(
      "sends a %s check a description calls for, the player's own, by its link",
      (kind, key) => {
        jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        const { result } = render([kind])

        act(() =>
          result.current.send(
            {
              label: 'A check',
              modifier: 1,
              source: { kind, key, text: HASH, link: 4 },
              dc: 15,
            },
            check({ advantage: 'adv', d20s: [11, 17], extras: [] }),
          ),
        )

        expect(sent()).toEqual({
          kind,
          key,
          text: HASH,
          link: 4,
          mode: 1,
          explicit: false,
          extras: [],
          dice: [{ faces: 20, results: [11, 17] }],
        })
      },
    )

    it("sends a description's damage by its link, with the dice thrown and the kinds chosen, where the game takes it", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['textDamage'])
      const roll: SheetDamageRoll = {
        label: 'Flame damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 1, sides: 8 },
              { sign: 1, flat: 4 },
            ],
            type: 'slashing',
          },
          { terms: [{ sign: 1, count: 1, sides: 6 }], type: 'fire' },
        ],
        text: { text: HASH, link: 1 },
        types: [null, 'fire'],
      }

      act(() => result.current.sendDamage(roll, thrownDamage()))

      expect(sent()).toEqual({
        kind: 'textDamage',
        text: HASH,
        link: 1,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 8, results: [5] },
          { faces: 6, results: [6] },
        ],
        types: [null, 'fire'],
      })
      expect(result.current.states.get('r2')).toEqual({ status: 'sending' })

      // With no choice to make, no kinds.
      act(() =>
        result.current.sendDamage(
          { ...roll, types: undefined },
          thrownDamage({ id: 'r3' }),
        ),
      )
      expect(sent()).not.toHaveProperty('types')
    })

    it("sends a description's critical hit, as the world's rules made it, and its damage changed, as the player chose", () => {
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
      const { result } = render(['textDamage'], ['modifiers'])
      const roll: SheetDamageRoll = {
        label: 'Flame damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 2, sides: 8 },
              { sign: 1, flat: 4 },
            ],
            type: 'slashing',
          },
          { terms: [{ sign: 1, count: 2, sides: 6 }], type: 'fire' },
        ],
        text: { text: HASH, link: 1 },
        critical: true,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: false,
        },
        criticalAdds: { dice: [0, 0], damage: [[], []] },
        modifiers: { extra: 0, maximize: true },
      }
      const thrown = thrownDamage({
        critical: true,
        maximized: true,
        parts: [
          {
            type: 'slashing',
            total: 20,
            terms: [
              { text: '2d8', values: [8, 8], value: 16 },
              { text: '+4', values: [], value: 4 },
            ],
          },
          {
            type: 'fire',
            total: 12,
            terms: [{ text: '+2d6', values: [6, 6], value: 12 }],
          },
        ],
      })

      act(() => result.current.sendDamage(roll, thrown))

      expect(sent()).toEqual({
        kind: 'textDamage',
        text: HASH,
        link: 1,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [
          { faces: 8, results: [8, 8] },
          { faces: 6, results: [6, 6] },
        ],
        critical: true,
        modifiers: { extra: 0, maximize: true },
      })

      // Unchanged after all, it says nothing of them.
      act(() =>
        result.current.sendDamage(
          { ...roll, critical: false, modifiers: { extra: 0 } },
          thrownDamage({ id: 'r3' }),
        ),
      )
      expect(sent()).not.toHaveProperty('critical')
      expect(sent()).not.toHaveProperty('modifiers')
    })

    it("sends what a critical hit adds to a description's damage as thrown: each part's own dice, then its critical damage's", () => {
      jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
      const { result } = render(['textDamage'], ['modifiers'])
      // As thrown: a greataxe's 3d12 + 4 with Savage Attacks' die, and the weapon's 1d6.
      const roll: SheetDamageRoll = {
        label: 'Greataxe damage',
        parts: [
          {
            terms: [
              { sign: 1, count: 3, sides: 12 },
              { sign: 1, flat: 4 },
              { sign: 1, count: 1, sides: 6, added: true },
            ],
            type: 'slashing',
          },
        ],
        text: { text: HASH, link: 0 },
        critical: true,
        criticalRule: {
          perDie: 2,
          multiplyNumeric: false,
          powerfulCritical: false,
          altered: false,
          bonusDice: 'rolled',
        },
        criticalAdds: {
          dice: [1],
          damage: [[{ sign: 1, count: 1, sides: 6 }]],
        },
      }
      const thrown = thrownDamage({
        critical: true,
        parts: [
          {
            type: 'slashing',
            total: 26,
            terms: [
              { text: '3d12', values: [5, 7, 9], value: 21 },
              { text: '+4', values: [], value: 4 },
              { text: '+1d6', values: [1], value: 1 },
            ],
          },
        ],
      })

      act(() => result.current.sendDamage(roll, thrown))

      expect(sent()).toMatchObject({
        kind: 'textDamage',
        link: 0,
        critical: true,
        dice: [
          { faces: 12, results: [5, 7, 9] },
          { faces: 6, results: [1] },
        ],
      })

      // Not offered as one, as without what it adds, it's the player's alone.
      jest.mocked(fetch).mockClear()
      act(() =>
        result.current.sendDamage(
          { ...roll, criticalAdds: undefined },
          thrownDamage({ id: 'r3', critical: true }),
        ),
      )
      expect(fetch).not.toHaveBeenCalled()
    })

    it("keeps a description's critical hit with its dice doubled here, rather than as the game makes one, from the game", () => {
      const { result } = render(['textDamage'], ['modifiers'])

      act(() =>
        result.current.sendDamage(
          {
            label: 'Flame damage',
            parts: [{ terms: [{ sign: 1, count: 1, sides: 8 }], type: null }],
            text: { text: HASH, link: 1 },
            critical: true,
          },
          thrownDamage({ critical: true }),
        ),
      )

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })

    it("says whether the game takes a description's damage changed, as it takes an attack's", () => {
      const { result, rerender } = render(['textDamage'])
      expect(result.current.modifiesText).toBe(false)
      rerender({ kinds: ['textDamage'], features: ['modifiers'] })
      expect(result.current.modifiesText).toBe(true)
      // An attack's damage it takes changed is not a description's.
      expect(result.current.modifies).toBe(false)
      rerender({ kinds: ['damage'], features: ['modifiers'] })
      expect(result.current.modifiesText).toBe(false)
      rerender({ kinds: ['textDamage'], features: ['modifiers'] })
      act(() => result.current.setSending(false))
      expect(result.current.modifiesText).toBe(false)
    })

    it("says whether the game changes a description's damage only on a die it adds, from module 0.21.0", () => {
      const { result, rerender } = render(['textDamage'], ['modifiers'])
      expect(result.current.signsText).toBe(false)
      rerender({ kinds: ['textDamage'], features: ['modifiers', 'signedDice'] })
      expect(result.current.signsText).toBe(true)
      rerender({ kinds: ['textDamage'], features: ['signedDice'] })
      expect(result.current.signsText).toBe(true)
      rerender({ kinds: ['textDamage'], features: ['modifiers'] })
      expect(result.current.signsText).toBe(false)
    })

    it("sends a description's own roll by its link, where the game takes it", () => {
      jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
      const { result } = render(['textRoll'])

      act(() =>
        result.current.sendFormula(
          {
            label: 'Luckstone roll',
            terms: [{ sign: 1, count: 1, sides: 4 }],
            source: { kind: 'textRoll', text: HASH, link: 2 },
          },
          spent({ id: 'f3', terms: [{ text: '1d4', values: [3], value: 3 }] }),
        ),
      )

      expect(sent()).toEqual({
        kind: 'textRoll',
        text: HASH,
        link: 2,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [{ faces: 4, results: [3] }],
      })
    })

    it('asks the table for a saving throw, by its link, with no dice, and follows it until it is posted', async () => {
      jest
        .mocked(fetch)
        .mockResolvedValueOnce(respond(202, { id: 'req-1' }))
        .mockResolvedValueOnce(
          respond(200, { id: 'req-1', status: 'done', visible: true }),
        )
      const { result } = render(['ask'])
      const asked: LocalAsk = {
        kind: 'ask',
        id: 'a1',
        label: 'DC 15 Dexterity saving throw',
        at: 0,
      }

      act(() => result.current.sendAsk(asked, { text: HASH, link: 3 }))

      expect(sent()).toEqual({
        kind: 'ask',
        text: HASH,
        link: 3,
        mode: 0,
        explicit: false,
        extras: [],
        dice: [],
      })
      await advance(CHECK_EVERY)
      expect(result.current.states.get('a1')).toMatchObject({
        status: 'done',
        requestId: 'req-1',
      })
    })

    it("sends none of them where the game doesn't take them, or from a device that doesn't send", () => {
      const { result, rerender } = render(['save', 'damage', 'formula'])
      const asked: LocalAsk = { kind: 'ask', id: 'a1', label: 'Ask', at: 0 }

      act(() => {
        result.current.sendAsk(asked, { text: HASH, link: 0 })
        result.current.sendDamage(
          {
            label: 'Flame damage',
            parts: [],
            text: { text: HASH, link: 1 },
            // As though it followed a use, which a description's damage never does.
            use: 'req-9',
          },
          thrownDamage(),
        )
        result.current.sendFormula(
          {
            label: 'Luckstone roll',
            terms: [],
            source: { kind: 'textRoll', text: HASH, link: 2 },
          },
          spent(),
        )
      })
      rerender({ kinds: ['ask', 'textDamage', 'textRoll'], features: [] })
      act(() => result.current.setSending(false))
      act(() => result.current.sendAsk(asked, { text: HASH, link: 0 }))

      expect(fetch).not.toHaveBeenCalled()
      expect(result.current.states.size).toBe(0)
    })
  })

  it('stops following its rolls once gone', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(respond(202, { id: 'req-1' }))
    const { result, unmount } = render()

    act(() => result.current.send(perception, check()))
    await advance(0)
    const { signal } = jest.mocked(fetch).mock.calls[0][1] as RequestInit
    unmount()

    expect(signal?.aborted).toBe(true)
    await advance(CHECK_EVERY * 3)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

/** A roll as the game is asked to make it, with more said of it. */
const toRollRequestWith = (roll: SheetRoll, fields: object) => ({
  ...toRollRequest(roll, roll.source as RollSource, check()),
  ...fields,
})

describe("hooks/use-table-rolls, the Gamemaster's seat (#156)", () => {
  const seat = {
    role: 'gm' as const,
    api: '/api/campaigns/c1/characters/thorin',
    key: 'gm:c1:thorin',
  }
  const renderGm = () =>
    renderHook(() => useTableRolls(seat.key, ['skill', 'save'], []), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <TableApiContext value={seat}>{children}</TableApiContext>
      ),
    })

  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("sends the Gamemaster's rolls through their seat's own API, and follows them there", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-gm' }))
      .mockResolvedValueOnce(
        respond(200, {
          id: 'req-gm',
          status: 'done',
          visible: true,
          total: 23,
        }),
      )
    const { result } = renderGm()

    act(() => result.current.send(perception, check()))
    expect(fetch).toHaveBeenCalledWith(
      '/api/campaigns/c1/characters/thorin/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    await advance(CHECK_EVERY)
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/campaigns/c1/characters/thorin/rolls/req-gm',
      { cache: 'no-store', signal: expect.any(AbortSignal) },
    )
  })

  it("says what the Gamemaster's page calls each roll, for its player to be shown it by, as the player's page never does", () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-gm' }))
    const sent = () =>
      JSON.parse(String(jest.mocked(fetch).mock.calls.at(-1)?.[1]?.body))
    const { result } = renderGm()

    act(() => result.current.send(perception, check()))
    expect(sent()).toEqual(
      toRollRequestWith(perception, { label: 'Perception check' }),
    )

    // Cut to as long a name as the app keeps, never splitting a character.
    const long = `${'x'.repeat(119)}🐉 attack`
    act(() =>
      result.current.send({ ...perception, label: long }, check({ id: 'r2' })),
    )
    expect(sent().label).toBe('x'.repeat(119))
    act(() =>
      result.current.send({ ...perception, label: '  ' }, check({ id: 'r3' })),
    )
    expect(sent()).not.toHaveProperty('label')

    const player = render()
    act(() => player.result.current.send(perception, check({ id: 'r4' })))
    expect(sent()).not.toHaveProperty('label')
  })

  it("keeps the Gamemaster's send switch apart from the player's, on the same device", () => {
    expect(GM_SEND_KEY).toBe('sending-stone:send-rolls:gm')
    const { result } = renderGm()

    act(() => result.current.setSending(false))
    expect(globalThis.localStorage.getItem(GM_SEND_KEY)).toBe('off')
    expect(globalThis.localStorage.getItem(SEND_KEY)).toBeNull()

    const player = render()
    expect(player.result.current.sending).toBe(true)
    act(() => player.result.current.setSending(false))
    expect(globalThis.localStorage.getItem(SEND_KEY)).toBe('off')
    act(() => result.current.setSending(true))
    expect(globalThis.localStorage.getItem(GM_SEND_KEY)).toBe('on')
    expect(globalThis.localStorage.getItem(SEND_KEY)).toBe('off')
  })
})

const used = (fields: Partial<LocalUse> = {}): LocalUse => ({
  kind: 'use',
  id: 'u1',
  label: 'Sorcery Points',
  spell: false,
  at: 0,
  ...fields,
})

describe('hooks/use-table-rolls for concentration, charges and Heroic Inspiration, from module 0.29.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const plain = { mode: 0, explicit: false, extras: [], dice: [] }

  it('sends each, as it is, and follows it until it is made', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
    const { result } = render(['endConcentration', 'spend', 'inspiration'])

    act(() => result.current.sendEndConcentration(used(), 'concBless0001'))
    expect(sent()).toEqual({
      kind: 'endConcentration',
      concentration: { effect: 'concBless0001' },
      ...plain,
    })
    act(() =>
      result.current.sendSpend(used({ id: 'u2' }), {
        counter: { resource: 'primary' },
        count: 3,
      }),
    )
    expect(sent()).toEqual({
      kind: 'spend',
      counter: { resource: 'primary' },
      count: 3,
      ...plain,
    })
    act(() => result.current.sendInspiration(used({ id: 'u3' }), 'gain'))
    expect(sent()).toEqual({
      kind: 'inspiration',
      inspiration: 'gain',
      ...plain,
    })
    for (const id of ['u1', 'u2', 'u3']) {
      expect(result.current.states.get(id)).toMatchObject({ status: 'sending' })
    }
    jest
      .mocked(fetch)
      .mockResolvedValue(
        respond(200, { id: 'req-1', status: 'done', visible: true, rolls: [] }),
      )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('u2')).toMatchObject({ status: 'done' })
  })

  it("sends none of them where the game doesn't take them, or from a device that doesn't send", () => {
    const { result, rerender } = render(['use', 'endEnchantment'])

    const sendAll = () =>
      act(() => {
        result.current.sendEndConcentration(used(), 'concBless0001')
        result.current.sendSpend(used(), { counter: { item: 'a' }, count: 1 })
        result.current.sendInspiration(used(), 'use')
      })
    sendAll()
    rerender({
      kinds: ['endConcentration', 'spend', 'inspiration'],
      features: [],
    })
    expect(result.current.takes('spend')).toBe(true)
    act(() => result.current.setSending(false))
    expect(result.current.takes('spend')).toBe(false)
    sendAll()

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.states.size).toBe(0)
  })
})

describe('hooks/use-table-rolls, moving items and coins, from module 0.31.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const gift = used({
    id: 'u-move',
    label: '5 gp',
    move: { verb: 'give', things: '5 gp', other: 'Vex' },
  })
  const transfer = { from: 'thorin', to: 'vex', currency: { gp: 5 } }

  it("sends a move as it is, whatever rolls the game takes or this device's switch says, and keeps what moved", async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
    const { result } = render([])
    act(() => result.current.setSending(false))

    act(() => result.current.sendTransfer(gift, transfer))
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sent()).toEqual({
      kind: 'transfer',
      transfer,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    expect(result.current.states.get('u-move')).toEqual({
      status: 'sending',
      move: gift.move,
    })
    const moved = {
      from: 'thorin',
      to: 'vex',
      items: [],
      currency: { gp: 5 },
    }
    jest.mocked(fetch).mockResolvedValue(
      respond(200, {
        id: 'req-move',
        status: 'done',
        visible: true,
        rolls: [],
        transfer: moved,
      }),
    )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('u-move')).toMatchObject({
      status: 'done',
      transfer: moved,
      move: gift.move,
    })
  })

  it('sends nothing for a use that is no move', () => {
    const { result } = render([])
    act(() => result.current.sendTransfer(used(), transfer))
    expect(fetch).not.toHaveBeenCalled()
  })

  it("says what the Gamemaster's page calls it, for the character's player to be shown it by", () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-move' }))
    const seat = {
      role: 'gm' as const,
      api: '/api/campaigns/c1/characters/thorin',
      key: 'gm:c1:thorin',
    }
    const { result } = renderHook(() => useTableRolls(seat.key, [], []), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <TableApiContext value={seat}>{children}</TableApiContext>
      ),
    })

    act(() =>
      result.current.sendTransfer(
        { ...gift, move: { ...gift.move!, mover: 'Thorin' } },
        transfer,
      ),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/campaigns/c1/characters/thorin/rolls',
      expect.anything(),
    )
    expect(sent()).toMatchObject({
      kind: 'transfer',
      label: 'Give 5 gp to Vex',
    })
  })
})

describe('hooks/use-table-rolls, favorites added and removed, from module 0.37.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const added = used({ id: 'u-favorite', label: 'Rope', favorite: 'add' })
  const favorite = { op: 'add' as const, type: 'item' as const, id: 'rope' }

  it("sends a favorite as it is, whatever rolls the game takes or this device's switch says, and keeps what the game says of it", async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-favorite' }))
    const { result } = render([])
    act(() => result.current.setSending(false))

    act(() => result.current.sendFavorite(added, favorite))
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sent()).toEqual({
      kind: 'favorite',
      favorite,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    expect(result.current.states.get('u-favorite')).toEqual({
      status: 'sending',
      favorite: 'add',
    })
    jest.mocked(fetch).mockResolvedValue(
      respond(200, {
        id: 'req-favorite',
        status: 'done',
        visible: true,
        rolls: [],
        favorited: true,
      }),
    )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('u-favorite')).toMatchObject({
      status: 'done',
      favorited: true,
      favorite: 'add',
    })
  })

  it('sends nothing for a use that is no favorite', () => {
    const { result } = render([])
    act(() => result.current.sendFavorite(used(), favorite))
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('hooks/use-table-rolls, a player’s own effects, from module 0.39.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const turnedOff = used({ id: 'u-effect', label: 'Bless', effect: 'disable' })
  const bless = { id: 'blessed', name: 'Bless' }

  it("sends a change of an effect as it is, named, whatever rolls the game takes or this device's switch says, and keeps what the game made of it apart from what was asked", async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-effect' }))
    const { result } = render([])
    act(() => result.current.setSending(false))
    act(() => result.current.sendEffect(turnedOff, bless))
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sent()).toEqual({
      kind: 'effect',
      effect: { op: 'disable', id: 'blessed' },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      label: 'Bless',
    })
    expect(result.current.states.get('u-effect')).toEqual({
      status: 'sending',
      effect: 'disable',
    })
    jest.mocked(fetch).mockResolvedValue(
      respond(200, {
        id: 'req-effect',
        status: 'done',
        visible: true,
        rolls: [],
        effect: { id: 'blessed', disabled: true, deleted: false },
      }),
    )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('u-effect')).toMatchObject({
      status: 'done',
      effect: 'disable',
      changed: { id: 'blessed', disabled: true, deleted: false },
    })
  })

  it('names it within the longest label the app takes', () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-effect' }))
    const { result } = render([])
    const long = 'Blessing of the Raven Queen '.repeat(10)
    act(() =>
      result.current.sendEffect(
        used({ id: 'u-long', label: long, effect: 'delete' }),
        { id: 'raven', name: long },
      ),
    )
    const { label } = sent() as { label: string }
    expect(label.length).toBeLessThanOrEqual(MAX_ROLL_LABEL)
    expect(long.startsWith(label)).toBe(true)
  })

  it('sends nothing for a use that changes no effect', () => {
    const { result } = render([])
    act(() => result.current.sendEffect(used(), bless))
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('hooks/use-table-rolls, dice typed in, from module 0.32.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('says a d20 roll was typed in, where it was, and only then', () => {
    const source = { kind: 'skill', key: 'prc' } as const
    expect(
      toRollRequest(perception, source, check({ typed: true })),
    ).toMatchObject({ typed: true })
    expect(toRollRequest(perception, source, check())).not.toHaveProperty(
      'typed',
    )
  })

  it("says a formula's, hit dice's and each hit die's dice were typed in, where they were, and only then", () => {
    const source = hitDice.source as Extract<FormulaSource, { kind: 'hitDice' }>
    const typed: LocalFormula = { ...spentThree(), typed: true }
    expect(toHitDiceRequest(source, typed)).toMatchObject({ typed: true })
    expect(toHitDiceRequest(source, spentThree())).not.toHaveProperty('typed')
    const each = toHitDieRequests(source, typed)
    expect(each).toHaveLength(3)
    for (const request of each) expect(request).toMatchObject({ typed: true })
    for (const request of toHitDieRequests(source, spentThree())) {
      expect(request).not.toHaveProperty('typed')
    }
    const formula = {
      kind: 'formula',
      item: 'lantern',
      activity: 'shine',
    } as const
    expect(
      toFormulaRequest(lantern, formula, { ...shone, typed: true }),
    ).toMatchObject({ typed: true })
    expect(toFormulaRequest(lantern, formula, shone)).not.toHaveProperty(
      'typed',
    )
  })

  it("says an attack's damage and a description's were typed in, where they were, and only then", () => {
    const { result } = render(['damage', 'textDamage'])
    const due = { use: 'req-1', damage: preview() }
    const described: SheetDamageRoll = {
      label: 'Flame damage',
      parts: [{ terms: [{ sign: 1, count: 1, sides: 8 }], type: 'fire' }],
      text: { text: 'a'.repeat(16), link: 1 },
    }

    act(() =>
      result.current.sendDamage(
        damageRollOf('Longsword', due),
        thrownDamage({ typed: true }),
      ),
    )
    expect(sent()).toMatchObject({ kind: 'damage', typed: true })
    act(() =>
      result.current.sendDamage(damageRollOf('Longsword', due), thrownDamage()),
    )
    expect(sent()).not.toHaveProperty('typed')
    act(() =>
      result.current.sendDamage(described, {
        ...thrownDamage({ typed: true }),
        id: 'r3',
        parts: [
          {
            type: 'fire',
            total: 5,
            terms: [{ text: '1d8', values: [5], value: 5 }],
          },
        ],
      }),
    )
    expect(sent()).toMatchObject({ kind: 'textDamage', typed: true })
    act(() =>
      result.current.sendDamage(described, {
        ...thrownDamage(),
        id: 'r4',
        parts: [
          {
            type: 'fire',
            total: 5,
            terms: [{ text: '1d8', values: [5], value: 5 }],
          },
        ],
      }),
    )
    expect(sent()).toMatchObject({ kind: 'textDamage' })
    expect(sent()).not.toHaveProperty('typed')
  })

  it("leaves a use's damage for its player to roll once offered, once, as one with a choice of kinds", () => {
    const { result } = render(['use', 'damage'])
    const used: LocalUse = {
      kind: 'use',
      id: 'u1',
      label: 'Fireball',
      spell: true,
      at: 0,
    }
    const made = {
      status: 'done' as const,
      requestId: 'req-1',
      damage: preview(),
    }

    expect(damageDue(used, made)).toBe(false)
    expect(needsPlayer(used, made)).toBe(false)
    expect(damageDue(used, { ...made, offer: true })).toBe(true)
    expect(needsPlayer(used, { ...made, offer: true })).toBe(true)
    expect(damageDue(used, { ...made, offer: true, damaged: true })).toBe(false)

    // The state it marks: none for a roll it doesn't follow.
    act(() => result.current.offerDamage('u1'))
    expect(result.current.states.size).toBe(0)
  })
})

/** The wolf's Bite, 1d8 + 3, as thrown. */
const bitten = (fields: Partial<LocalDamage> = {}): LocalDamage => ({
  kind: 'damage',
  id: 'b1',
  label: 'Bite damage',
  total: 8,
  critical: false,
  healing: false,
  parts: [
    {
      type: 'Slashing',
      total: 8,
      terms: [
        { text: '1d8', values: [5], value: 5 },
        { text: '+3', values: [], value: 3 },
      ],
    },
  ],
  at: 0,
  ...fields,
})

const recharged = (fields: Partial<LocalFormula> = {}): LocalFormula => ({
  kind: 'formula',
  id: 'f9',
  label: 'Frost Breath recharge',
  total: 5,
  healing: false,
  terms: [{ text: '1d6', values: [5], value: 5 }],
  at: 0,
  ...fields,
})

/** A roll the Gamemaster made as the character, of this kind, made. */
const gmView = (id: string, kind: RollKind): GmRollView => ({
  id,
  kind,
  status: 'done',
  visible: true,
  label: id,
  at: '2026-10-23T12:00:00.000Z',
})

describe('hooks/use-table-rolls, damage on its own and recharges, from module 0.36.0', () => {
  const bite = {
    item: 'wolfBite',
    activity: 'biteAttack',
    plan: mockTableDamage(),
  }
  const alone = () => aloneRollOf('Bite', bite) as SheetDamageRoll
  const breath = {
    label: 'Frost Breath recharge',
    counter: { item: 'frostBreath' },
  }

  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-9' }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends damage on its own only with Send to the table on, the switch on, and the game taking it', () => {
    const { result, rerender } = render(['damage', 'itemDamage'])
    // Off until the player turns it on.
    expect(result.current).toMatchObject({
      sendsAlone: false,
      aloneOffered: true,
      aloneOn: false,
    })

    act(() => result.current.setAlone(true))
    expect(result.current).toMatchObject({ sendsAlone: true, aloneOn: true })

    act(() => result.current.setSending(false))
    expect(result.current).toMatchObject({ sendsAlone: false, aloneOn: true })
    act(() => result.current.setSending(true))
    expect(result.current.sendsAlone).toBe(true)

    rerender({ kinds: ['damage'], features: [] })
    expect(result.current).toMatchObject({
      sendsAlone: false,
      aloneOffered: false,
      aloneOn: true,
    })
  })

  it("keeps the switch on this device, the Gamemaster's apart from the player's", () => {
    expect(ALONE_KEY).toBe('sending-stone:send-damage')
    expect(GM_ALONE_KEY).toBe('sending-stone:send-damage:gm')
    const player = render(['itemDamage'])
    act(() => player.result.current.setAlone(true))
    expect(globalThis.localStorage.getItem(ALONE_KEY)).toBe('on')

    const gm = renderHook(
      () => useTableRolls('gm:c1:thorin', ['itemDamage'], []),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <TableApiContext
            value={{
              role: 'gm',
              api: '/api/campaigns/c1/characters/thorin',
              key: 'gm:c1:thorin',
            }}
          >
            {children}
          </TableApiContext>
        ),
      },
    )
    // Off by default at the Gamemaster's seat too, whatever the player's is.
    expect(gm.result.current).toMatchObject({
      aloneOn: false,
      sendsAlone: false,
    })
    act(() => gm.result.current.setAlone(true))
    expect(globalThis.localStorage.getItem(GM_ALONE_KEY)).toBe('on')
    act(() => player.result.current.setAlone(false))
    expect(globalThis.localStorage.getItem(ALONE_KEY)).toBe('off')
    expect(gm.result.current.aloneOn).toBe(true)
  })

  it("sends an action's damage on its own as its item and activity, with the dice thrown", () => {
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    const { result } = render(['itemDamage'])

    act(() => result.current.sendDamage(alone(), bitten()))

    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sent()).toEqual({
      kind: 'itemDamage',
      item: 'wolfBite',
      activity: 'biteAttack',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 8, results: [5] }],
    })
    // Changed on purpose (round 0.36.0 §20): marked sent on its own.
    expect(result.current.states.get('b1')).toEqual({
      status: 'sending',
      alone: true,
    })
  })

  it("says a critical hit's, the kinds chosen, the changes made and dice typed in, each only where so", () => {
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    const { result } = render(['itemDamage'], ['modifiers'])

    act(() =>
      result.current.sendDamage(
        aloneRollOf('Bite', bite, { critical: true }) as SheetDamageRoll,
        bitten({
          critical: true,
          typed: true,
          parts: [
            {
              type: 'Slashing',
              total: 12,
              terms: [
                { text: '2d8', values: [5, 4], value: 9 },
                { text: '+3', values: [], value: 3 },
              ],
            },
          ],
        }),
      ),
    )
    expect(sent()).toEqual({
      kind: 'itemDamage',
      item: 'wolfBite',
      activity: 'biteAttack',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 8, results: [5, 4] }],
      critical: true,
      typed: true,
    })

    const orb = {
      item: 'orb',
      activity: 'orbAttack',
      plan: {
        normal: {
          critical: false,
          plannable: true,
          rolls: [
            {
              formula: '1d8',
              type: 'Acid',
              types: [
                { key: 'acid', label: 'Acid' },
                { key: 'cold', label: 'Cold' },
              ],
              dice: [{ faces: 8, number: 1 }],
            },
          ],
        },
        critical: null,
      },
    }
    act(() =>
      result.current.sendDamage(
        aloneRollOf('Chromatic Orb', orb, {
          type: 'cold',
          modifiers: { maximize: true },
        }) as SheetDamageRoll,
        bitten({
          id: 'b2',
          maximized: true,
          parts: [
            {
              type: 'Cold',
              total: 8,
              terms: [{ text: '1d8', values: [8], value: 8 }],
            },
          ],
        }),
      ),
    )
    expect(sent()).toEqual({
      kind: 'itemDamage',
      item: 'orb',
      activity: 'orbAttack',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 8, results: [8] }],
      types: ['cold'],
      modifiers: { maximize: true },
    })
  })

  it('sends nothing on its own without the switch, Send to the table, or the kind taken', () => {
    const off = render(['damage', 'itemDamage'])
    act(() => off.result.current.sendDamage(alone(), bitten()))
    expect(fetch).not.toHaveBeenCalled()

    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    const untaken = render(['damage'])
    act(() => untaken.result.current.sendDamage(alone(), bitten()))
    expect(fetch).not.toHaveBeenCalled()

    const unsent = render(['damage', 'itemDamage'])
    act(() => unsent.result.current.setSending(false))
    act(() => unsent.result.current.sendDamage(alone(), bitten()))
    expect(fetch).not.toHaveBeenCalled()
    expect(unsent.result.current.states.size).toBe(0)
  })

  it("sends an attack's due damage as it always has, the switch on", () => {
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    const { result } = render(['damage', 'itemDamage'])

    act(() =>
      result.current.sendDamage(
        damageRollOf('Longsword', { use: 'req-1', damage: preview() }),
        thrownDamage(),
      ),
    )

    expect(sent()).toEqual({
      kind: 'damage',
      use: 'req-1',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [
        { faces: 8, results: [5] },
        { faces: 6, results: [6] },
      ],
    })
  })

  it("sends a recharge's d6 for an item's uses or an activity's, typed where it was", () => {
    const { result } = render(['recharge'])

    act(() => result.current.sendRecharge(breath, recharged()))
    expect(sent()).toEqual({
      kind: 'recharge',
      item: 'frostBreath',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 6, results: [5] }],
    })
    // Changed on purpose (round 0.36.0 §20): marked a recharge.
    expect(result.current.states.get('f9')).toEqual({
      status: 'sending',
      recharge: true,
    })

    act(() =>
      result.current.sendRecharge(
        { ...breath, counter: { item: 'frostBreath', activity: 'frostSave' } },
        recharged({
          id: 'f10',
          typed: true,
          terms: [{ text: '1d6', values: [2], value: 2 }],
        }),
      ),
    )
    expect(sent()).toEqual({
      kind: 'recharge',
      item: 'frostBreath',
      activity: 'frostSave',
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 6, results: [2] }],
      typed: true,
    })
  })

  it('sends no recharge where the game takes none, or Send to the table is off', () => {
    const untaken = render(['damage'])
    act(() => untaken.result.current.sendRecharge(breath, recharged()))
    expect(fetch).not.toHaveBeenCalled()

    const unsent = render(['recharge'])
    act(() => unsent.result.current.setSending(false))
    act(() => unsent.result.current.sendRecharge(breath, recharged()))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('marks damage on its own and a recharge in every state they are followed through, and neither a due damage nor a formula (round 0.36.0 §20)', async () => {
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    const { result } = render(['damage', 'formula', 'itemDamage', 'recharge'])

    act(() => result.current.sendDamage(alone(), bitten()))
    act(() => result.current.sendRecharge(breath, recharged()))
    act(() =>
      result.current.sendDamage(
        damageRollOf('Longsword', { use: 'req-1', damage: preview() }),
        thrownDamage(),
      ),
    )
    act(() => result.current.sendFormula(lantern, shone))
    await advance(0)
    expect(result.current.states.get('b1')).toMatchObject({ alone: true })
    expect(result.current.states.get('f9')).toMatchObject({ recharge: true })

    jest.mocked(fetch).mockResolvedValue(
      respond(200, {
        id: 'req-9',
        status: 'done',
        visible: true,
        rolls: [],
        outcome: 'success',
      }),
    )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('b1')).toMatchObject({
      status: 'done',
      requestId: 'req-9',
      alone: true,
    })
    expect(result.current.states.get('b1')).not.toHaveProperty('recharge')
    expect(result.current.states.get('f9')).toMatchObject({
      status: 'done',
      outcome: 'success',
      recharge: true,
    })
    expect(result.current.states.get('f9')).not.toHaveProperty('alone')
    for (const id of ['r2', 'f2']) {
      const state = result.current.states.get(id)
      expect(state).toMatchObject({ status: 'done' })
      expect(state).not.toHaveProperty('alone')
      expect(state).not.toHaveProperty('recharge')
    }

    // And as the app refuses one.
    jest
      .mocked(fetch)
      .mockResolvedValue(respond(422, { reason: 'attacks-off' }))
    act(() => result.current.sendDamage(alone(), bitten({ id: 'b3' })))
    act(() => result.current.sendRecharge(breath, recharged({ id: 'f11' })))
    await advance(0)
    expect(result.current.states.get('b3')).toEqual({
      status: 'refused',
      reason: 'attacks-off',
      alone: true,
    })
    expect(result.current.states.get('f11')).toEqual({
      status: 'refused',
      reason: 'attacks-off',
      recharge: true,
    })
  })

  it("marks the Gamemaster's recharges and damage on its own by their kind, as the player's own are", () => {
    const { states } = gmRollsOf([
      gmView('req-r', 'recharge'),
      gmView('req-a', 'itemDamage'),
      gmView('req-d', 'damage'),
      gmView('req-f', 'formula'),
    ])

    expect(states.get('gm:req-r')).toMatchObject({ recharge: true })
    expect(states.get('gm:req-r')).not.toHaveProperty('alone')
    expect(states.get('gm:req-a')).toMatchObject({ alone: true })
    expect(states.get('gm:req-a')).not.toHaveProperty('recharge')
    for (const id of ['gm:req-d', 'gm:req-f']) {
      expect(states.get(id)).not.toHaveProperty('alone')
      expect(states.get(id)).not.toHaveProperty('recharge')
    }
  })
})

describe('hooks/use-table-rolls, Wild Shape from the app, from module 0.40.0', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const change = used({
    id: 'u-ws',
    label: 'Wild Shape',
    wildShape: { op: 'transform', form: 'Wolf', character: 'Elowen' },
  })

  it('sends a change as it is, whatever rolls the game takes or this device’s switch says, and keeps what the game made of it apart from what was asked', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-ws' }))
    const { result } = render([])
    act(() => result.current.setSending(false))
    act(() =>
      result.current.sendWildShape(change, {
        op: 'transform',
        form: FORM_IDS.wolf,
      }),
    )
    expect(fetch).toHaveBeenCalledWith(
      '/api/characters/char-1/rolls',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sent()).toEqual({
      kind: 'wildShape',
      wildShape: { op: 'transform', form: FORM_IDS.wolf },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
      label: 'Wild Shape',
    })
    expect(result.current.states.get('u-ws')).toEqual({
      status: 'sending',
      wildShape: 'transform',
    })
    const made = wildShapeResult().wildShape
    jest.mocked(fetch).mockResolvedValue(
      respond(200, {
        id: 'req-ws',
        status: 'done',
        visible: true,
        rolls: [],
        wildShape: made,
      }),
    )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('u-ws')).toMatchObject({
      status: 'done',
      wildShape: 'transform',
      wildShaped: made,
    })
  })

  it('sends nothing for a use that is no Wild Shape', () => {
    const { result } = render([])
    act(() =>
      result.current.sendWildShape(used(), {
        op: 'transform',
        form: FORM_IDS.wolf,
      }),
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reads the Beasts to learn while a roll is on its way, logging nothing, and gives the list', async () => {
    const listed = beastsResult().wildShape
    jest.mocked(fetch).mockImplementation(async (url, init) => {
      const path = String(url)
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { kind: string }
        return respond(202, {
          id: body.kind === 'wildShape' ? 'req-forms' : 'req-skill',
        })
      }
      return path.endsWith('/req-forms')
        ? respond(200, {
            id: 'req-forms',
            status: 'done',
            visible: true,
            rolls: [],
            wildShape: listed,
          })
        : respond(200, { id: 'req-skill', status: 'pending' })
    })
    const { result } = render()
    act(() => result.current.send(perception, check()))
    let read: Promise<unknown> = Promise.resolve()
    act(() => {
      read = result.current.readWildShapeForms()
    })
    expect(sent()).toEqual({
      kind: 'wildShape',
      wildShape: { op: 'forms' },
      mode: 0,
      explicit: false,
      extras: [],
      dice: [],
    })
    await advance(CHECK_EVERY)
    await expect(read).resolves.toEqual(
      listed?.op === 'forms'
        ? { forms: listed.forms, more: listed.more, limits: listed.limits }
        : undefined,
    )
    // The roll's way alone, as the tray draws it; none for the read.
    expect([...result.current.states.keys()]).toEqual(['r1'])
  })

  it('says why the game couldn’t list them', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(respond(202, { id: 'req-forms' }))
      .mockResolvedValue(
        respond(200, {
          id: 'req-forms',
          status: 'refused',
          reason: 'unavailable',
          visible: true,
          rolls: [],
        }),
      )
    const { result } = render([])
    let read: Promise<unknown> = Promise.resolve()
    act(() => {
      read = result.current.readWildShapeForms()
    })
    await advance(CHECK_EVERY)
    await expect(read).resolves.toEqual({ reason: 'unavailable' })
    expect(result.current.states.size).toBe(0)
  })
})

/** Burning Hands' damage thrown, 4d6 fire. */
const burnt = (fields: Partial<LocalDamage> = {}) =>
  bitten({
    label: 'Burning Hands damage',
    parts: [
      {
        type: 'Fire',
        total: 14,
        terms: [{ text: '4d6', values: [3, 5, 2, 4], value: 14 }],
      },
    ],
    ...fields,
  })

describe("hooks/use-table-rolls, damage on its own's choices, from module 0.41.0 (round 0.41.0 §2.10)", () => {
  const hands = burningHandsAction()
  const handsAlone = {
    item: 'hands',
    activity: 'handsSave',
    plan: hands.tableDamage!,
  }
  /** Burning Hands' damage on its own, as picked: at 2nd level, spending the slot where asked. */
  const handsAt = (choice: Parameters<typeof aloneRollOf>[2] = {}) =>
    aloneRollOf('Burning Hands', handsAlone, choice, {
      action: hands,
      spells: aloneSpells(),
    }) as SheetDamageRoll
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    globalThis.fetch = jest.fn()
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-9' }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('says whether the game takes its choices: where it takes damage on its own and says aloneChoices', () => {
    const { result, rerender } = render(['itemDamage'], ['aloneChoices'])
    expect(result.current.aloneChoices).toBe(true)
    rerender({ kinds: ['itemDamage'], features: [] })
    expect(result.current.aloneChoices).toBe(false)
    rerender({ kinds: ['damage'], features: ['aloneChoices'] })
    expect(result.current.aloneChoices).toBe(false)
  })

  it('posts the slot picked and consume where the switch is on, and keeps that it asked to spend', () => {
    const { result } = render(['itemDamage'], ['aloneChoices'])

    act(() =>
      result.current.sendDamage(
        handsAt({ slot: 'spell2', consume: true }),
        burnt(),
      ),
    )
    expect(sent()).toEqual({
      kind: 'itemDamage',
      item: 'hands',
      activity: 'handsSave',
      slot: 'spell2',
      consume: true,
      mode: 0,
      explicit: false,
      extras: [],
      dice: [{ faces: 6, results: [3, 5, 2, 4] }],
    })
    expect(result.current.states.get('b1')).toEqual({
      status: 'sending',
      alone: true,
      consumes: true,
    })

    // Switch off: the slot it's rolled at, always named, and nothing spent.
    act(() =>
      result.current.sendDamage(
        handsAt({ slot: 'spell2' }),
        burnt({ id: 'b2' }),
      ),
    )
    expect(sent()).toMatchObject({ slot: 'spell2' })
    expect(sent()).not.toHaveProperty('consume')
    expect(result.current.states.get('b2')).toEqual({
      status: 'sending',
      alone: true,
    })
  })

  it('posts a weapon’s attack mode and ammunition as picked', () => {
    const bow = longbowAction()
    const { result } = render(['itemDamage'], ['aloneChoices'])

    act(() =>
      result.current.sendDamage(
        aloneRollOf(
          'Longbow',
          { item: 'longbow', activity: 'bowAttack', plan: bow.tableDamage! },
          { ammunition: 'arrowsFire', consume: true },
          { action: bow, spells: [] },
        ) as SheetDamageRoll,
        bitten({ label: 'Longbow damage' }),
      ),
    )
    expect(sent()).toMatchObject({
      kind: 'itemDamage',
      item: 'longbow',
      activity: 'bowAttack',
      ammunition: 'arrowsFire',
      consume: true,
    })
    expect(sent()).not.toHaveProperty('slot')
  })

  it('posts none of its choices to a game that doesn’t take them, as before module 0.41.0', () => {
    const { result } = render(['itemDamage'], [])

    act(() =>
      result.current.sendDamage(
        handsAt({ slot: 'spell2', consume: true }),
        burnt(),
      ),
    )
    const posted = sent()
    for (const key of ['slot', 'attackMode', 'ammunition', 'consume']) {
      expect(posted).not.toHaveProperty(key)
    }
    expect(result.current.states.get('b1')).toEqual({
      status: 'sending',
      alone: true,
    })
  })

  it('keeps what the game spent and whether concentration began apart from the hit dice a request spent', async () => {
    const { result } = render(['itemDamage'], ['aloneChoices'])
    act(() =>
      result.current.sendDamage(
        handsAt({ slot: 'spell2', consume: true }),
        burnt(),
      ),
    )
    await advance(0)
    const { alone, ...made } = aloneResult(['slot', 'uses'], true)
    jest
      .mocked(fetch)
      .mockResolvedValue(
        respond(200, { ...made, id: 'req-9', status: 'done', alone }),
      )
    await advance(CHECK_EVERY)

    const state = result.current.states.get('b1')
    expect(state).toMatchObject({
      status: 'done',
      alone: true,
      consumes: true,
      aloneSpent: ['slot', 'uses'],
      concentrating: true,
    })
    expect(state).not.toHaveProperty('spent')
  })

  it('keeps nothing spent as none, and no concentration where none began', async () => {
    const potion = potionAction()
    const { result } = render(['itemDamage'], ['aloneChoices'])
    act(() =>
      result.current.sendDamage(
        aloneRollOf(
          'Potion of Healing',
          {
            item: 'potion',
            activity: 'potionHeal',
            plan: potion.tableDamage!,
          },
          { consume: true },
          { action: potion, spells: [] },
        ) as SheetDamageRoll,
        bitten({ label: 'Potion of Healing healing' }),
      ),
    )
    expect(sent()).toMatchObject({ consume: true })
    await advance(0)
    jest
      .mocked(fetch)
      .mockResolvedValue(
        respond(200, { id: 'req-9', status: 'done', alone: { spent: [] } }),
      )
    await advance(CHECK_EVERY)

    const state = result.current.states.get('b1')
    expect(state).toMatchObject({ aloneSpent: [], consumes: true })
    expect(state).not.toHaveProperty('concentrating')
  })
})

/** Perception typed in, Bless's d4 typed 3 after the player's own terms. */
const blessed = (fields: Partial<LocalCheck> = {}) =>
  check({
    typed: true,
    total: 31,
    extras: [...check().extras, { text: 'Bless +1d4', values: [3], value: 3 }],
    effectDice: [{ faces: 4, sign: 1, results: [3] }],
    ...fields,
  })

describe('hooks/use-table-rolls, the dice effects add, and rerolls kept, from module 0.42.0', () => {
  const skill = { kind: 'skill', key: 'prc' } as const

  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("sends a typed d20 roll's effect dice beside its dice, which are its own terms' alone", () => {
    const request = toRollRequest(perception, skill, blessed())

    expect(request.effectDice).toEqual([{ faces: 4, sign: 1, results: [3] }])
    // Bless's d4 isn't among the dice of the terms the player added, read by their places.
    expect(request.dice).toEqual([
      { faces: 20, results: [17, 3] },
      { faces: 4, results: [2] },
      { faces: 6, results: [5, 1] },
    ])
    expect(request.extras).toEqual(perception.extras)
  })

  it('sends no effect dice where none was typed, nor of a roll not typed', () => {
    expect(
      toRollRequest(perception, skill, blessed({ effectDice: [] })),
    ).not.toHaveProperty('effectDice')
    expect(
      toRollRequest(perception, skill, blessed({ effectDice: undefined })),
    ).not.toHaveProperty('effectDice')
    expect(
      toRollRequest(perception, skill, blessed({ typed: undefined })),
    ).not.toHaveProperty('effectDice')
  })

  it('says a d20 roll, a formula and hit dice kept their rerolls only where typed in and kept so', () => {
    expect(
      toRollRequest(perception, skill, check({ typed: true, rerolls: 'kept' })),
    ).toMatchObject({ typed: true, rerolls: 'kept' })
    expect(
      toRollRequest(perception, skill, check({ typed: true })),
    ).not.toHaveProperty('rerolls')
    expect(
      toRollRequest(perception, skill, check({ rerolls: 'kept' })),
    ).not.toHaveProperty('rerolls')

    const formula = {
      kind: 'formula',
      item: 'lantern',
      activity: 'shine',
    } as const
    expect(
      toFormulaRequest(lantern, formula, {
        ...shone,
        typed: true,
        rerolls: 'kept',
      }),
    ).toMatchObject({ typed: true, rerolls: 'kept' })
    expect(
      toFormulaRequest(lantern, formula, { ...shone, rerolls: 'kept' }),
    ).not.toHaveProperty('rerolls')

    const source = hitDice.source as Extract<FormulaSource, { kind: 'hitDice' }>
    const kept: LocalFormula = {
      ...spentThree(),
      typed: true,
      rerolls: 'kept',
    }
    expect(toHitDiceRequest(source, kept)).toMatchObject({ rerolls: 'kept' })
    expect(
      toHitDiceRequest(source, { ...spentThree(), typed: true }),
    ).not.toHaveProperty('rerolls')
    for (const request of toHitDieRequests(source, kept)) {
      expect(request).toMatchObject({ typed: true, rerolls: 'kept' })
    }
  })

  it("says an attack's damage, a description's, damage on its own and a recharge kept their rerolls only where typed in and kept so", () => {
    globalThis.localStorage.setItem(ALONE_KEY, 'on')
    const { result } = render([
      'damage',
      'textDamage',
      'itemDamage',
      'recharge',
    ])
    const due = { use: 'req-1', damage: preview() }
    const described: SheetDamageRoll = {
      label: 'Flame damage',
      parts: [{ terms: [{ sign: 1, count: 1, sides: 8 }], type: 'fire' }],
      text: { text: 'a'.repeat(16), link: 1 },
    }
    const flame = {
      parts: [
        {
          type: 'fire',
          total: 5,
          terms: [{ text: '1d8', values: [5], value: 5 }],
        },
      ],
    }
    const bite = {
      item: 'wolfBite',
      activity: 'biteAttack',
      plan: mockTableDamage(),
    }

    act(() =>
      result.current.sendDamage(
        damageRollOf('Longsword', due),
        thrownDamage({ typed: true, rerolls: 'kept' }),
      ),
    )
    expect(sent()).toMatchObject({
      kind: 'damage',
      typed: true,
      rerolls: 'kept',
    })
    act(() =>
      result.current.sendDamage(
        damageRollOf('Longsword', due),
        thrownDamage({ id: 'r3', rerolls: 'kept' }),
      ),
    )
    expect(sent()).not.toHaveProperty('rerolls')
    act(() =>
      result.current.sendDamage(described, {
        ...thrownDamage({ id: 'r4', typed: true, rerolls: 'kept' }),
        ...flame,
      }),
    )
    expect(sent()).toMatchObject({ kind: 'textDamage', rerolls: 'kept' })
    act(() =>
      result.current.sendDamage(described, {
        ...thrownDamage({ id: 'r5', typed: true }),
        ...flame,
      }),
    )
    expect(sent()).not.toHaveProperty('rerolls')
    act(() =>
      result.current.sendDamage(
        aloneRollOf('Bite', bite) as SheetDamageRoll,
        bitten({ typed: true, rerolls: 'kept' }),
      ),
    )
    expect(sent()).toMatchObject({ kind: 'itemDamage', rerolls: 'kept' })
    act(() =>
      result.current.sendRecharge(
        { label: 'Frost Breath recharge', counter: { item: 'frostBreath' } },
        recharged({ typed: true, rerolls: 'kept' }),
      ),
    )
    expect(sent()).toMatchObject({ kind: 'recharge', rerolls: 'kept' })
    act(() =>
      result.current.sendRecharge(
        { label: 'Frost Breath recharge', counter: { item: 'frostBreath' } },
        recharged({ id: 'f11', typed: true }),
      ),
    )
    expect(sent()).not.toHaveProperty('rerolls')
  })

  it("says whether the game takes a typed roll's effect dice, and keeps its rerolls, each by its own feature", () => {
    const { result, rerender } = render(['save'], ['manualDice'])
    expect(result.current).toMatchObject({
      typedEffects: false,
      keptRerolls: false,
    })

    rerender({ kinds: ['save'], features: ['manualDice', 'effectDice'] })
    expect(result.current).toMatchObject({
      typedEffects: true,
      keptRerolls: false,
    })
    rerender({ kinds: ['save'], features: ['manualDice', 'keptRerolls'] })
    expect(result.current).toMatchObject({
      typedEffects: false,
      keptRerolls: true,
    })
    rerender({
      kinds: ['save'],
      features: ['manualDice', 'effectDice', 'keptRerolls'],
    })
    expect(result.current).toMatchObject({
      typedEffects: true,
      keptRerolls: true,
    })
  })

  it('takes effect dice only from a device that sends, saying which rolls it sends as send does', () => {
    const save = { kind: 'save', key: 'dex' } as const
    const picked = {
      kind: 'skill',
      key: 'slt',
      item: 'tools',
      activity: 'pick',
    } as const
    const swing = { kind: 'attack', item: 'axe', activity: 'swing' } as const
    const all: RollFeature[] = ['manualDice', 'effectDice', 'keptRerolls']
    const { result, rerender } = render(
      ['save', 'skill'],
      [...all, 'activityChecks'],
    )
    const { sends } = result.current
    expect(result.current.typedEffects).toBe(true)
    expect(sends(save)).toBe(true)
    expect(sends(picked)).toBe(true)
    // Nor a roll of a kind the game doesn't take, nor one with nothing to send.
    expect(sends(swing)).toBe(false)
    expect(sends()).toBe(false)

    // A check an activity asks for, of a game that doesn't make it so, is the player's alone.
    rerender({ kinds: ['save', 'skill'], features: all })
    expect(sends(picked)).toBe(false)
    expect(sends({ kind: 'skill', key: 'slt' })).toBe(true)

    // This device sending none: the dice of effects are no game's to roll, though rerolls kept
    // still are the player's own as typed.
    act(() => result.current.setSending(false))
    expect(result.current).toMatchObject({
      typedEffects: false,
      keptRerolls: true,
    })
    expect(sends(save)).toBe(false)
    // The same function each time, for what's made of it to stay.
    expect(result.current.sends).toBe(sends)
  })
})

/** A spell slot spent from the dots, as the page logs it. */
const slotUsed = (fields: Partial<LocalUse> = {}) =>
  used({ id: 'u1', label: '1st-level spell slot', slot: 'spend', ...fields })

describe('hooks/use-table-rolls, spell slots from the dots, from module 0.42.1 (round 0.42.1 §U.1)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    globalThis.localStorage.clear()
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const plain = { mode: 0, explicit: false, extras: [], dice: [] }

  it('spends or restores one, from the count shown, keeping which under its line, and follows it', async () => {
    jest.mocked(fetch).mockResolvedValue(respond(202, { id: 'req-1' }))
    const { result } = render(['spend', 'inspiration', 'spellSlot'])

    act(() =>
      result.current.sendSpellSlot(slotUsed(), {
        op: 'spend',
        id: 'spell1',
        from: 3,
      }),
    )
    expect(sent()).toEqual({
      kind: 'spellSlot',
      spellSlot: { op: 'spend', id: 'spell1', from: 3 },
      ...plain,
    })
    expect(result.current.states.get('u1')).toEqual({
      status: 'sending',
      spellSlot: 'spend',
    })
    act(() =>
      result.current.sendSpellSlot(slotUsed({ id: 'u2', slot: 'restore' }), {
        op: 'restore',
        id: 'pact',
        from: 0,
      }),
    )
    expect(sent()).toEqual({
      kind: 'spellSlot',
      spellSlot: { op: 'restore', id: 'pact', from: 0 },
      ...plain,
    })
    expect(result.current.states.get('u2')).toMatchObject({
      spellSlot: 'restore',
    })

    jest
      .mocked(fetch)
      .mockResolvedValue(
        respond(200, { id: 'req-1', status: 'done', visible: true, rolls: [] }),
      )
    await advance(CHECK_EVERY)
    expect(result.current.states.get('u1')).toMatchObject({
      status: 'done',
      spellSlot: 'spend',
      requestId: 'req-1',
    })
  })

  it('keeps which on a refusal too, for its words', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValue(respond(422, { error: 'full', reason: 'full' }))
    const { result } = render(['spellSlot'])

    act(() =>
      result.current.sendSpellSlot(slotUsed({ slot: 'restore' }), {
        op: 'restore',
        id: 'spell1',
        from: 4,
      }),
    )
    await advance(0)
    expect(result.current.states.get('u1')).toMatchObject({
      status: 'refused',
      spellSlot: 'restore',
    })
  })

  it("sends none where the game doesn't take it, as a module before 0.42.1, or from a device that doesn't send", () => {
    // A module before 0.42.1 lists charges and Heroic Inspiration, never spell slots.
    const { result, rerender } = render(['spend', 'inspiration'])
    const send = () =>
      act(() =>
        result.current.sendSpellSlot(slotUsed(), {
          op: 'spend',
          id: 'spell1',
          from: 3,
        }),
      )
    send()
    expect(result.current.takes('spellSlot')).toBe(false)
    rerender({ kinds: ['spend', 'inspiration', 'spellSlot'], features: [] })
    expect(result.current.takes('spellSlot')).toBe(true)
    act(() => result.current.setSending(false))
    expect(result.current.takes('spellSlot')).toBe(false)
    send()

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.states.size).toBe(0)
  })

  it("says the Gamemaster's page spent a slot or restored one, for its player's line, and nothing for another kind", () => {
    const { rolls } = gmRollsOf([
      { ...gmView('req-s', 'spellSlot'), slotOp: 'spend' },
      { ...gmView('req-r', 'spellSlot'), slotOp: 'restore' },
      gmView('req-x', 'spellSlot'),
      gmView('req-p', 'spend'),
    ])

    expect(rolls.map(roll => roll.slotOp)).toEqual([
      'spend',
      'restore',
      undefined,
      undefined,
    ])
    expect(rolls[2]).not.toHaveProperty('slotOp')
    expect(rolls[3]).not.toHaveProperty('slotOp')
  })
})
