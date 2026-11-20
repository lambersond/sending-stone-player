import { askTitle } from './ask-words'
import { gameNames } from './game-names'
import type { TableAsk } from '@/types/table'

// dnd5e's English six and 18 are the words golden's (src/__tests__/golden), not repeated here.
describe('utils/ask-words', () => {
  describe('askTitle', () => {
    // A sheet with dnd5e's Honor and Sanity on, and a world's own skill on Honor.
    const names = gameNames({
      abilities: [
        { id: 'wis', label: 'Wisdom', abbreviation: 'wis' },
        { id: 'hon', label: 'Honor', abbreviation: 'hon' },
        { id: 'san', label: 'Sanity', abbreviation: 'san' },
      ],
      skills: [{ id: 'eti', label: 'Etiquette' }],
    })
    // A game in French, its names from a translation module.
    const french = gameNames({
      abilities: [
        { id: 'wis', label: 'Sagesse', abbreviation: 'SAG' },
        { id: 'san', label: 'Santé mentale', abbreviation: 'SAN' },
      ],
      skills: [],
    })

    it.each<[TableAsk, string]>([
      [
        { type: 'save', abilities: ['san'], dc: 13 },
        'DC 13 Sanity saving throw',
      ],
      [
        { type: 'save', abilities: ['wis', 'san'] },
        'Wisdom or Sanity saving throw',
      ],
      [
        { type: 'concentration', abilities: ['san'] },
        'Concentration check (Sanity)',
      ],
      [
        {
          type: 'check',
          checks: [{ type: 'skill', ability: 'hon', skill: 'eti' }],
          dc: 12,
        },
        'DC 12 Honor (Etiquette) check',
      ],
      [
        {
          type: 'check',
          checks: [
            { type: 'check', ability: 'wis' },
            { type: 'check', ability: 'hon' },
          ],
        },
        'Wisdom or Honor check',
      ],
    ])("words %j by the sheet's names as %s", (ask, title) => {
      expect(askTitle(ask, names)).toBe(title)
    })

    it("names abilities in the game's own language, the app's words around them", () => {
      expect(
        askTitle({ type: 'save', abilities: ['wis', 'san'] }, french),
      ).toBe('Sagesse or Santé mentale saving throw')
    })

    it('names an ability no sheet names by its key', () => {
      expect(askTitle({ type: 'save', abilities: ['san'] })).toBe(
        'san saving throw',
      )
    })
  })
})
