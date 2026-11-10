import { answeredRoll, answerOf, askEntry, diceWords } from './dice-ask-entry'
import { tableIceKnife, twoRollsAsk } from '@/mocks/dice-asks'

describe('features/rolling/utils/dice-ask-entry (module 0.45.0)', () => {
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

    it.each([
      [
        'a die that exploded',
        { purpose: 'again' as const, again: 'explode' as const },
        'Your die exploded: roll it again and type in what it shows.',
      ],
      [
        'a die rerolled',
        { purpose: 'again' as const, again: 'reroll' as const },
        'Your die is rerolled: roll it again and type in what it shows.',
      ],
      [
        'a critical hit’s damage',
        { critical: true as const },
        'A critical hit: its dice are counted twice.',
      ],
    ])('says so of %s', (_, fields, note) => {
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

    it('answers each term typed by its place, leaving one skipped to the game', () => {
      const values = [[1, 6, 3], [], [5]]
      expect(answerOf(ask, values)).toEqual([
        { roll: 0, term: 0, results: [1, 6, 3] },
        { roll: 1, term: 1, results: [5] },
      ])
      expect(answeredRoll(ask, values)).toEqual({
        label: 'Ice Knife: Shard Explosion',
        total: 15,
        healing: false,
        terms: [
          { text: '3d6 Cold', values: [1, 6, 3], value: 10 },
          { text: '+1d4 Fire, left to the game', values: [], value: 0 },
          { text: '+1d6 Fire', values: [5], value: 5 },
        ],
        gameTotal: true,
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
