/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  aboutWords,
  badgeOf,
  beastCountWords,
  changeRefusedWords,
  chipWords,
  endedWords,
  formLineOf,
  headerLineOf,
  learnWords,
  managerLineWords,
  notTakingWords,
  returnWords,
  spellsNoteWords,
  swapWords,
  switcherWords,
  tempStayWords,
  tempWords,
} from './wild-shape-words'
import {
  KNOWN_FORMS,
  knownForm,
  moonBlock,
  wildShapeBlock,
} from '@/mocks/sending-stone'
import type { KnownForm, SheetSpellSection } from '@/types/sending-stone'

/** A known Elk, as the game says it is. */
const elk = (fields: Partial<KnownForm> = {}) =>
  knownForm({ id: 'formElk000000001', name: 'Elk', ...fields })

describe('utils/wild-shape-words, from module 0.40.0', () => {
  it('counts temporary hit points, one alone', () => {
    expect(tempWords(5)).toBe('5 temporary hit points')
    expect(tempWords(1)).toBe('1 temporary hit point')
    expect(tempStayWords(5)).toBe('5 temporary hit points stay')
    expect(tempStayWords(1)).toBe('1 temporary hit point stays')
  })

  it('says a Wild Shape apart from any other transformation, with each form’s article', () => {
    expect(headerLineOf({ kind: 'wildShape', name: 'Wolf' })).toBe(
      'In Wild Shape · Wolf',
    )
    expect(headerLineOf({ kind: 'other', name: 'Giant Ape' })).toBe(
      'Transformed · Giant Ape',
    )
    expect(switcherWords({ kind: 'wildShape', name: 'Ape' })).toBe(
      ', in Wild Shape as an Ape',
    )
    expect(switcherWords({ kind: 'other', name: 'Giant Ape' })).toBe(
      ', transformed into a Giant Ape',
    )
  })

  it('says the form’s size, CR and senses, what it has of them', () => {
    expect(formLineOf({ size: 'Medium', cr: 0.25 }, ['Darkvision 60 ft'])).toBe(
      'Medium · CR 1/4 · Darkvision 60 ft',
    )
    expect(formLineOf({ size: 'Large', cr: null }, [])).toBe('Large')
  })

  it('names the game as the seat reads it, a sentence’s first letter in capitals', () => {
    expect(notTakingWords('player')).toBe(
      'Your Gamemaster’s game isn’t taking Wild Shape now.',
    )
    expect(notTakingWords('gm')).toBe('Your game isn’t taking Wild Shape now.')
  })

  it('says each slot pool that waits by its level, and the Moon’s spells apart', () => {
    const pools: SheetSpellSection[] = [
      { id: 'spell0', label: 'Cantrips', slots: null, spells: [] },
      {
        id: 'spell1',
        label: '1st Level',
        slots: { value: 2, max: 4, level: 1 },
        spells: [],
      },
      {
        id: 'spell3',
        label: '3rd Level',
        slots: { value: 0, max: 2, level: 3 },
        spells: [],
      },
      {
        id: 'pact',
        label: 'Pact Magic',
        slots: { value: 1, max: 1, level: null },
        spells: [],
      },
    ] as SheetSpellSection[]
    expect(spellsNoteWords('Owl', 'Fern', pools, false)).toBe(
      'Fern can’t cast spells as an Owl. The spell slots wait: 2 of 4 1st level, 0 of 2 3rd level, 1 of 1 Pact Magic.',
    )
    expect(spellsNoteWords('Owl', 'Fern', [], false)).toBe(
      'Fern can’t cast spells as an Owl.',
    )
    expect(spellsNoteWords('Owl', 'Fern', pools, true)).toBe(
      'As an Owl, Fern can cast only Circle of the Moon spells.',
    )
  })

  it('says what a change gives, the Moon’s floor among it', () => {
    expect(aboutWords(wildShapeBlock(), 'Elowen')).toBe(
      'Bonus Action. 6 known forms, up to CR 1/2, none with a Fly Speed. Lasts 2 hours. Elowen gains 5 temporary hit points.',
    )
    expect(chipWords(wildShapeBlock())).toEqual([
      'Bonus Action',
      '2 hours',
      '+5 temporary hit points',
      'Keeps hit points, Int, Wis, Cha and features',
      'No spellcasting',
    ])
    expect(chipWords(moonBlock())).toEqual([
      'Bonus Action',
      '2 hours',
      '+15 temporary hit points',
      'AC at least 16',
      'Keeps hit points, Int, Wis, Cha and features',
      'Circle of the Moon spells only',
    ])
  })

  it('badges a known form by the first reason it can’t be taken, the compendiums first', () => {
    expect(badgeOf(KNOWN_FORMS.wolf)).toBeUndefined()
    expect(badgeOf(elk({ pool: false, found: false, fits: false }))).toBe(
      'Not from your Gamemaster’s compendiums',
    )
    expect(badgeOf(elk({ found: false, fits: false }))).toBe(
      'Not found in Foundry',
    )
    expect(badgeOf(elk({ fits: false }))).toBe('Outside the rules')
    expect(badgeOf(elk({ fits: undefined }))).toBe('Outside the rules')
  })

  it('says the manager’s line and when a known form may be replaced', () => {
    const full = wildShapeBlock()
    expect(managerLineWords(full, 'Elowen')).toBe(
      'Elowen knows 6 of 6 forms: Beasts up to CR 1/2, none with a Fly Speed.',
    )
    expect(swapWords(full, 'Elowen')).toBe(
      'Elowen may replace one known form after each Long Rest.',
    )
    expect(swapWords({ ...full, swap: true }, 'Elowen')).toBe(
      'Elowen may replace one known form, after the last Long Rest.',
    )
    expect(
      swapWords({ ...full, known: full.known.slice(0, 2) }, 'Elowen'),
    ).toBeUndefined()
  })

  it('counts the Beasts to learn, filtered or not, and learns one in place of another', () => {
    expect(beastCountWords(9, 9, false)).toBe('9 Beasts')
    expect(beastCountWords(1, 1, true)).toBe('1 Beast, and more in Foundry')
    expect(beastCountWords(3, 9, false)).toBe('3 of 9 Beasts')
    expect(learnWords('Owl')).toBe('Learn an Owl')
    expect(learnWords('Wolf', 'Elk')).toBe('Learn a Wolf in place of an Elk')
  })

  it('asks to try again only where the game may take it in a moment', () => {
    expect(
      changeRefusedWords('Elowen', 'timeout', 'the game took too long'),
    ).toBe(
      'Elowen didn’t change: the game took too long. Try again in a moment.',
    )
    expect(
      changeRefusedWords('Elowen', 'consume', 'no uses of Wild Shape are left'),
    ).toBe('Elowen didn’t change: no uses of Wild Shape are left.')
  })

  it('asks before a return, saying temporary hit points only where there are any', () => {
    expect(returnWords('Elowen', 'Owl', 1)).toEqual({
      title: 'Return to Elowen?',
      body: [
        'Wild Shape ends. It takes a Bonus Action.',
        'Elowen keeps 1 temporary hit point.',
      ],
      stay: 'Stay an Owl',
      confirm: 'Return',
    })
    expect(returnWords('Elowen', 'Wolf', 0).body).toEqual([
      'Wild Shape ends. It takes a Bonus Action.',
    ])
  })

  it('says why the game ended it, and nothing for one ended from here', () => {
    const ended = { form: 'Elk', at: 1, formId: 'formElk' }
    expect(endedWords({ ...ended, why: 'time' }, 'Fern', 1)).toBe(
      'Wild Shape ended in your game: its hour ran out. Fern is no longer an Elk.',
    )
    expect(endedWords({ ...ended, why: 'app' }, 'Fern', 2)).toBeUndefined()
  })
})
