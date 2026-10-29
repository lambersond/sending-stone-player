import {
  BANE_DIE,
  BLESS_DIE,
  blessedSheet,
  GUIDANCE_DIE,
  INSPIRATION_DIE,
  inspiredSheet,
} from '@/mocks/sending-stone'
import { throwTerm } from '@/utils/dice-modifiers'
import {
  dieWords,
  effectDiceFor,
  effectTermLabel,
  offersFor,
  rollTokens,
  skippedWords,
  withoutRerolls,
} from '@/utils/effect-dice'
import type { RollSource } from '@/types/roll'
import type { SheetEffectDie } from '@/types/sending-stone'
import type { TablePrompt } from '@/types/table'
import type { ExtraDice } from '@/utils/roll-modifiers'

/** A prompt the table is asked, as its player is shown it. */
const prompt = (fields: Partial<TablePrompt> = {}): TablePrompt => ({
  id: 'card1-thorin',
  type: 'save',
  abilities: ['con'],
  expiresAt: '2026-10-30T20:00:00.000Z',
  ...fields,
})

/** A die an effect adds, Bless's unless said otherwise. */
const die = (fields: Partial<SheetEffectDie> = {}): SheetEffectDie => ({
  ...BLESS_DIE,
  ...fields,
})

const names = (dice: SheetEffectDie[]) => dice.map(({ name }) => name)

/** A roll of this kind, by its key, answering the prompt with this id. */
const answeringAs =
  (kind: 'save' | 'skill', key: string) =>
  (id: string): { source: RollSource } => ({
    source: { kind, key, prompt: id },
  })

describe('utils/effect-dice', () => {
  describe('rollTokens', () => {
    it.each<[string, RollSource, string[]]>([
      [
        'an attack',
        { kind: 'attack', item: 'rapier', activity: 'attack' },
        ['attack'],
      ],
      ['a saving throw', { kind: 'save', key: 'dex' }, ['save', 'save.dex']],
      ['a death saving throw', { kind: 'death' }, ['death']],
      [
        'an ability check',
        { kind: 'ability', key: 'str' },
        ['check', 'check.str'],
      ],
      ['a skill check', { kind: 'skill', key: 'ath' }, ['skill', 'skill.ath']],
      [
        'a tool check',
        { kind: 'tool', key: 'thieves_tools' },
        ['tool', 'tool.thieves_tools'],
      ],
      ['initiative', { kind: 'initiative', combatId: 'fight' }, ['initiative']],
    ])(
      'names %s as every roll of its kind and it by its key',
      (_, source, tokens) => {
        expect(rollTokens(source)).toEqual(tokens)
      },
    )

    it('makes a saving throw from a link that asks a concentration check one, as dnd5e rolls it', () => {
      const source: RollSource = {
        kind: 'save',
        key: 'con',
        text: '0f1a2b3c4d5e6f',
        link: 2,
      }
      expect(rollTokens(source, { ask: { type: 'concentration' } })).toEqual([
        'save',
        'save.con',
        'concentration',
      ])
      expect(rollTokens(source, { ask: { type: 'save' } })).toEqual([
        'save',
        'save.con',
      ])
      expect(rollTokens(source)).toEqual(['save', 'save.con'])
    })

    it('takes no ask for a saving throw made from no link', () => {
      expect(
        rollTokens(
          { kind: 'save', key: 'con' },
          { ask: { type: 'concentration' } },
        ),
      ).toEqual(['save', 'save.con'])
    })

    // Changed on purpose (round 0.42.0 §8.3): Midi-QOL's concentration check, from its card or its
    // workflow, is made with dnd5e's concentration check too, which adds concentration's own bonus.
    it("makes the answer to a concentration check's prompt, dnd5e's card's or Midi-QOL's, a concentration check, and a plain save's a save", () => {
      const source: RollSource = {
        kind: 'save',
        key: 'con',
        prompt: 'card1-thorin',
      }
      expect(rollTokens(source, { prompt: { type: 'concentration' } })).toEqual(
        ['save', 'save.con', 'concentration'],
      )
      expect(
        rollTokens(source, {
          prompt: { type: 'concentration', source: 'concentration' },
        }),
      ).toEqual(['save', 'save.con', 'concentration'])
      expect(rollTokens(source, { prompt: { type: 'save' } })).toEqual([
        'save',
        'save.con',
      ])
      expect(
        rollTokens(source, { prompt: { type: 'save', source: 'midi' } }),
      ).toEqual(['save', 'save.con'])
    })
  })

  describe('effectDiceFor', () => {
    const sheet = blessedSheet()

    it('asks Bless and Bane on a saving throw and an attack, in the sheet’s order, and Guidance on neither', () => {
      expect(
        names(effectDiceFor(sheet, { source: { kind: 'save', key: 'dex' } })),
      ).toEqual(['Bless', 'Bane'])
      expect(
        names(
          effectDiceFor(sheet, {
            source: { kind: 'attack', item: 'rapier', activity: 'attack' },
          }),
        ),
      ).toEqual(['Bless', 'Bane'])
      expect(
        names(effectDiceFor(sheet, { source: { kind: 'death' } })),
      ).toEqual(['Bless', 'Bane'])
    })

    it('asks Guidance on Athletics alone, and nothing on Perception or an ability check', () => {
      expect(
        effectDiceFor(sheet, { source: { kind: 'skill', key: 'ath' } }),
      ).toEqual([GUIDANCE_DIE])
      expect(
        effectDiceFor(sheet, { source: { kind: 'skill', key: 'prc' } }),
      ).toEqual([])
      expect(
        effectDiceFor(sheet, { source: { kind: 'ability', key: 'str' } }),
      ).toEqual([])
      expect(
        effectDiceFor(sheet, {
          source: { kind: 'initiative', combatId: 'fight' },
        }),
      ).toEqual([])
    })

    it("asks a die on one ability's checks on that check, and on a skill the module lists for it", () => {
      const strength = die({
        name: 'Enhance Ability',
        effect: 'enhance',
        faces: 6,
        on: ['check.str', 'skill.ath'],
      })
      const strong = blessedSheet({ effectDice: [strength] })
      expect(
        effectDiceFor(strong, { source: { kind: 'skill', key: 'ath' } }),
      ).toEqual([strength])
      expect(
        effectDiceFor(strong, { source: { kind: 'ability', key: 'str' } }),
      ).toEqual([strength])
      expect(
        effectDiceFor(strong, { source: { kind: 'ability', key: 'dex' } }),
      ).toEqual([])
    })

    // Changed on purpose (round 0.42.0 §8.3): Midi-QOL's concentration check asks it too.
    it('asks a concentration-only die only of a concentration check, whoever asks it', () => {
      const focus = die({
        name: 'Focus',
        effect: 'focus',
        on: ['concentration'],
      })
      const focused = blessedSheet({ effectDice: [BLESS_DIE, focus] })
      const prompts = [
        prompt({ id: 'card1-thorin', type: 'concentration' }),
        prompt({ id: 'midi1', type: 'concentration', source: 'concentration' }),
        prompt({ id: 'midi2', type: 'save', source: 'midi' }),
      ]
      const answering = (id: string) => ({
        source: { kind: 'save' as const, key: 'con', prompt: id },
      })
      expect(
        names(effectDiceFor(focused, answering('card1-thorin'), prompts)),
      ).toEqual(['Bless', 'Focus'])
      expect(
        names(effectDiceFor(focused, answering('midi1'), prompts)),
      ).toEqual(['Bless', 'Focus'])
      // A Constitution save Midi-QOL asks, not for concentration, is a plain save.
      expect(
        names(effectDiceFor(focused, answering('midi2'), prompts)),
      ).toEqual(['Bless'])
      // One no longer held is a plain save.
      expect(
        names(effectDiceFor(focused, answering('gone1'), prompts)),
      ).toEqual(['Bless'])
      const linked = {
        source: {
          kind: 'save' as const,
          key: 'con',
          text: '0f1a2b3c4d5e6f',
          link: 1,
        },
      }
      expect(
        names(
          effectDiceFor(focused, { ...linked, ask: { type: 'concentration' } }),
        ),
      ).toEqual(['Bless', 'Focus'])
      expect(names(effectDiceFor(focused, linked))).toEqual(['Bless'])
    })

    it("asks a die on one ability's saves only of that save", () => {
      const resilient = die({ name: 'Ring', effect: 'ring', on: ['save.con'] })
      const ringed = blessedSheet({ effectDice: [resilient] })
      expect(
        effectDiceFor(ringed, { source: { kind: 'save', key: 'con' } }),
      ).toEqual([resilient])
      expect(
        effectDiceFor(ringed, { source: { kind: 'save', key: 'dex' } }),
      ).toEqual([])
    })

    // Changed on purpose (round 0.42.1 §7.2): this build reads module 0.42.1's offer, and offers
    // it apart, never asking it as a die the game adds; a key no module writes still passes a die
    // over.
    it("never asks a die the sheet offers, which the game doesn't add, nor one stored with a key module 0.42.1 doesn't write", () => {
      const inspiration = {
        ...die({ name: 'Bardic Inspiration', effect: 'inspired01', faces: 8 }),
        on: ['attack', 'save', 'skill'],
        offer: true,
      } as SheetEffectDie
      const inspired = blessedSheet({ effectDice: [BLESS_DIE, inspiration] })
      const save = { source: { kind: 'save' as const, key: 'dex' } }
      expect(names(effectDiceFor(inspired, save))).toEqual(['Bless'])
      expect(
        effectDiceFor(inspired, { source: { kind: 'skill', key: 'ath' } }),
      ).toEqual([])
      expect(offersFor(inspired, save).map(({ die }) => die)).toEqual([
        inspiration,
      ])
      // Stored by a later build of the app, before it was rolled back, so never read by this
      // build's schema (round 0.42.0 §4.8).
      const later = { ...BLESS_DIE, caster: 'Vex' } as SheetEffectDie
      const offered = { ...inspiration, spent: true } as SheetEffectDie
      const stored = blessedSheet({ effectDice: [later, offered, BANE_DIE] })
      expect(names(effectDiceFor(stored, save))).toEqual(['Bane'])
      expect(offersFor(stored, save)).toEqual([])
    })

    it('never asks Bardic Inspiration, which the sheet offers, beside Bless on any roll', () => {
      const sheet = inspiredSheet({ effectDice: [BLESS_DIE, INSPIRATION_DIE] })
      expect(
        names(effectDiceFor(sheet, { source: { kind: 'save', key: 'str' } })),
      ).toEqual(['Bless'])
      expect(
        effectDiceFor(sheet, { source: { kind: 'ability', key: 'str' } }),
      ).toEqual([])
      expect(
        effectDiceFor(inspiredSheet(), { source: { kind: 'death' } }),
      ).toEqual([])
    })

    it('asks none without the sheet’s list, a sheet, or a roll the game makes', () => {
      const save = { source: { kind: 'save' as const, key: 'dex' } }
      expect(
        effectDiceFor(blessedSheet({ effectDice: undefined }), save),
      ).toEqual([])
      // eslint-disable-next-line unicorn/no-null -- a seat with no sheet yet
      expect(effectDiceFor(null, save)).toEqual([])
      expect(effectDiceFor(undefined, save)).toEqual([])
      expect(effectDiceFor(sheet, {})).toEqual([])
    })
  })

  describe('offersFor', () => {
    const sheet = inspiredSheet()
    const spends = {
      effect: 'inspired',
      name: 'Inspired',
      offer: 'Bardic Inspiration',
    }
    const offered = [{ die: INSPIRATION_DIE, spends }]

    it.each<[string, RollSource]>([
      ['a saving throw', { kind: 'save', key: 'str' }],
      ['an attack', { kind: 'attack', item: 'rapier', activity: 'attack' }],
      ['an ability check', { kind: 'ability', key: 'str' }],
      ['a death saving throw', { kind: 'death' }],
      ['a skill check', { kind: 'skill', key: 'prc' }],
      ['a tool check', { kind: 'tool', key: 'thieves_tools' }],
    ])(
      'offers Bardic Inspiration on %s, and what adding it spends',
      (_, source) => {
        expect(offersFor(sheet, { source })).toEqual(offered)
      },
    )

    it('offers it on a concentration check, and none on initiative, which never fails', () => {
      const linked = {
        source: {
          kind: 'save' as const,
          key: 'con',
          text: '0f1a2b3c4d5e6f',
          link: 1,
        },
        ask: { type: 'concentration' as const },
      }
      expect(offersFor(sheet, linked)).toEqual(offered)
      expect(
        offersFor(sheet, { source: { kind: 'initiative', combatId: 'fight' } }),
      ).toEqual([])
    })

    it('offers a die on some rolls only on those', () => {
      const strength = { ...INSPIRATION_DIE, on: ['save.str', 'check'] }
      const some = inspiredSheet({ effectDice: [strength] })
      expect(offersFor(some, { source: { kind: 'save', key: 'str' } })).toEqual(
        [{ die: strength, spends }],
      )
      expect(
        offersFor(some, { source: { kind: 'ability', key: 'dex' } }),
      ).toHaveLength(1)
      expect(offersFor(some, { source: { kind: 'save', key: 'dex' } })).toEqual(
        [],
      )
      expect(
        offersFor(some, {
          source: { kind: 'attack', item: 'rapier', activity: 'attack' },
        }),
      ).toEqual([])
    })

    it("offers it on the answer to dnd5e's card's prompt, and none on Midi-QOL's, which refuses anything added, nor on one no longer held", () => {
      const prompts = [
        prompt({ id: 'card1-thorin', type: 'save', abilities: ['str'] }),
        prompt({ id: 'card2-thorin', type: 'concentration' }),
        prompt({ id: 'midi1', type: 'save', source: 'midi' }),
        prompt({ id: 'midi2', type: 'concentration', source: 'concentration' }),
      ]
      const answering = answeringAs('save', 'str')
      expect(offersFor(sheet, answering('card1-thorin'), prompts)).toEqual(
        offered,
      )
      expect(offersFor(sheet, answering('card2-thorin'), prompts)).toEqual(
        offered,
      )
      expect(offersFor(sheet, answering('midi1'), prompts)).toEqual([])
      expect(offersFor(sheet, answering('midi2'), prompts)).toEqual([])
      expect(offersFor(sheet, answering('gone1'), prompts)).toEqual([])
      expect(offersFor(sheet, answering('card1-thorin'))).toEqual([])
      // A check Midi-QOL asks, or dnd5e's card does, likewise.
      const checks = [
        prompt({ id: 'card3-thorin', type: 'skill', skills: ['ath'] }),
        prompt({ id: 'midi3', type: 'skill', skills: ['ath'], source: 'midi' }),
      ]
      const skill = answeringAs('skill', 'ath')
      expect(offersFor(sheet, skill('card3-thorin'), checks)).toEqual(offered)
      expect(offersFor(sheet, skill('midi3'), checks)).toEqual([])
    })

    it('offers none for a roll the game doesn’t make, without the sheet’s list or a sheet, or where it offers nothing', () => {
      const save = { source: { kind: 'save' as const, key: 'str' } }
      expect(offersFor(sheet, {})).toEqual([])
      expect(offersFor(inspiredSheet({ effectDice: undefined }), save)).toEqual(
        [],
      )
      // eslint-disable-next-line unicorn/no-null -- a seat with no sheet yet
      expect(offersFor(null, save)).toEqual([])
      expect(offersFor(undefined, save)).toEqual([])
      expect(offersFor(blessedSheet(), save)).toEqual([])
    })

    it('spends the effect by its id, named as the sheet’s effects name it, else as the die is, and names the offer as the sheet does', () => {
      const vex = { ...INSPIRATION_DIE, name: 'Bardic Inspiration (Vex)' }
      const mira = {
        ...INSPIRATION_DIE,
        name: 'Bardic Inspiration (Mira)',
        effect: 'inspiredMira',
        faces: 8 as const,
      }
      const two = inspiredSheet({ effectDice: [vex, BLESS_DIE, mira] })
      expect(offersFor(two, { source: { kind: 'save', key: 'str' } })).toEqual([
        {
          die: vex,
          spends: {
            effect: 'inspired',
            name: 'Inspired',
            offer: 'Bardic Inspiration (Vex)',
          },
        },
        {
          die: mira,
          spends: {
            effect: 'inspiredMira',
            name: 'Bardic Inspiration (Mira)',
            offer: 'Bardic Inspiration (Mira)',
          },
        },
      ])
    })

    it("finds the effect it spends in any of the sheet's sections, an item's among them", () => {
      const onItem = { ...INSPIRATION_DIE, effect: 'cloak01.inspired' }
      const [inspired] = inspiredSheet().effects[0].effects
      const sheet = inspiredSheet({
        effects: [
          { id: 'temporary', label: 'Temporary Effects', effects: [] },
          {
            id: 'passive',
            label: 'Passive Effects',
            effects: [
              {
                ...inspired,
                id: 'cloak01.inspired',
                name: 'Inspired by the Cloak',
              },
            ],
          },
        ],
        effectDice: [onItem],
      })
      expect(
        offersFor(sheet, { source: { kind: 'death' } }).map(
          ({ spends }) => spends,
        ),
      ).toEqual([
        {
          effect: 'cloak01.inspired',
          name: 'Inspired by the Cloak',
          offer: 'Bardic Inspiration',
        },
      ])
    })
  })

  describe('withoutRerolls', () => {
    it.each([
      [['r'], []],
      [['r<=2'], []],
      [['rr<3'], []],
      [['r1=1'], []],
      [['x'], ['x']],
      [['xo'], ['xo']],
      [['min3'], ['min3']],
      [['kh3'], ['kh3']],
      [['cs>=5'], ['cs>=5']],
      [
        ['r<=2', 'min3', 'x6'],
        ['min3', 'x6'],
      ],
    ])('keeps of %j only what isn’t a reroll: %j', (modifiers, kept) => {
      const term: ExtraDice = { sign: 1, count: 2, sides: 6, modifiers }
      expect(withoutRerolls(term)).toEqual({ ...term, modifiers: kept })
    })

    it('leaves a term with nothing to drop as it is', () => {
      const plain = { sign: 1 as const, count: 1, sides: 8 as const }
      expect(withoutRerolls(plain)).toBe(plain)
      const kept = { ...plain, modifiers: ['kh1'] }
      expect(withoutRerolls(kept)).toBe(kept)
    })

    it("totals Great Weapon Fighting's typed 1 and 5 as they stand, and an explosion as the game's", () => {
      const greatsword = { sides: 6 as const, modifiers: ['r<=2'] }
      const kept = throwTerm(withoutRerolls(greatsword), [1, 5], () => [])
      expect(kept).toMatchObject({ total: 6, rethrown: false })
      // Without it, the app's own dice stop at the reroll and leave the total to the game.
      const asked: number[] = []
      throwTerm(greatsword, [1, 5], count => {
        asked.push(count)
        return []
      })
      expect(asked).toEqual([1])
      const exploding: number[] = []
      throwTerm(withoutRerolls({ sides: 6, modifiers: ['x'] }), [6], count => {
        exploding.push(count)
        return []
      })
      expect(exploding).toEqual([1])
      expect(
        throwTerm(
          withoutRerolls({ sides: 6, modifiers: ['min3'] }),
          [1, 5],
          () => [],
        ),
      ).toMatchObject({ total: 8 })
    })
  })

  describe('words', () => {
    it('heads a die an effect adds by its name and signed die', () => {
      expect(effectTermLabel(BLESS_DIE)).toBe('Bless: +1d4')
      expect(effectTermLabel(BANE_DIE)).toBe('Bane: −1d4')
      expect(effectTermLabel(die({ count: 2, faces: 6 }))).toBe('Bless: +2d6')
    })

    it('says the die as a player rolls it', () => {
      expect(dieWords(BLESS_DIE)).toBe('d4')
      expect(dieWords(die({ count: 2 }))).toBe('2d4')
    })

    it('says what a total leaves out of the dice skipped: one by its name, more by how many', () => {
      expect(skippedWords([BLESS_DIE])).toBe('not counting Bless’s d4')
      expect(skippedWords([die({ count: 2 })])).toBe('not counting Bless’s 2d4')
      expect(skippedWords([BLESS_DIE, BANE_DIE])).toBe(
        'not counting 2 dice the game rolls',
      )
      expect(skippedWords([die({ count: 2 }), BANE_DIE])).toBe(
        'not counting 3 dice the game rolls',
      )
      expect(skippedWords([])).toBe('')
    })
  })
})
