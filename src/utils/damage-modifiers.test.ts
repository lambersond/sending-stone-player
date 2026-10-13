/* eslint-disable unicorn/no-null -- a preview's roll of no kind of its own has null */
import {
  changedAt,
  changes,
  criticalOffered,
  criticalParts,
  damageChanges,
  diceTakenAway,
  EVERY_DIE_TWICE,
  firstDie,
  formulaTakesAway,
  linkDamage,
  marksTaken,
  modifiedDice,
  MOST_DICE,
  mostExtra,
  reshapes,
  sameFirstDie,
  signedDice,
  takenModifiers,
  takesAway,
  unmaximizable,
  withModifiers,
  type DamageModifiers,
} from './damage-modifiers'
import { formulaTerms } from '@/utils/formulas'
import type {
  CriticalRule,
  DamagePreview,
  DamagePreviewRoll,
} from '@/types/sending-stone'
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

/** A description's link to damage of one part, of this formula. */
const linkOf = (formula: string) => ({
  parts: [{ formula, types: [] }],
  healing: false,
})

/** The game's preview of damage of one roll of this formula, its dice as said. */
const rolledAs = (
  formula: string,
  dice: DamagePreviewRoll['dice'],
  plannable = true,
): DamagePreview => ({
  critical: false,
  plannable,
  rolls: [{ formula, type: 'slashing', dice }],
})

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
          // The die it takes away is marked so, as the game marks it.
          dice: [
            { faces: 6, number: 2 },
            { faces: 4, number: 1, subtracted: true },
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
      { faces: 4, number: 2, subtracted: true },
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

  describe('dice the damage takes away', () => {
    /** -1d4 + 2d6, as a hand-typed formula has it: a die taken away first, then dice it adds. */
    const leading = [partOf('-1d4 + 2d6')]

    const POWERFUL: CriticalRule = {
      ...EVERY_DIE_TWICE,
      perDie: 1,
      powerfulCritical: true,
    }

    /** The game's preview of damage of one roll. */
    const previewOf = (
      formula: string,
      dice: DamagePreviewRoll['dice'],
      perDie = 1,
    ): DamagePreview => ({
      critical: perDie > 1,
      plannable: true,
      rolls: [{ formula, type: 'Necrotic', dice, perDie }],
    })

    /** -1d4 + 2d6 from module 0.21.0, which marks the d4 it takes away. */
    const marked = previewOf('- 1d4 + 2d6', [
      { faces: 4, number: 1, subtracted: true },
      { faces: 6, number: 2 },
    ])

    /** The same from a module before, which marks nothing. */
    const unmarked = previewOf('- 1d4 + 2d6', [
      { faces: 4, number: 1 },
      { faces: 6, number: 2 },
    ])

    /** A Reduced Unarmed Strike: 1 + 3, less 1d4, which adds no die of its own. */
    const unarmed = previewOf('1 + 3 - 1d4', [
      { faces: 4, number: 1, subtracted: true },
    ])

    it('changes the first die damage adds, never one it takes away', () => {
      expect(firstDie(leading)).toEqual({ sign: 1, count: 2, sides: 6 })
      expect(withModifiers(leading, { extra: 1 })[0].terms).toEqual([
        { sign: -1, count: 1, sides: 4 },
        { sign: 1, count: 3, sides: 6 },
      ])
      expect(withModifiers(leading, { faces: 12 })[0].terms).toEqual([
        { sign: -1, count: 1, sides: 4 },
        { sign: 1, count: 2, sides: 12 },
      ])
      expect(mostExtra(leading)).toBe(MOST_DICE - 2)
    })

    it('reads the dice a roll takes away as the game marks them, or else as its formula has them', () => {
      expect(marksTaken(marked)).toBe(true)
      expect(marksTaken(unmarked)).toBe(false)
      expect(signedDice(marked.rolls[0], true)).toBe(marked.rolls[0].dice)
      // From a module before 0.21.0, its formula's signs, where it throws those dice.
      expect(signedDice(unmarked.rolls[0], false)).toEqual([
        { faces: 4, number: 1, subtracted: true },
        { faces: 6, number: 2 },
      ])
      // A formula the app can't read, or one that throws other dice, leaves them as they are.
      const unreadable: DamagePreviewRoll = {
        formula: '1d4ro - 1d4',
        type: null,
        dice: [
          { faces: 4, number: 1 },
          { faces: 4, number: 1 },
        ],
      }
      expect(signedDice(unreadable, false)).toBe(unreadable.dice)
      const mismatched: DamagePreviewRoll = {
        formula: '- 2d6',
        type: null,
        dice: [{ faces: 6, number: 3 }],
      }
      expect(signedDice(mismatched, false)).toBe(mismatched.dice)
    })

    it.each<[string, DamagePreview, number]>([
      ['the die it adds, after one the game marks taken away', marked, 1],
      [
        'none, from a module before 0.21.0 that would change the die it takes away',
        unmarked,
        -1,
      ],
      [
        'its first die, from a module before 0.21.0, where that is one it adds',
        previewOf('1d8 - 1d4 + 3', [
          { faces: 8, number: 1 },
          { faces: 4, number: 1 },
        ]),
        0,
      ],
      ['none, where it adds no die of its own', unarmed, -1],
      [
        'none, where the only die it adds is critical damage',
        previewOf(
          '1 + 3 - 2d4 + 1d4',
          [
            { faces: 4, number: 2, subtracted: true },
            { faces: 4, number: 1, added: true },
          ],
          2,
        ),
        -1,
      ],
      [
        'the die after one marked both critical damage and taken away',
        previewOf('1d8min8 - 1d4min4 + 1d8', [
          { faces: 4, number: 1, added: true, subtracted: true },
          { faces: 8, number: 1 },
        ]),
        1,
      ],
      ['none, for damage of no roll', { ...marked, rolls: [] }, -1],
    ])('finds where its first die is: %s', (_, damage, at) => {
      expect(changedAt(damage)).toBe(at)
      // An attack's or a use's, as its preview's marks say what the game changes.
      expect(changedAt(damage, marksTaken(damage))).toBe(at)
    })

    it.each<[string, number, number]>([
      ['3 - 1d4 + 2d6', 1, -1],
      ['1d12 - 1d4 + 3', 0, 0],
      ['- 1d4 + 4', -1, -1],
    ])(
      "finds where a description's first die is, %s, as the game changes only one it adds, or its first whatever its sign",
      (formula, signed, unsigned) => {
        const preview = linkDamage(linkOf(formula))
        expect(preview && changedAt(preview, true)).toBe(signed)
        expect(preview && changedAt(preview, false)).toBe(unsigned)
      },
    )

    it("changes a description's die it adds only where the game changes that one", () => {
      const preview = linkDamage(linkOf('3 - 1d4 + 2d6'))
      expect(preview && modifiedDice(preview, { extra: 1 }, true)).toEqual([
        { faces: 4, number: 1, subtracted: true },
        { faces: 6, number: 3 },
      ])
      // A module before 0.21.0 would throw a d4 more.
      expect(
        preview && modifiedDice(preview, { extra: 1 }, false),
      ).toBeUndefined()
    })

    it.each<[string, { terms: ExtraTerm[] }[], boolean]>([
      [
        'a number, then a die taken away, then one it adds',
        [partOf('3 - 1d4 + 2d6')],
        false,
      ],
      ['a die it adds first', [partOf('1d12 - 1d4 + 3')], true],
      ['its only die taken away', [partOf('- 1d4 + 4')], false],
      ['no die', [partOf('5')], false],
      [
        'only critical damage',
        [{ terms: [{ sign: 1, count: 1, sides: 4, added: true }] }],
        false,
      ],
      ['a die and a number', [partOf('1d8 + 3')], true],
    ])(
      'says whether its first die is the one a module before 0.21.0 changes: %s',
      (_, thrown, same) => {
        expect(sameFirstDie(thrown)).toBe(same)
      },
    )

    describe('changes chosen before the game said what it throws', () => {
      /** A Reduced greataxe's 1d12 + 3 - 1d4, as module 0.21.0 marks it. */
      const greataxe = previewOf('1d12 + 3 - 1d4', [
        { faces: 12, number: 1 },
        { faces: 4, number: 1, subtracted: true },
      ])

      it.each<
        [string, DamagePreview, DamageModifiers, DamageModifiers | undefined]
      >([
        [
          'none where it adds no die of its own',
          unarmed,
          { extra: 1 },
          undefined,
        ],
        [
          'its die changed, never at its highest where it takes a die away',
          greataxe,
          { extra: 1, maximize: true },
          { extra: 1 },
        ],
        [
          'none at its highest where it takes a die away',
          greataxe,
          { maximize: true },
          undefined,
        ],
        [
          'all of them where it takes nothing away',
          previewOf('1d8 + 3', [{ faces: 8, number: 1 }]),
          { maximize: true, faces: 10 },
          { maximize: true, faces: 10 },
        ],
        [
          'none from a module before 0.21.0 that would change the die it takes away',
          unmarked,
          { extra: 1 },
          undefined,
        ],
        [
          'all of them where the game rolls it itself',
          {
            ...unmarked,
            plannable: false,
            rolls: [{ ...unmarked.rolls[0], dice: [] }],
          },
          { extra: 1 },
          { extra: 1 },
        ],
        [
          'its dice, never at its highest, where the game rolls itself damage whose formula takes a die away',
          {
            ...unmarked,
            plannable: false,
            rolls: [
              { ...unmarked.rolls[0], formula: '1d3 + 3 - 1d4', dice: [] },
            ],
          },
          { extra: 1, maximize: true },
          { extra: 1 },
        ],
        [
          'none at its highest where the game rolls itself damage whose formula takes a die away',
          {
            ...unmarked,
            plannable: false,
            rolls: [
              { ...unmarked.rolls[0], formula: '1d3 + 3 - 1d4', dice: [] },
            ],
          },
          { maximize: true },
          undefined,
        ],
        [
          'at its highest where the game rolls itself damage that takes none away',
          {
            ...unmarked,
            plannable: false,
            rolls: [{ ...unmarked.rolls[0], formula: '1d3 + 3', dice: [] }],
          },
          { maximize: true },
          { maximize: true },
        ],
        [
          'as many more dice as its die cast higher may still take, as Cure Wounds at 3rd level, whose label had 2d8',
          previewOf('6d8 + 3', [{ faces: 8, number: 6 }]),
          { extra: 38 },
          { extra: MOST_DICE - 6 },
        ],
        [
          'as many as Fireball at 9th level may still take, whose label had 8d6',
          previewOf('14d6', [{ faces: 6, number: 14 }]),
          { extra: 32, faces: 8 },
          { extra: MOST_DICE - 14, faces: 8 },
        ],
        [
          'as many as a critical hit may still take, two for each',
          previewOf('2d12 + 3', [{ faces: 12, number: 2 }], 2),
          { extra: 20 },
          { extra: 19 },
        ],
        [
          'its die another size, but no more of it, where it may take none',
          previewOf(`${MOST_DICE}d6`, [{ faces: 6, number: MOST_DICE }]),
          { extra: 1, faces: 8 },
          { faces: 8 },
        ],
        [
          'none where its die may take no more',
          previewOf(`${MOST_DICE}d6`, [{ faces: 6, number: MOST_DICE }]),
          { extra: 1 },
          undefined,
        ],
      ])('keeps those the game takes: %s', (_, damage, chosen, kept) => {
        expect(takenModifiers(damage, chosen)).toEqual(kept)
        // What they throw is never more of a die than one roll may.
        const thrown = kept && modifiedDice(damage, kept)
        expect((thrown ?? []).every(die => die.number <= MOST_DICE)).toBe(true)
      })

      it('keeps none where none were chosen', () => {
        expect(takenModifiers(greataxe)).toBeUndefined()
        expect(takenModifiers(critical)).toBeUndefined()
      })
    })

    it('changes the dice the game said, never a die damage takes away', () => {
      expect(modifiedDice(marked, { extra: 1 })).toEqual([
        { faces: 4, number: 1, subtracted: true },
        { faces: 6, number: 3 },
      ])
      expect(modifiedDice(marked, { faces: 12 })).toEqual([
        { faces: 4, number: 1, subtracted: true },
        { faces: 12, number: 2 },
      ])
      // Nothing to change from a module that would change the d4, nor where it adds no die.
      expect(modifiedDice(unmarked, { extra: 1 })).toBeUndefined()
      expect(modifiedDice(unarmed, { extra: 1 })).toBeUndefined()
      // A critical hit's, the d4 doubled too, as dnd5e doubles it: two more for one.
      const critical = previewOf(
        '- 2d4 + 4d6',
        [
          { faces: 4, number: 2, subtracted: true },
          { faces: 6, number: 4 },
        ],
        2,
      )
      expect(modifiedDice(critical, { extra: 1 })).toEqual([
        { faces: 4, number: 2, subtracted: true },
        { faces: 6, number: 6 },
      ])
      // At its highest alone, the dice it said, as they are.
      expect(modifiedDice(marked, { maximize: true })).toEqual(
        marked.rolls[0].dice,
      )
      expect(modifiedDice(unmarked, { maximize: true })).toEqual(
        unmarked.rolls[0].dice,
      )
    })

    it('says whether damage takes any of its dice away, as the game marks them or its formula has them', () => {
      expect(diceTakenAway(marked)).toBe(true)
      expect(diceTakenAway(unmarked)).toBe(true)
      expect(diceTakenAway(unarmed)).toBe(true)
      // In a roll after its first.
      expect(
        diceTakenAway({
          ...marked,
          rolls: [
            {
              formula: '1d8 + 3',
              type: 'Slashing',
              dice: [{ faces: 8, number: 1 }],
            },
            {
              formula: '- 1d4',
              type: 'Slashing',
              dice: [{ faces: 4, number: 1 }],
            },
          ],
        }),
      ).toBe(true)
      expect(
        diceTakenAway(previewOf('1d8 + 3', [{ faces: 8, number: 1 }])),
      ).toBe(false)
      // Damage the game rolls itself has no dice of its own here: its formula says.
      const itself = (formula: string): DamagePreview => ({
        ...unmarked,
        plannable: false,
        rolls: [{ ...unmarked.rolls[0], formula, dice: [] }],
      })
      expect(diceTakenAway(itself('- 1d4 + 2d6'))).toBe(true)
      expect(diceTakenAway(itself('1d3 + 3 - 1d4'))).toBe(true)
      expect(diceTakenAway(itself('1d3 + 3'))).toBe(false)
    })

    // The module's own table (attacks.mjs) reads each the same.
    it.each<[string, boolean]>([
      ['1d3 + 3 - 1d4', true],
      ['1d3 + 3', false],
      ['1d3 - 1', false],
      ['1d3 + -1', false],
      ['-1 + 1d3', false],
      ['-1d4 + 2d6', true],
      ['(1d4 * -1) + 2d6', true],
      ['- - 1d4 + 1d3', false],
      ['5 - 2 * 1d4', true],
      ['1d6 - 1d4 * -1', false],
      ['1d6 - (1 - 1d4)', false],
      ['1d3 - (1d4 + 1)', true],
      ['(floor(3 / 2))d8 + 3 - 1d8', true],
      ['max(1d3 - 1, 1)', false],
      ['1d3[bludgeoning] + 3 - 1d4[necrotic]', true],
      ['1d3[non-magical] + 3', false],
      ['2d6r<=2 + 7 + 1d8', false],
    ])(
      'reads whether a formula the game rolls itself takes a die away: %s',
      (formula, taken) => {
        expect(formulaTakesAway(formula)).toBe(taken)
      },
    )

    it('offers damage the game rolls itself at its highest only where it takes no die away', () => {
      const none = [{ terms: [] }]
      expect(damageChanges(none)).toEqual(['maximize'])
      expect(damageChanges(none, false, true)).toEqual([])
    })

    it.each<[string, string[], ReturnType<typeof damageChanges>]>([
      [
        'damage that takes nothing away',
        ['1d8 + 3'],
        ['maximize', 'modify-damage'],
      ],
      ['damage that takes its only die away', ['-1d4 + 4'], []],
      [
        'damage that takes a die away after its first',
        ['1d12 + 3 - 1d4'],
        ['modify-damage'],
      ],
      [
        'a second part that takes a die away',
        ['1d8', '- 1d4'],
        ['modify-damage'],
      ],
    ])('offers changes to %s', (_, formulas, ways) => {
      const thrown = formulas.map(formula => partOf(formula))
      expect(takesAway(thrown)).toBe(!ways.includes('maximize'))
      expect(damageChanges(thrown)).toEqual(ways)
      // Dice the game won't change are only ever at their highest.
      expect(damageChanges(thrown, true)).toEqual(
        ways.filter(way => way === 'maximize'),
      )
    })

    it('marks the dice a description takes away in its preview, critical damage among them', () => {
      expect(linkDamage(linkOf('- 1d4 + 4'))?.rolls[0].dice).toEqual([
        { faces: 4, number: 1, subtracted: true },
      ])
      expect(
        linkDamage(linkOf('3 - 1d4 + 2d6'), EVERY_DIE_TWICE)?.rolls[0].dice,
      ).toEqual([
        { faces: 4, number: 2, subtracted: true },
        { faces: 6, number: 4 },
      ])
      // Critical damage taken away, as written after a minus.
      const link = {
        ...linkOf('1d8'),
        criticalAdds: { dice: [0], damage: ['- 1d4'] },
      }
      const adds = criticalOffered(link, EVERY_DIE_TWICE) || undefined
      expect(linkDamage(link, EVERY_DIE_TWICE, adds)?.rolls[0].dice).toEqual([
        { faces: 8, number: 2 },
        { faces: 4, number: 1, added: true, subtracted: true },
      ])
    })

    it('offers no critical hit under Powerful Critical where a part takes a die away', () => {
      expect(criticalOffered(linkOf('- 1d4 + 4'), POWERFUL)).toBe(false)
      expect(criticalOffered(linkOf('3 - 1d4 + 2d6'), POWERFUL)).toBe(false)
      expect(criticalOffered(linkOf('1d8 + 3'), POWERFUL)).toEqual({
        dice: [0],
        damage: [[]],
      })
      expect(criticalOffered(linkOf('3 - 1d4 + 2d6'), EVERY_DIE_TWICE)).toEqual(
        { dice: [0], damage: [[]] },
      )
      // As dnd5e 5.3.3 makes one: the most of a die taken away added.
      expect(criticalParts([partOf('-1d4 + 4')], POWERFUL)[0].terms).toEqual([
        { sign: -1, count: 1, sides: 4 },
        { sign: 1, flat: 4 },
        { sign: 1, flat: 4 },
      ])
    })
  })

  describe('dice Foundry works out once thrown', () => {
    /** Great Weapon Fighting's 2d6r<=2 + 7, as a part. */
    const greatsword = [partOf('2d6r<=2 + 7')]

    it('offers its highest unless a die explodes or is rerolled on its highest face', () => {
      expect(damageChanges(greatsword)).toEqual(['maximize', 'modify-damage'])
      expect(damageChanges([partOf('4d6kh3')])).toEqual([
        'maximize',
        'modify-damage',
      ])
      expect(damageChanges([partOf('1d6x + 2')])).toEqual(['modify-damage'])
      expect(damageChanges([partOf('1d8 + 1d6xo')])).toEqual(['modify-damage'])
      expect(damageChanges([partOf('2d6r6')])).toEqual(['modify-damage'])
      expect(unmaximizable([partOf('1d6x')])).toBe(true)
      expect(unmaximizable(greatsword)).toBe(false)
    })

    it("reads the game's preview by its formulas, or one it can't read as it seems to explode", () => {
      expect(
        unmaximizable(rolledAs('1d6x + 2', [{ faces: 6, number: 1 }])),
      ).toBe(true)
      expect(
        unmaximizable(rolledAs('2d6r<=2 + 7', [{ faces: 6, number: 2 }])),
      ).toBe(false)
      expect(unmaximizable(rolledAs('(1d6x>4) * 2', [], false))).toBe(true)
      expect(unmaximizable(rolledAs('(1d6) * 2', [], false))).toBe(false)
    })

    it('takes no highest the game refuses for dice that explode', () => {
      const exploding = rolledAs('1d6x + 2', [{ faces: 6, number: 1 }])
      expect(takenModifiers(exploding, { maximize: true })).toBeUndefined()
      expect(takenModifiers(exploding, { maximize: true, extra: 1 })).toEqual({
        extra: 1,
      })
      expect(
        takenModifiers(rolledAs('2d6r<=2 + 7', [{ faces: 6, number: 2 }]), {
          maximize: true,
        }),
      ).toEqual({ maximize: true })
    })

    it('keeps what Foundry does with a die as it is changed, doubled or made a critical hit’s', () => {
      expect(
        withModifiers(greatsword, { extra: 1, faces: 8 })[0].terms,
      ).toEqual([
        { sign: 1, count: 3, sides: 8, modifiers: ['r<=2'] },
        { sign: 1, flat: 7 },
      ])
      expect(criticalParts(greatsword, EVERY_DIE_TWICE)[0].terms).toEqual([
        { sign: 1, count: 4, sides: 6, modifiers: ['r<=2'] },
        { sign: 1, flat: 7 },
      ])
    })

    it('offers no critical hit under Powerful Critical where a die is kept, dropped, counted or held to a least or most', () => {
      const POWERFUL: CriticalRule = {
        ...EVERY_DIE_TWICE,
        perDie: 1,
        powerfulCritical: true,
      }
      for (const formula of [
        '4d6kh3',
        '4d6dl',
        '2d6min2',
        '2d6max5',
        '6d6cs>=5',
      ]) {
        expect(criticalOffered(linkOf(formula), POWERFUL)).toBe(false)
        expect(criticalOffered(linkOf(formula), EVERY_DIE_TWICE)).toEqual({
          dice: [0],
          damage: [[]],
        })
      }
      expect(criticalOffered(linkOf('2d6r<=2 + 7'), POWERFUL)).toEqual({
        dice: [0],
        damage: [[]],
      })
    })

    it('reads the dice a roll takes away from a formula with modifiers too', () => {
      expect(
        signedDice(
          {
            formula: '2d6r<=2 - 1d4',
            type: null,
            dice: [
              { faces: 6, number: 2 },
              { faces: 4, number: 1 },
            ],
          },
          false,
        ),
      ).toEqual([
        { faces: 6, number: 2 },
        { faces: 4, number: 1, subtracted: true },
      ])
    })
  })
})
