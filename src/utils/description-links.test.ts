import {
  checkName,
  checkTitle,
  linkAttributes,
  linkClassOf,
  linkOf,
  toolOrSkillName,
} from './description-links'

describe('utils/description-links', () => {
  describe('linkOf', () => {
    it('reads a saving throw, its abilities once each, its DC and whether it checks concentration', () => {
      expect(
        linkOf({
          class: 'ss-save roll',
          'data-n': '0',
          'data-ability': 'str|dex|str',
          'data-dc': '15',
        }),
      ).toEqual({
        kind: 'save',
        n: 0,
        abilities: ['str', 'dex'],
        dc: 15,
        concentration: false,
      })
      expect(
        linkOf({
          class: 'ss-save roll',
          'data-n': '4',
          'data-ability': 'wis',
          'data-type': 'concentration',
        }),
      ).toEqual({
        kind: 'save',
        n: 4,
        abilities: ['wis'],
        concentration: true,
      })
    })

    it("takes a concentration check that names no ability, as dnd5e's own, as Constitution's", () => {
      const attribs = {
        class: 'ss-save roll',
        'data-n': '1',
        'data-type': 'concentration',
        'data-dc': '10',
      }

      expect(linkAttributes('ss-save', attribs)).toEqual({
        'data-n': '1',
        'data-type': 'concentration',
        'data-dc': '10',
      })
      expect(linkOf(attribs)).toEqual({
        kind: 'save',
        n: 1,
        abilities: ['con'],
        dc: 10,
        concentration: true,
      })
      // Any other saving throw names its abilities.
      expect(linkOf({ ...attribs, 'data-type': undefined })).toBeUndefined()
      expect(linkOf({ ...attribs, 'data-type': 'check' })).toBeUndefined()
    })

    it('reads damage by part, with the kinds each may be, and healing', () => {
      expect(
        linkOf({
          class: 'ss-damage roll',
          'data-n': '2',
          'data-formulas': '2d6 + 3&1d4&5',
          'data-types': 'fire|cold&&force',
          'data-healing': 'true',
        }),
      ).toEqual({
        kind: 'damage',
        n: 2,
        parts: [
          { formula: '2d6 + 3', types: ['fire', 'cold'] },
          { formula: '1d4', types: [] },
          { formula: '5', types: ['force'] },
        ],
        healing: true,
      })
      expect(
        linkOf({ class: 'ss-damage', 'data-n': '3', 'data-formulas': '1d6' }),
      ).toEqual({
        kind: 'damage',
        n: 3,
        parts: [{ formula: '1d6', types: [] }],
        healing: false,
      })
    })

    it("reads damage never a critical hit's, from module 0.19.0, and nothing else as saying so", () => {
      const poison = {
        class: 'ss-damage roll',
        'data-n': '4',
        'data-formulas': '1d4',
        'data-types': 'poison',
      }

      expect(linkOf({ ...poison, 'data-critical': 'false' })).toEqual({
        kind: 'damage',
        n: 4,
        parts: [{ formula: '1d4', types: ['poison'] }],
        healing: false,
        critical: false,
      })
      for (const value of ['true', 'no', '']) {
        expect(
          linkOf({ ...poison, 'data-critical': value }),
        ).not.toHaveProperty('critical')
      }
    })

    describe('what a critical hit adds, from module 0.20.0', () => {
      /** A greataxe's damage, a critical hit's with Savage Attacks' die and the weapon's 1d6. */
      const greataxe = {
        class: 'ss-damage roll',
        'data-n': '5',
        'data-formulas': '1d12 + 4',
        'data-types': 'slashing',
        'data-critical': 'false',
        'data-critical-dice': '1',
        'data-critical-damage': '1d6',
      }

      it('reads it for each part, a critical hit then offered, though marked never one for apps before', () => {
        expect(linkOf(greataxe)).toEqual({
          kind: 'damage',
          n: 5,
          parts: [{ formula: '1d12 + 4', types: ['slashing'] }],
          healing: false,
          criticalAdds: { dice: [1], damage: ['1d6'] },
        })
        // Two parts, the second adding nothing.
        expect(
          linkOf({
            ...greataxe,
            'data-formulas': '1d6&1d4',
            'data-types': 'fire&cold',
            'data-critical-dice': '0&0',
            'data-critical-damage': '1d4&',
          }),
        ).toMatchObject({
          criticalAdds: { dice: [0, 0], damage: ['1d4', ''] },
        })
        expect(
          linkOf({ ...greataxe, 'data-critical': undefined }),
        ).not.toHaveProperty('critical')
      })

      it('reads numbers alone added, as a javelin’s, which are never marked never one', () => {
        expect(
          linkOf({
            ...greataxe,
            'data-formulas': '1d6 + 4',
            'data-critical': undefined,
            'data-critical-dice': '0',
            'data-critical-damage': '4',
          }),
        ).toEqual({
          kind: 'damage',
          n: 5,
          parts: [{ formula: '1d6 + 4', types: ['slashing'] }],
          healing: false,
          criticalAdds: { dice: [0], damage: ['4'] },
        })
      })

      it.each<[string, Record<string, string | undefined>]>([
        ['only its extra dice', { 'data-critical-damage': undefined }],
        ['only its critical damage', { 'data-critical-dice': undefined }],
        ['fewer extra dice than parts', { 'data-formulas': '1d12&1d4' }],
        [
          'more critical damage than parts',
          { 'data-critical-dice': '1', 'data-critical-damage': '1d6&1d4' },
        ],
        ['extra dice that aren’t a count', { 'data-critical-dice': '1d6' }],
        ['more than 20 extra dice', { 'data-critical-dice': '21' }],
        ['critical damage of other signs', { 'data-critical-damage': '1d6*2' }],
        [
          'critical damage with a flavour',
          { 'data-critical-damage': '1d6[fire]' },
        ],
        [
          'critical damage the app can’t read',
          { 'data-critical-damage': '1d3' },
        ],
        [
          'critical damage of a die too many',
          { 'data-critical-damage': '21d6' },
        ],
      ])('keeps it never a critical hit’s where it has %s', (_, changed) => {
        const link = linkOf({ ...greataxe, ...changed })
        expect(link).toMatchObject({ kind: 'damage', critical: false })
        expect(link).not.toHaveProperty('criticalAdds')
      })
    })

    it('reads a check: each way it may be made once, the first kept, its DC, and the tool a skill check is made using', () => {
      expect(
        linkOf({
          class: 'ss-check roll',
          'data-n': '6',
          'data-checks':
            'skill:str:ath|skill:dex:acr|skill:dex:ath|check:int|check:int|tool:dex:thief',
          'data-dc': '15',
          'data-using-tool': 'thief',
        }),
      ).toEqual({
        kind: 'check',
        n: 6,
        checks: [
          { type: 'skill', ability: 'str', key: 'ath' },
          { type: 'skill', ability: 'dex', key: 'acr' },
          { type: 'check', ability: 'int' },
          { type: 'tool', ability: 'dex', key: 'thief' },
        ],
        dc: 15,
        usingTool: 'thief',
      })
      expect(
        linkOf({
          class: 'ss-check roll',
          'data-n': '0',
          'data-checks': 'check:str',
        }),
      ).toEqual({
        kind: 'check',
        n: 0,
        checks: [{ type: 'check', ability: 'str' }],
      })
    })

    it('reads a roll of its own and a condition', () => {
      expect(
        linkOf({ class: 'ss-roll roll', 'data-n': '5', 'data-formula': '1d6' }),
      ).toEqual({ kind: 'roll', n: 5, formula: '1d6' })
      expect(
        linkOf({ class: 'ss-condition ref', 'data-condition': 'prone' }),
      ).toEqual({ kind: 'condition', condition: 'prone' })
    })

    it('reads formulas with what Foundry does with their dice, comparisons and all', () => {
      expect(
        linkOf({
          class: 'ss-damage roll',
          'data-n': '1',
          'data-formulas': '2d6r<=2 + 1d8 + 7&1d6x',
          'data-types': 'slashing&fire',
        }),
      ).toEqual({
        kind: 'damage',
        n: 1,
        parts: [
          { formula: '2d6r<=2 + 1d8 + 7', types: ['slashing'] },
          { formula: '1d6x', types: ['fire'] },
        ],
        healing: false,
      })
      expect(
        linkOf({
          class: 'ss-roll roll',
          'data-n': '2',
          'data-formula': '4d6kh3',
        }),
      ).toEqual({ kind: 'roll', n: 2, formula: '4d6kh3' })
      for (const formula of ['2d6r2', '6d6cs>=5', '1d20 − 1d4min2']) {
        expect(
          linkAttributes('ss-roll', { 'data-n': '0', 'data-formula': formula }),
        ).toEqual({ 'data-n': '0', 'data-formula': formula })
      }
    })

    it('keeps a formula of capitals or other signs as text', () => {
      for (const formula of ['1d6X', '1d6 + @mod', '2d6!', '1d6 + {1}']) {
        expect(
          linkAttributes('ss-roll', { 'data-n': '0', 'data-formula': formula }),
        ).toBeUndefined()
      }
    })

    it.each([
      ['no class', { 'data-n': '0', 'data-formula': '1d6' }],
      ['a class it has not', { class: 'roll', 'data-n': '0' }],
      ['no number', { class: 'ss-roll', 'data-formula': '1d6' }],
      [
        'roll data',
        { class: 'ss-roll', 'data-n': '0', 'data-formula': '@mod' },
      ],
      [
        'an ability any object has',
        { class: 'ss-save', 'data-n': '0', 'data-ability': 'constructor' },
      ],
      ['a check of no way', { class: 'ss-check', 'data-n': '0' }],
      [
        'a check by an ability dnd5e hasn’t',
        { class: 'ss-check', 'data-n': '0', 'data-checks': 'check:san' },
      ],
      [
        'a check of no number',
        { class: 'ss-check', 'data-checks': 'check:str' },
      ],
    ])('reads nothing from a span with %s', (_name, attribs) => {
      expect(linkOf(attribs)).toBeUndefined()
    })
  })

  describe('a check’s words', () => {
    it('names each way, by the ability and the skill or tool: the name given, else dnd5e’s, else its key', () => {
      expect(checkName({ type: 'check', ability: 'str' })).toBe('Strength')
      expect(checkName({ type: 'skill', ability: 'str', key: 'ath' })).toBe(
        'Strength (Athletics)',
      )
      expect(checkName({ type: 'skill', ability: 'cha', key: 'ath' })).toBe(
        'Charisma (Athletics)',
      )
      expect(checkName({ type: 'tool', ability: 'dex', key: 'thief' })).toBe(
        "Dexterity (Thieves' Tools)",
      )
      expect(
        checkName({ type: 'tool', ability: 'int', key: 'herb' }, 'Herbs'),
      ).toBe('Intelligence (Herbs)')
      expect(checkName({ type: 'skill', ability: 'wis', key: 'pil' })).toBe(
        'Wisdom (pil)',
      )
      expect(toolOrSkillName('tool', 'water')).toBe('Water Vehicle')
      expect(toolOrSkillName('tool', 'constructor')).toBe('constructor')
    })

    it('says the check, its DC, its choice, and the tool a skill check is made using', () => {
      expect(checkTitle(['Strength (Athletics)'], { dc: 15 })).toBe(
        'DC 15 Strength (Athletics) check',
      )
      expect(checkTitle(['Intelligence', 'Wisdom'])).toBe(
        'Intelligence or Wisdom check',
      )
      expect(
        checkTitle(
          ['Strength (Athletics)', 'Dexterity (Acrobatics)', 'Dexterity'],
          { dc: 12 },
        ),
      ).toBe(
        'DC 12 Strength (Athletics), Dexterity (Acrobatics), or Dexterity check',
      )
      expect(
        checkTitle(['Dexterity (Sleight of Hand)'], {
          using: "Thieves' Tools",
        }),
      ).toBe("Dexterity (Sleight of Hand) check using Thieves' Tools")
    })
  })

  it('finds the first class of a link a class list names', () => {
    expect(linkClassOf('roll ss-damage ss-save')).toBe('ss-save')
    expect(linkClassOf('ss-check roll')).toBe('ss-check')
    expect(linkClassOf('roll')).toBeUndefined()
    expect(linkClassOf('')).toBeUndefined()
  })
})
