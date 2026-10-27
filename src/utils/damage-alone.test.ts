/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import {
  alonePicks,
  alonePlan,
  aloneRollOf,
  aloneSelection,
  type AloneRow,
} from './damage-alone'
import {
  aloneSpells,
  battleaxeAction,
  burningHandsAction,
  hellishRebukeAction,
  longbowAction,
  mockTableDamage,
  pactSpells,
  potionAction,
} from '@/mocks/sending-stone'
import type { SheetAction, TableDamagePlan } from '@/types/sending-stone'

const bite = {
  item: 'wolfBite',
  activity: 'biteAttack',
  plan: mockTableDamage(),
}

const fire = {
  critical: false,
  plannable: true,
  rolls: [
    {
      formula: '2d6',
      type: 'Fire',
      types: [
        { key: 'fire', label: 'Fire' },
        { key: 'cold', label: 'Cold' },
      ],
      dice: [{ faces: 6, number: 2 }],
      perDie: 1,
    },
  ],
}

describe('utils/damage-alone', () => {
  it("rolls the plan's normal damage, called after what it's of, as its own item and activity", () => {
    const roll = aloneRollOf('Bite', bite)

    expect(roll).toMatchObject({
      label: 'Bite damage',
      critical: false,
      healing: false,
      exact: true,
      perDie: 1,
      parts: [
        {
          type: 'Slashing',
          terms: [
            { count: 1, sides: 8, sign: 1 },
            { flat: 3, sign: 1 },
          ],
        },
      ],
      alone: { item: 'wolfBite', activity: 'biteAttack', critical: false },
    })
    // It follows no attack or use of the game's.
    expect(roll).not.toHaveProperty('use')
  })

  it("rolls the plan's critical damage for a critical hit, its dice as the game doubles them", () => {
    const roll = aloneRollOf('Bite', bite, { critical: true })

    expect(roll).toMatchObject({
      label: 'Bite damage',
      critical: true,
      perDie: 2,
      parts: [
        {
          terms: [
            { count: 2, sides: 8, sign: 1 },
            { flat: 3, sign: 1 },
          ],
        },
      ],
      alone: { critical: true },
    })
  })

  it('never makes a critical hit’s from a plan whose critical is null', () => {
    const plan: TableDamagePlan = { ...mockTableDamage(), critical: null }

    const roll = aloneRollOf(
      'Frost Breath',
      { ...bite, plan },
      { critical: true },
    )

    expect(roll).toMatchObject({
      critical: false,
      perDie: 1,
      parts: [
        {
          terms: [{ count: 1, sides: 8, sign: 1 }, expect.anything()],
        },
      ],
      alone: { critical: false },
    })
  })

  it('calls healing healing', () => {
    const plan: TableDamagePlan = {
      normal: { ...mockTableDamage().normal, healing: true },
      critical: null,
    }

    expect(
      aloneRollOf('Cure Wounds', { item: 'cure', activity: 'heal', plan }),
    ).toMatchObject({ label: 'Cure Wounds healing', healing: true })
  })

  it('carries the kind chosen and the changes made', () => {
    const plan: TableDamagePlan = { normal: fire, critical: null }

    const roll = aloneRollOf(
      'Chromatic Orb',
      { item: 'orb', activity: 'orbAttack', plan },
      { type: 'cold', modifiers: { maximize: true } },
    )

    expect(roll).toMatchObject({
      types: ['cold'],
      modifiers: { maximize: true },
      parts: [{ type: 'Cold' }],
    })
  })

  it('makes none where the game said nothing of its dice', () => {
    expect(
      aloneRollOf('Bite', { item: 'wolfBite', activity: 'biteAttack' }),
    ).toBeUndefined()
  })
})

const hands = burningHandsAction()
const rebuke = hellishRebukeAction()
const axe = battleaxeAction()
const bow = longbowAction()
/** A row and the spellbook it's in. */
const rowOf = (action: SheetAction, spells = aloneSpells()): AloneRow => ({
  action,
  spells,
})
/** What the row's plan is, as the sheet sent it. */
const planOf = (action: SheetAction) => action.tableDamage!
/** The first formula of a plan's normal and critical dice. */
const formulas = (plan: ReturnType<typeof alonePlan>) => [
  plan.normal.rolls.map(({ formula }) => formula).join(' + '),
  plan.critical?.rolls.map(({ formula }) => formula).join(' + ') ?? null,
]

/** A bolt's piercing, by its formula, as a plan. */
const boltPlan = (formula: string) => ({
  critical: false,
  plannable: true,
  rolls: [
    {
      formula,
      type: 'Piercing',
      dice: [{ faces: 6, number: 1 }],
      perDie: 1,
    },
  ],
})

/**
 * A hand crossbow of two modes firing two kinds of bolts: its plans by mode, by ammunition and
 * by both, as the game sends those that differ from its own.
 */
const crossbow = (): SheetAction => {
  return {
    ...bow,
    id: 'crossbow',
    name: 'Hand Crossbow',
    attackModes: [
      { value: 'oneHanded', label: 'One-Handed' },
      { value: 'offhand', label: 'Off-Hand' },
    ],
    ammunition: [
      { id: 'bolts', name: 'Bolts', quantity: 10 },
      { id: 'silver', name: 'Silvered Bolts', quantity: 2 },
    ],
    tableDamage: {
      normal: boltPlan('1d6 + 3'),
      critical: null,
      choices: [
        { attackMode: 'offhand', normal: boltPlan('1d6'), critical: null },
        { ammunition: 'silver', normal: boltPlan('1d6 + 4'), critical: null },
        {
          attackMode: 'offhand',
          ammunition: 'silver',
          normal: boltPlan('1d6 + 1'),
          critical: null,
        },
        {
          attackMode: 'oneHanded',
          ammunition: 'silver',
          normal: boltPlan('1d6 + 4'),
          critical: null,
        },
      ],
      spends: ['ammunition'],
    },
  }
}

/** A row's damage on its own, as its roll's `alone`, before its choices. */
const aloneOf = (action: SheetAction) => ({
  item: action.id,
  activity: action.activity?.id ?? action.attackId ?? '',
  plan: action.tableDamage!,
})

describe('utils/damage-alone, its choices, from module 0.41.0', () => {
  describe('alonePicks', () => {
    it("picks no level for a pool of the spell's own level, and the pool's for one above", () => {
      const spells = aloneSpells()
      expect(alonePicks(hands, spells, { slot: 'spell1' })).toEqual({})
      expect(alonePicks(hands, spells, { slot: 'spell2' })).toEqual({
        level: 2,
      })
      // None named, or one the spell isn't cast with, picks nothing.
      expect(alonePicks(hands, spells, {})).toEqual({})
      expect(alonePicks(hands, spells, { slot: 'spell9' })).toEqual({})
    })

    it("picks a pact slot's level, above the spell's own", () => {
      expect(alonePicks(rebuke, pactSpells(), { slot: 'pact' })).toEqual({
        level: 3,
      })
    })

    it("picks the weapon's own attack modes and ammunition only", () => {
      expect(
        alonePicks(axe, [], { attackMode: 'twoHanded', slot: 'spell2' }),
      ).toEqual({ attackMode: 'twoHanded' })
      expect(alonePicks(axe, [], { attackMode: 'thrown' })).toEqual({})
      // A bow of one mode lists none: its one is its own plan's.
      expect(
        alonePicks(bow, [], { attackMode: 'twoHanded', ammunition: 'arrows' }),
      ).toEqual({ ammunition: 'arrows' })
      expect(alonePicks(bow, [], { ammunition: 'bolts' })).toEqual({})
      expect(
        alonePicks(crossbow(), [], {
          attackMode: 'offhand',
          ammunition: 'silver',
        }),
      ).toEqual({ attackMode: 'offhand', ammunition: 'silver' })
    })
  })

  describe('alonePlan', () => {
    it('takes the plan of a level, else the row’s own', () => {
      expect(formulas(alonePlan(planOf(hands), { level: 2 }))).toEqual([
        '4d6',
        null,
      ])
      expect(formulas(alonePlan(planOf(hands), {}))).toEqual(['3d6', null])
      // A level whose dice are the spell's own, which the game leaves out.
      expect(formulas(alonePlan(planOf(hands), { level: 3 }))).toEqual([
        '3d6',
        null,
      ])
      expect(formulas(alonePlan(planOf(rebuke), { level: 3 }))).toEqual([
        '4d10',
        null,
      ])
    })

    it("takes a mode's plan and its critical hit's", () => {
      expect(
        formulas(alonePlan(planOf(axe), { attackMode: 'twoHanded' })),
      ).toEqual(['1d10 + 3', '2d10 + 3'])
      // Its first, one-handed, is its own plan.
      expect(
        formulas(alonePlan(planOf(axe), { attackMode: 'oneHanded' })),
      ).toEqual(['1d8 + 3', '2d8 + 3'])
    })

    it('takes a single-mode bow’s plan by the ammunition picked, of two', () => {
      expect(
        formulas(alonePlan(planOf(bow), { ammunition: 'arrowsFire' })),
      ).toEqual(['1d8 + 2 + 1d4', null])
      // Plain arrows add nothing: the game sends no plan of theirs.
      expect(
        formulas(alonePlan(planOf(bow), { ammunition: 'arrows' })),
      ).toEqual(['1d8 + 2', null])
    })

    it('takes mode × ammunition by exactly both, never a plan of either alone', () => {
      const plan = planOf(crossbow())
      expect(
        formulas(
          alonePlan(plan, { attackMode: 'offhand', ammunition: 'silver' }),
        ),
      ).toEqual(['1d6 + 1', null])
      expect(
        formulas(
          alonePlan(plan, { attackMode: 'oneHanded', ammunition: 'silver' }),
        ),
      ).toEqual(['1d6 + 4', null])
      expect(formulas(alonePlan(plan, { attackMode: 'offhand' }))).toEqual([
        '1d6',
        null,
      ])
      expect(formulas(alonePlan(plan, { ammunition: 'silver' }))).toEqual([
        '1d6 + 4',
        null,
      ])
      // Plain bolts off-hand: no plan of both, so the row's own, not the off-hand's alone.
      expect(
        formulas(
          alonePlan(plan, { attackMode: 'offhand', ammunition: 'bolts' }),
        ),
      ).toEqual(['1d6 + 3', null])
    })

    it("takes the row's own from a sheet of a module before 0.41.0, which sends no choices", () => {
      expect(formulas(alonePlan(mockTableDamage(), { level: 2 }))).toEqual([
        '1d8 + 3',
        '2d8 + 3',
      ])
    })
  })

  describe('aloneSelection', () => {
    it("names the slot always where the spell is cast with one: the chosen, else dnd5e's own", () => {
      expect(
        aloneSelection(planOf(hands), rowOf(hands), { slot: 'spell2' }),
      ).toEqual({
        slot: 'spell2',
      })
      expect(aloneSelection(planOf(hands), rowOf(hands))).toEqual({
        slot: 'spell1',
      })
      // Its own level's spent: the lowest with any left.
      expect(
        aloneSelection(planOf(hands), rowOf(hands, aloneSpells(0, 1))),
      ).toEqual({ slot: 'spell2' })
      // None left at all: its own level's, as nothing is spent.
      expect(
        aloneSelection(planOf(hands), rowOf(hands, aloneSpells(0, 0))),
      ).toEqual({ slot: 'spell1' })
      // A warlock's one pact pool, which no chip shows.
      expect(
        aloneSelection(planOf(rebuke), rowOf(rebuke, pactSpells())),
      ).toEqual({ slot: 'pact' })
    })

    it('names the ammunition chosen, else the first with any left, and a mode only where chosen', () => {
      expect(aloneSelection(planOf(bow), rowOf(bow))).toEqual({
        ammunition: 'arrowsFire',
      })
      expect(
        aloneSelection(planOf(bow), rowOf(bow), { ammunition: 'arrows' }),
      ).toEqual({ ammunition: 'arrows' })
      const empty = {
        ...bow,
        ammunition: [{ id: 'arrows', name: 'Arrows', quantity: 0 }],
      }
      expect(aloneSelection(planOf(empty), rowOf(empty))).toEqual({
        ammunition: 'arrows',
      })
      expect(aloneSelection(planOf(axe), rowOf(axe))).toEqual({})
      expect(
        aloneSelection(planOf(axe), rowOf(axe), { attackMode: 'twoHanded' }),
      ).toEqual({ attackMode: 'twoHanded' })
    })

    it('names nothing for a row the game sends no choices for', () => {
      const old = {
        ...hands,
        tableDamage: { normal: planOf(hands).normal, critical: null },
      }
      expect(
        aloneSelection(old.tableDamage, rowOf(old), {
          slot: 'spell2',
          ammunition: 'arrows',
        }),
      ).toEqual({})
    })
  })

  describe('aloneRollOf', () => {
    it('rolls the plan picked, naming the slot and spending where asked', () => {
      const roll = aloneRollOf(
        'Burning Hands',
        aloneOf(hands),
        { slot: 'spell2', consume: true },
        rowOf(hands),
      )
      expect(roll).toMatchObject({
        label: 'Burning Hands damage',
        parts: [{ type: 'Fire', terms: [{ count: 4, sides: 6, sign: 1 }] }],
        alone: {
          item: 'hands',
          activity: 'handsSave',
          critical: false,
          slot: 'spell2',
          consume: true,
        },
      })
    })

    it("names dnd5e's own slot where none was picked, the dice at its level (critique #3)", () => {
      expect(
        aloneRollOf('Burning Hands', aloneOf(hands), {}, rowOf(hands))?.alone,
      ).toEqual({
        item: 'hands',
        activity: 'handsSave',
        critical: false,
        slot: 'spell1',
      })
      // A warlock's pact slot, 3rd level: 4d10, never the spell's own 2d10.
      const roll = aloneRollOf(
        'Hellish Rebuke',
        aloneOf(rebuke),
        {},
        rowOf(rebuke, pactSpells()),
      )
      expect(roll?.alone).toMatchObject({ slot: 'pact' })
      expect(roll?.parts).toEqual([
        { type: 'Fire', terms: [{ count: 4, sides: 10, sign: 1 }] },
      ])
    })

    it('rolls a mode’s and an ammunition’s plan, naming them', () => {
      expect(
        aloneRollOf(
          'Battleaxe',
          aloneOf(axe),
          { attackMode: 'twoHanded', critical: true },
          rowOf(axe),
        ),
      ).toMatchObject({
        critical: true,
        parts: [
          {
            terms: [
              { count: 2, sides: 10, sign: 1 },
              { flat: 3, sign: 1 },
            ],
          },
        ],
        alone: { attackMode: 'twoHanded', critical: true },
      })
      const fired = aloneRollOf(
        'Longbow',
        aloneOf(bow),
        { consume: true },
        rowOf(bow),
      )
      expect(fired?.alone).toEqual({
        item: 'longbow',
        activity: 'bowAttack',
        critical: false,
        ammunition: 'arrowsFire',
        consume: true,
      })
      expect(fired?.parts).toHaveLength(2)
    })

    it('spends only where its use spends anything, and names nothing without the row', () => {
      expect(
        aloneRollOf('Battleaxe', aloneOf(axe), { consume: true }, rowOf(axe))
          ?.alone,
      ).not.toHaveProperty('consume')
      expect(
        aloneRollOf(
          'Potion of Healing',
          aloneOf(potionAction()),
          { consume: true },
          rowOf(potionAction()),
        )?.alone,
      ).toMatchObject({ consume: true })
      // Without the row: the row's own plan, as before module 0.41.0.
      expect(
        aloneRollOf('Burning Hands', aloneOf(hands), {
          slot: 'spell2',
          consume: true,
        })?.alone,
      ).toEqual({ item: 'hands', activity: 'handsSave', critical: false })
    })
  })
})
