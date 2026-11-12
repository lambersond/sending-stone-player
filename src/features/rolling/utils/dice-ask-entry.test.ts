import { answeredRoll, answerOf, askEntry, diceWords } from './dice-ask-entry'
import { sparksAgain, tableIceKnife, twoRollsAsk } from '@/mocks/dice-asks'
import type { TableDiceAsk } from '@/types/table'

/** One roll of cold damage, by its formula, of so many d6s. */
const cold = (formula: string, number = 2) => ({
  rolls: [{ formula, type: 'cold', terms: [{ faces: 6 as const, number }] }],
})

describe('features/rolling/utils/dice-ask-entry (module 0.44.0)', () => {
  describe('askEntry', () => {
    it('asks for each term of each roll, each skippable, named by its kind, until its wait ends', () => {
      const signal = new AbortController().signal
      const entry = askEntry(twoRollsAsk(), signal)

      expect(entry).toMatchObject({
        title: 'Ice Knife: Shard Explosion',
        subtitle: 'The game asks for these dice',
        cancelLabel: 'Let the game roll',
        until: twoRollsAsk().expiresAt,
        signal,
        terms: [
          {
            sides: 6,
            count: 3,
            label: '3d6 Cold',
            skippable: true,
            name: 'Cold',
          },
          {
            sides: 4,
            count: 1,
            label: '1d4 Fire',
            skippable: true,
            name: 'Fire',
          },
          {
            sides: 6,
            count: 1,
            label: '1d6 Fire',
            skippable: true,
            name: 'Fire',
          },
        ],
      })
      // The dice typed so far, the game adding what its formulas add.
      expect(entry.total([[1, 6, undefined], [], [5]])).toBe(12)
    })

    it.each<[string, Partial<TableDiceAsk>, string | undefined]>([
      [
        'a die that exploded, why rather than its formula',
        { purpose: 'again', again: 'explode', ...cold('1d6x', 1) },
        'Your die exploded: roll it again and type in what it shows.',
      ],
      [
        'a die rerolled',
        { purpose: 'again', again: 'reroll' },
        'Your die is rerolled: roll it again and type in what it shows.',
      ],
      [
        'a critical hit’s damage',
        { critical: true },
        'A critical hit: its dice are counted twice.',
      ],
      [
        'a formula of no kind that adds a number to its dice',
        { rolls: [{ formula: '1d4 + 2', terms: [{ faces: 4, number: 1 }] }] },
        'Rolled as 1d4 + 2.',
      ],
      [
        'every roll’s formula where one adds to its dice, without its terms’ flavors',
        {
          rolls: [
            ...cold('3d6', 3).rolls,
            {
              formula: '1d4[fire] + 1d6[fire] + 2',
              type: 'fire',
              terms: [
                { faces: 4, number: 1 },
                { faces: 6, number: 1 },
              ],
            },
          ],
        },
        'Rolled as 3d6 Cold, 1d4 + 1d6 + 2 Fire.',
      ],
      [
        'a critical hit’s formula, and its dice counted twice',
        { critical: true, ...cold('4d6 + 3', 4) },
        'Rolled as 4d6 + 3 Cold. A critical hit: its dice are counted twice.',
      ],
      [
        'nothing of formulas that are only their dice, flavors and spaces aside',
        {
          rolls: [
            {
              formula: '1d4[fire] + 1d6[fire]',
              type: 'fire',
              terms: [
                { faces: 4, number: 1 },
                { faces: 6, number: 1 },
              ],
            },
          ],
        },
        undefined,
      ],
    ])('notes %s', (_, fields, note) => {
      expect(askEntry(tableIceKnife(fields)).note).toBe(note)
    })

    it('names a term of no kind of damage by its flavor, else the ask, or what it is', () => {
      const plain = {
        rolls: [{ formula: '1d4', terms: [{ faces: 4 as const, number: 1 }] }],
      }
      expect(askEntry(tableIceKnife(plain)).terms[0]).toMatchObject({
        label: '1d4',
        name: 'Ice Knife: Shard Explosion',
      })
      expect(
        askEntry(tableIceKnife({ ...plain, label: '' })).terms[0].name,
      ).toBe('Dice the game asks for')
      expect(
        askEntry(
          tableIceKnife({
            rolls: [
              {
                formula: '1d4',
                flavor: 'Charges',
                // Not one of dnd5e's types, as a key every object has.
                type: 'constructor',
                terms: [{ faces: 4, number: 1 }],
              },
            ],
          }),
        ).terms[0].label,
      ).toBe('1d4 Charges')
    })
  })

  describe('answerOf and answeredRoll', () => {
    const ask = twoRollsAsk()

    // Its terms by the dialog's places: 3d6 cold (roll 0, term 0), then the fire roll's 1d4
    // (roll 1, term 0) and 1d6 (roll 1, term 1).
    it.each([
      [
        'the first and last typed',
        [[1, 6, 3], [], [5]],
        [
          { roll: 0, term: 0, results: [1, 6, 3] },
          { roll: 1, term: 1, results: [5] },
        ],
      ],
      [
        'only the fire roll’s first, its roll’s place not its own',
        [[], [2], []],
        [{ roll: 1, term: 0, results: [2] }],
      ],
    ])(
      'answers each term typed by its roll’s place and its own: %s',
      (_, values, answer) => {
        expect(answerOf(ask, values)).toEqual(answer)
      },
    )

    it('keeps what was typed in the tray, term by term, one skipped left to the game', () => {
      const values = [[1, 6, 3], [], [5]]
      expect(answeredRoll(ask, values)).toEqual({
        label: 'Ice Knife: Shard Explosion',
        total: 15,
        healing: false,
        terms: [
          { text: '3d6 Cold', values: [1, 6, 3], value: 10 },
          {
            text: '+1d4 Fire, left to the game',
            values: [],
            value: 0,
            left: true,
          },
          { text: '+1d6 Fire', values: [5], value: 5 },
        ],
        gameTotal: true,
        typed: true,
      })
    })

    it('keeps a die thrown again as the die typed, which the game counts in its roll, never as that roll’s total', () => {
      expect(answeredRoll(sparksAgain(), [[3]])).toEqual({
        label: 'Wild Sparks: Burst',
        total: 3,
        healing: false,
        terms: [{ text: '1d6', values: [3], value: 3 }],
        again: 'explode',
        typed: true,
      })
    })

    it('keeps a healing ask’s roll as healing, and one with no label as what it is', () => {
      const healing = answeredRoll(
        tableIceKnife({ purpose: 'healing', label: '' }),
      )
      expect(healing).toMatchObject({
        label: 'Dice the game asks for',
        healing: true,
      })
      expect(askEntry(tableIceKnife({ label: '' })).title).toBe(
        'Dice the game asks for',
      )
    })

    it('leaves the game every die where the player let it roll', () => {
      expect(answerOf(ask)).toEqual([])
      expect(answeredRoll(ask).terms.map(({ text }) => text)).toEqual([
        '3d6 Cold, left to the game',
        '+1d4 Fire, left to the game',
        '+1d6 Fire, left to the game',
      ])
    })
  })

  it('says an ask’s dice as its banner does', () => {
    expect(diceWords(twoRollsAsk())).toBe('3d6 Cold, 1d4 Fire, 1d6 Fire')
  })
})
