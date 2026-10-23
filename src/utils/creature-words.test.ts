/* eslint-disable unicorn/no-null -- the protocol uses null for an absent value */
import {
  afterWords,
  creatureLine,
  crWords,
  rechargeWords,
  relationWords,
} from './creature-words'
import { mockCreature } from '@/mocks/sending-stone'

describe('utils/creature-words', () => {
  describe('creatureLine', () => {
    it('says its size and type, then its alignment', () => {
      expect(creatureLine(mockCreature())).toBe('Medium Beast, Unaligned')
    })

    it('leaves out each part it has none of', () => {
      expect(
        creatureLine(
          mockCreature({ size: 'Tiny', type: 'Fey', alignment: null }),
        ),
      ).toBe('Tiny Fey')
      expect(
        creatureLine(
          mockCreature({
            size: null,
            type: 'Undead',
            alignment: 'Chaotic Evil',
          }),
        ),
      ).toBe('Undead, Chaotic Evil')
      expect(
        creatureLine(
          mockCreature({ size: null, type: null, alignment: 'Neutral' }),
        ),
      ).toBe('Neutral')
    })

    it('says nothing where it has none of them, or there is no creature', () => {
      expect(
        creatureLine(mockCreature({ size: null, type: null, alignment: null })),
      ).toBeUndefined()
      expect(creatureLine()).toBeUndefined()
    })
  })

  describe('relationWords', () => {
    it('names the character an owned one is a companion of', () => {
      expect(relationWords({ kind: 'owned', of: 'Thorin' })).toBe(
        'Thorin’s companion',
      )
    })

    it('says who summoned one, and with what where that is known', () => {
      expect(
        relationWords({
          kind: 'summoned',
          of: 'Thorin',
          from: 'Find Familiar',
        }),
      ).toBe('Summoned by Thorin with Find Familiar')
      expect(relationWords({ kind: 'summoned', of: 'Thorin' })).toBe(
        'Summoned by Thorin',
      )
    })
  })

  describe('crWords', () => {
    it("writes a challenge rating's fractions as dnd5e does", () => {
      expect(crWords(0.125)).toBe('1/8')
      expect(crWords(0.25)).toBe('1/4')
      expect(crWords(0.5)).toBe('1/2')
    })

    it('writes any other as its number, and none for none', () => {
      expect(crWords(17)).toBe('17')
      expect(crWords(0)).toBe('0')
      expect(crWords(null)).toBeUndefined()
    })
  })

  describe('rechargeWords', () => {
    it('says the lowest d6 that recharges it, or a 6 alone', () => {
      expect(rechargeWords(5)).toBe('Recharge 5–6')
      expect(rechargeWords(4)).toBe('Recharge 4–6')
      expect(rechargeWords(6)).toBe('Recharge 6')
    })
  })

  describe('afterWords', () => {
    it('names whom a companion acts right after', () => {
      expect(afterWords('Thorin')).toBe('After Thorin')
    })
  })
})
