/* eslint-disable unicorn/no-null -- a preview's roll of no kind of its own has null */
import {
  changes,
  criticalOffered,
  criticalParts,
  EVERY_DIE_TWICE,
  firstDie,
  linkDamage,
  modifiedDice,
  mostExtra,
  reshapes,
  withModifiers,
} from './damage-modifiers'
import { formulaTerms } from '@/utils/formulas'
import type { CriticalRule, DamagePreview } from '@/types/sending-stone'
import type { ExtraTerm } from '@/utils/roll-modifiers'

/** Toll the Dead's damage, 1d8 necrotic, and a second part, 1d6 + 2 fire. */
const parts = [
  {
    terms: [{ sign: 1 as const, count: 1, sides: 8 as const }],
    type: 'Necrotic',
  },
  {
    terms: [
      { sign: 1 as const, count: 1, sides: 6 as const },
      { sign: 1 as const, flat: 2 },
    ],
    type: 'Fire',
  },
]

/** The damage the game said a critical hit throws: 2d8 + 4, then 2d6. */
const critical: DamagePreview = {
  critical: true,
  plannable: true,
  rolls: [
    {
      formula: '2d8 + 4',
      type: 'Slashing',
      dice: [{ faces: 8, number: 2 }],
      perDie: 2,
    },
    {
      formula: '2d6',
      type: 'Fire',
      dice: [{ faces: 6, number: 2 }],
      perDie: 2,
    },
  ],
}

/** Damage's parts as written, such as "3d12 + 4 + 1d6". */
const written = (thrown: { terms: ExtraTerm[] }[]) =>
  thrown
    .map(({ terms }) =>
      terms
        .map((term, index) => {
          const value =
            'sides' in term ? `${term.count}d${term.sides}` : `${term.flat}`
          if (index === 0) return term.sign < 0 ? `-${value}` : value
          return `${term.sign < 0 ? '-' : '+'} ${value}`
        })
        .join(' '),
    )
    .join(' + ')

/** A part as the app reads its formula. */
const partOf = (formula: string) => ({ terms: formulaTerms(formula) ?? [] })

describe('utils/damage-modifiers', () => {
  it('says whether changes change anything, and whether they change the dice', () => {
    expect(changes()).toBe(false)
    expect(changes({})).toBe(false)
    expect(changes({ extra: 0, maximize: false })).toBe(false)
    expect(changes({ extra: 1 })).toBe(true)
    expect(changes({ faces: 12 })).toBe(true)
    expect(changes({ maximize: true })).toBe(true)
    expect(reshapes({ maximize: true })).toBe(false)
    expect(reshapes({ faces: 12 })).toBe(true)
  })

  it("finds the first die of damage's first part, if it adds one", () => {
    expect(firstDie(parts)).toEqual({ sign: 1, count: 1, sides: 8 })
    expect(firstDie([{ terms: [{ sign: 1, flat: 5 }] }, ...parts])).toBe(
      undefined,
    )
    expect(
      firstDie([{ terms: [{ sign: -1, count: 1, sides: 4 }] }]),
    ).toBeUndefined()
    expect(firstDie([])).toBeUndefined()
  })

  it('adds dice to the first, as many for each as the game throws, and makes it another size', () => {
    expect(withModifiers(parts, { extra: 2, faces: 12 })).toEqual([
      { terms: [{ sign: 1, count: 3, sides: 12 }], type: 'Necrotic' },
      parts[1],
    ])
    // A critical hit's dice, which the game doubled, take two for each added.
    expect(withModifiers(parts, { extra: 1 }, 2)[0].terms).toEqual([
      { sign: 1, count: 3, sides: 8 },
    ])
    // Its highest leaves the dice as they are; so does damage with no first die.
    expect(withModifiers(parts, { maximize: true })).toBe(parts)
    const flat = [{ terms: [{ sign: 1 as const, flat: 5 }] }]
    expect(withModifiers(flat, { extra: 2 })).toBe(flat)
  })

  it("changes the dice the game said its damage throws: its first roll's first die", () => {
    expect(modifiedDice(critical)).toEqual([
      { faces: 8, number: 2 },
      { faces: 6, number: 2 },
    ])
    expect(modifiedDice(critical, { extra: 1, faces: 10 })).toEqual([
      { faces: 10, number: 4 },
      { faces: 6, number: 2 },
    ])
    expect(modifiedDice(critical, { maximize: true })).toEqual([
      { faces: 8, number: 2 },
      { faces: 6, number: 2 },
    ])
    // As from a module before 0.13.0, one for each.
    const older = {
      ...critical,
      rolls: critical.rolls.map(roll => ({ ...roll, perDie: undefined })),
    }
    expect(modifiedDice(older, { extra: 1 })?.[0]).toEqual({
      faces: 8,
      number: 3,
    })
    // None for damage the game rolls itself; nothing to change without a first die.
    expect(
      modifiedDice({ ...critical, plannable: false }, { extra: 1 }),
    ).toEqual([])
    expect(
      modifiedDice(
        { ...critical, rolls: [{ ...critical.rolls[0], dice: [] }] },
        { extra: 1 },
      ),
    ).toBeUndefined()
  })

  it('adds no more dice than one roll may throw, a critical hit taking two for each', () => {
    expect(mostExtra(parts)).toBe(39)
    expect(mostExtra(parts, 2)).toBe(19)
    expect(mostExtra([{ terms: [{ sign: 1, flat: 5 }] }])).toBe(0)
  })

  /** 2d6 + 3, less 1d4: a part with a term of dice taken away. */
  const less = [
    {
      terms: [
        { sign: 1 as const, count: 2, sides: 6 as const },
        { sign: 1 as const, flat: 3 },
        { sign: -1 as const, count: 1, sides: 4 as const },
      ],
      type: 'Fire',
    },
    parts[0],
  ]

  it("makes damage a critical hit's as a world's rules make it", () => {
    // dnd5e's by default: every die twice, the numbers once.
    expect(
      criticalParts(less, {
        perDie: 2,
        multiplyNumeric: false,
        powerfulCritical: false,
        altered: false,
      }),
    ).toEqual([
      {
        terms: [
          { sign: 1, count: 4, sides: 6 },
          { sign: 1, flat: 3 },
          { sign: -1, count: 2, sides: 4 },
        ],
        type: 'Fire',
      },
      { terms: [{ sign: 1, count: 2, sides: 8 }], type: 'Necrotic' },
    ])
    // The numbers twice too.
    expect(
      criticalParts(less, {
        perDie: 2,
        multiplyNumeric: true,
        powerfulCritical: false,
        altered: false,
      })[0].terms[1],
    ).toEqual({ sign: 1, flat: 6 })
    // Under Powerful Critical: the dice once, and the most each part's could roll added, as dnd5e
    // adds it, whatever their sign.
    expect(
      criticalParts(less, {
        perDie: 1,
        multiplyNumeric: false,
        powerfulCritical: true,
        altered: false,
      }),
    ).toEqual([
      { ...less[0], terms: [...less[0].terms, { sign: 1, flat: 16 }] },
      { ...parts[0], terms: [...parts[0].terms, { sign: 1, flat: 8 }] },
    ])
    // A part of numbers alone has nothing to add.
    const flat = [{ terms: [{ sign: 1 as const, flat: 5 }] }]
    expect(
      criticalParts(flat, {
        perDie: 1,
        multiplyNumeric: false,
        powerfulCritical: true,
        altered: false,
      }),
    ).toEqual(flat)
  })

  it("plans a description's damage as an attack's preview has it: its parts' dice, a critical hit's as many times as the world's rules throw each", () => {
    const link = {
      parts: [
        { formula: '2d6 + 3 - 1d4', types: ['fire'] },
        { formula: '5', types: [] },
        { formula: '1d8', types: [] },
      ],
      healing: false,
    }

    expect(linkDamage(link)).toEqual({
      critical: false,
      plannable: true,
      healing: false,
      rolls: [
        {
          formula: '2d6 + 3 - 1d4',
          type: null,
          perDie: 1,
          dice: [
            { faces: 6, number: 2 },
            { faces: 4, number: 1 },
          ],
        },
        { formula: '5', type: null, perDie: 1, dice: [] },
        {
          formula: '1d8',
          type: null,
          perDie: 1,
          dice: [{ faces: 8, number: 1 }],
        },
      ],
    })
    const doubled = linkDamage(link, {
      perDie: 2,
      multiplyNumeric: false,
      powerfulCritical: false,
      altered: false,
    })
    expect(doubled).toMatchObject({ critical: true })
    // One die more is two more, of its first roll's first die.
    expect(doubled && modifiedDice(doubled, { extra: 1 })).toEqual([
      { faces: 6, number: 6 },
      { faces: 4, number: 2 },
      { faces: 8, number: 2 },
    ])
    // None for a part the app can't read.
    expect(
      linkDamage({
        ...link,
        parts: [...link.parts, { formula: '1d3', types: [] }],
      }),
    ).toBeUndefined()
  })
  describe('what a critical hit adds', () => {
    /** A greataxe's 1d12 + 4, to which Savage Attacks adds a die, and the weapon 1d6. */
    const greataxe = {
      parts: [{ formula: '1d12 + 4', types: ['slashing'] }],
      healing: false,
      criticalAdds: { dice: [1], damage: ['1d6'] },
    }

    const POWERFUL: CriticalRule = {
      perDie: 1,
      multiplyNumeric: false,
      powerfulCritical: true,
      altered: false,
      bonusDice: 'rolled',
    }

    it.each<[string, CriticalRule, string]>([
      [
        'as dnd5e does by default, its extra die thrown',
        EVERY_DIE_TWICE,
        '3d12 + 4 + 1d6',
      ],
      [
        'under Powerful Critical, its extra die thrown',
        POWERFUL,
        '2d12 + 4 + 12 + 1d6',
      ],
      [
        'with its numbers doubled',
        { ...EVERY_DIE_TWICE, multiplyNumeric: true },
        '3d12 + 8 + 1d6',
      ],
      [
        'its extra die at its most, as Midi-QOL’s maxCrit',
        { ...POWERFUL, bonusDice: 'maximized' },
        '1d12 + 4 + 12 + 12 + 1d6',
      ],
      [
        'its extra die left out, as Midi-QOL’s rules that ignore it',
        { ...POWERFUL, powerfulCritical: false, bonusDice: 'ignored' },
        '1d12 + 4 + 1d6',
      ],
    ])('adds them %s', (_, rule, formula) => {
      const adds = criticalOffered(greataxe, rule)
      expect(adds).toEqual({
        dice: [1],
        damage: [[{ sign: 1, count: 1, sides: 6 }]],
      })
      const thrown = criticalParts(
        [partOf('1d12 + 4')],
        rule,
        adds || undefined,
      )
      expect(written(thrown)).toBe(formula)
      // The critical damage's dice are marked, never its first die.
      expect(thrown[0].terms.at(-1)).toEqual({
        sign: 1,
        count: 1,
        sides: 6,
        added: true,
      })
    })

    it('throws its extra dice at the size its first die is made, once changed', () => {
      const adds = criticalOffered(greataxe, EVERY_DIE_TWICE)
      const changed = withModifiers([partOf('1d12 + 4')], {
        extra: 1,
        faces: 10,
      })
      expect(
        written(criticalParts(changed, EVERY_DIE_TWICE, adds || undefined)),
      ).toBe('5d10 + 4 + 1d6')
    })

    it('plans its dice as the game will throw them, the critical damage’s marked, and changes only its own first die', () => {
      const adds = criticalOffered(greataxe, EVERY_DIE_TWICE) || undefined
      const preview = linkDamage(greataxe, EVERY_DIE_TWICE, adds)
      expect(preview).toEqual({
        critical: true,
        plannable: true,
        healing: false,
        rolls: [
          {
            formula: '1d12 + 4',
            type: null,
            perDie: 2,
            dice: [
              { faces: 12, number: 3 },
              { faces: 6, number: 1, added: true },
            ],
          },
        ],
      })
      expect(preview && modifiedDice(preview, { extra: 1, faces: 10 })).toEqual(
        [
          { faces: 10, number: 5 },
          { faces: 6, number: 1, added: true },
        ],
      )
    })

    it('adds no more dice than one roll may throw, its extra dice counted', () => {
      // Brutal Critical's three extra dice on 2d6 make 7d6: eight more of it fit, twice each.
      const adds = { dice: [3], damage: [[]] }
      expect(
        mostExtra(criticalParts([partOf('2d6')], EVERY_DIE_TWICE, adds), 2),
      ).toBe(16)
    })

    it('never takes a die of critical damage as the first die', () => {
      const added = {
        sign: 1 as const,
        count: 1,
        sides: 6 as const,
        added: true as const,
      }
      expect(
        firstDie([{ terms: [{ sign: 1, flat: 3 }, added] }]),
      ).toBeUndefined()
      expect(
        firstDie([{ terms: [added, { sign: 1, count: 2, sides: 8 }] }]),
      ).toEqual({ sign: 1, count: 2, sides: 8 })
      // Nor does a change go to it.
      expect(withModifiers([{ terms: [added] }], { extra: 1 })).toEqual([
        { terms: [added] },
      ])
    })

    it('changes no die of critical damage in the game’s preview, and nothing where its first roll has no die of its own', () => {
      // "3 + 1d6": a number, and the weapon's critical damage.
      const numbers: DamagePreview = {
        critical: true,
        plannable: true,
        rolls: [
          {
            formula: '3 + 1d6',
            type: 'Bludgeoning',
            dice: [{ faces: 6, number: 1, added: true }],
            perDie: 2,
          },
        ],
      }
      expect(modifiedDice(numbers)).toEqual([
        { faces: 6, number: 1, added: true },
      ])
      expect(modifiedDice(numbers, { maximize: true })).toEqual([
        { faces: 6, number: 1, added: true },
      ])
      expect(modifiedDice(numbers, { extra: 1 })).toBeUndefined()
      expect(modifiedDice(numbers, { faces: 8 })).toBeUndefined()
      // Its own die changed where it is, after the critical damage's, as Midi-QOL may place them.
      expect(
        modifiedDice(
          {
            ...numbers,
            rolls: [
              {
                ...numbers.rolls[0],
                dice: [
                  { faces: 6, number: 1, added: true },
                  { faces: 8, number: 2 },
                ],
              },
            ],
          },
          { extra: 1 },
        ),
      ).toEqual([
        { faces: 6, number: 1, added: true },
        { faces: 8, number: 4 },
      ])
    })

    it('offers a critical hit with nothing added where its link says nothing, as before', () => {
      expect(
        criticalOffered(
          {
            parts: [
              { formula: '2d6 + 3', types: [] },
              { formula: '1d4', types: [] },
            ],
            healing: false,
          },
          { ...EVERY_DIE_TWICE, bonusDice: undefined },
        ),
      ).toEqual({ dice: [0, 0], damage: [[], []] })
    })

    it.each<[string, CriticalRule['bonusDice']]>([
      ['can’t say', null],
      ['is from a module before 0.20.0', undefined],
    ])(
      'offers additions of numbers alone where the world’s rule %s, but none with dice',
      (_, bonusDice) => {
        const rule = { ...EVERY_DIE_TWICE, bonusDice }
        // A javelin's +4.
        const javelin = {
          parts: [{ formula: '1d6 + 4', types: [] }],
          healing: false,
          criticalAdds: { dice: [0], damage: ['4'] },
        }
        expect(criticalOffered(javelin, rule)).toEqual({
          dice: [0],
          damage: [[{ sign: 1, flat: 4 }]],
        })
        expect(
          written(
            criticalParts(
              [partOf('1d6 + 4')],
              rule,
              criticalOffered(javelin, rule) || undefined,
            ),
          ),
        ).toBe('2d6 + 4 + 4')
        expect(criticalOffered(greataxe, rule)).toBe(false)
        expect(
          criticalOffered(
            { ...greataxe, criticalAdds: { dice: [1], damage: [''] } },
            rule,
          ),
        ).toBe(false)
        expect(
          criticalOffered(
            { ...greataxe, criticalAdds: { dice: [0], damage: ['1d6'] } },
            rule,
          ),
        ).toBe(false)
      },
    )

    it.each<
      [
        string,
        Parameters<typeof criticalOffered>[0],
        CriticalRule | null | undefined,
      ]
    >([
      ['for healing', { ...greataxe, healing: true }, EVERY_DIE_TWICE],
      [
        'for damage the game marks as never a critical hit’s',
        { ...greataxe, critical: false, criticalAdds: undefined },
        EVERY_DIE_TWICE,
      ],
      [
        'where the sheet doesn’t say how the world makes one',
        greataxe,
        undefined,
      ],
      ['where it says the world can’t', greataxe, null],
      [
        'with extra dice for a part whose first term is a number',
        {
          ...greataxe,
          parts: [{ formula: '3 + 1d6', types: [] }],
          criticalAdds: { dice: [1], damage: [''] },
        },
        EVERY_DIE_TWICE,
      ],
      [
        'with extra dice for a part whose first dice are taken away',
        {
          ...greataxe,
          parts: [{ formula: '-1d4 + 2d6', types: [] }],
          criticalAdds: { dice: [1], damage: [''] },
        },
        EVERY_DIE_TWICE,
      ],
      [
        'with critical damage the app can’t read',
        { ...greataxe, criticalAdds: { dice: [1], damage: ['1d3'] } },
        EVERY_DIE_TWICE,
      ],
      [
        'with a part the app can’t read',
        { ...greataxe, parts: [{ formula: '1d3 + 4', types: [] }] },
        EVERY_DIE_TWICE,
      ],
      [
        'where a die would be thrown more than 40 times',
        { ...greataxe, parts: [{ formula: '20d12', types: [] }] },
        EVERY_DIE_TWICE,
      ],
      [
        'where it would throw more than 20 kinds of dice',
        {
          parts: Array.from({ length: 10 }, () => ({
            formula: '1d4 + 1d6',
            types: [],
          })),
          healing: false,
          criticalAdds: {
            dice: Array.from({ length: 10 }, () => 0),
            damage: ['1d8', ...Array.from({ length: 9 }, () => '')],
          },
        },
        EVERY_DIE_TWICE,
      ],
    ])('offers no critical hit %s', (_, link, rule) => {
      expect(criticalOffered(link, rule)).toBe(false)
    })

    it('offers one up to the most one roll may throw', () => {
      // 19d12, twice, and one die more: 39.
      expect(
        criticalOffered(
          { ...greataxe, parts: [{ formula: '19d12', types: [] }] },
          EVERY_DIE_TWICE,
        ),
      ).toEqual({ dice: [1], damage: [[{ sign: 1, count: 1, sides: 6 }]] })
      // Extra dice the rules leave out add nothing.
      expect(
        criticalOffered(
          { ...greataxe, parts: [{ formula: '20d12', types: [] }] },
          { ...EVERY_DIE_TWICE, bonusDice: 'ignored' },
        ),
      ).not.toBe(false)
    })
  })
})
