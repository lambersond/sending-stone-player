import { companionAsks } from './companion-asks'

const NOW = Date.parse('2026-10-08T12:05:00Z')
const at = (time: string) => new Date(`2026-10-08T${time}Z`)

/** What a companion's one prompt asks for, in words. */
const wordsOf = (data: object) =>
  companionAsks(
    [
      {
        actorId: 'wolfBrakka',
        data,
        expiresAt: new Date('2026-10-08T12:10:00Z'),
      },
    ],
    Date.parse('2026-10-08T12:05:00Z'),
  )[0].label

describe('utils/companion-asks', () => {
  describe('companionAsks', () => {
    it('marks each companion asked now once, in the order first asked: its first prompt still waiting, and the soonest time one stops', () => {
      expect(
        companionAsks(
          [
            // Its time run out a moment ago: it waits no more.
            {
              actorId: 'sceneFrost-tokenImp',
              data: { type: 'save', abilities: ['dex'] },
              expiresAt: at('12:04:55'),
            },
            {
              actorId: 'wolfBrakka',
              data: { type: 'save', abilities: ['dex', 'str'] },
              expiresAt: at('12:10:00'),
            },
            {
              actorId: 'sceneFrost-tokenImp',
              data: { type: 'check', abilities: ['con'] },
              expiresAt: at('12:09:00'),
            },
            {
              actorId: 'wolfBrakka',
              data: { type: 'save', abilities: ['wis'] },
              expiresAt: at('12:06:00'),
            },
          ],
          NOW,
        ),
      ).toEqual([
        {
          key: 'wolfBrakka',
          label: 'Dexterity or Strength saving throw',
          expiresAt: '2026-10-08T12:06:00.000Z',
        },
        {
          key: 'sceneFrost-tokenImp',
          label: 'Constitution check',
          expiresAt: '2026-10-08T12:09:00.000Z',
        },
      ])
    })

    it('marks none asked where every prompt has run out', () => {
      expect(
        companionAsks(
          [
            {
              actorId: 'wolfBrakka',
              data: { type: 'save', abilities: ['dex'] },
              expiresAt: new Date(NOW),
            },
          ],
          NOW,
        ),
      ).toEqual([])
    })

    it('words what each asks for as the banner does', () => {
      expect(wordsOf({ type: 'save', abilities: ['dex'] })).toBe(
        'Dexterity saving throw',
      )
      expect(wordsOf({ type: 'concentration', abilities: ['con'] })).toBe(
        'Concentration check',
      )
      expect(wordsOf({ type: 'concentration', abilities: ['wis'] })).toBe(
        'Concentration check (Wisdom)',
      )
      expect(wordsOf({ type: 'check', abilities: ['str', 'dex'] })).toBe(
        'Strength or Dexterity check',
      )
      expect(wordsOf({ type: 'save', abilities: [] })).toBe('saving throw')
    })

    it("words Midi-QOL's skill checks, and a key it knows no name of as it is", () => {
      expect(wordsOf({ type: 'skill', skills: ['ath', 'acr'] })).toBe(
        'Athletics or Acrobatics check',
      )
      expect(wordsOf({ type: 'save', abilities: ['san'] })).toBe(
        'san saving throw',
      )
      expect(wordsOf({ type: 'concentration' })).toBe('Concentration check')
    })
  })
})
