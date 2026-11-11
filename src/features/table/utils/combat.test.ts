import { hpBar, isMyTurn, seatTurn } from './combat'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { TableCombatant } from '@/types/table'

/** A combatant as the page shows it, one of the party's, with the fields a case gives it. */
const combatant = (fields: Partial<TableCombatant>): TableCombatant => ({
  id: 'c-brakka',
  name: 'Brakka',
  initiative: 18,
  defeated: false,
  side: 'party',
  ...fields,
})

describe('features/table/utils/combat', () => {
  describe('seatTurn', () => {
    it.each([
      ['the character’s turn', { side: 'me' as const }, {}],
      [
        'the turn of the companion the seat is at, as its own',
        { side: 'me' as const, companion: 'wolfBrakka' },
        {},
      ],
      [
        'a companion’s turn, by its key',
        { yours: true as const, companion: 'wolfBrakka' },
        { companion: 'wolfBrakka' },
      ],
      [
        'no companion’s turn for an empty key',
        { yours: true as const, companion: '' },
        undefined,
      ],
      ['no gone companion’s turn', { yours: true as const }, undefined],
      ['no other player’s turn', {}, undefined],
      ['no foe’s turn', { side: 'other' as const }, undefined],
    ])('takes %s', (_, fields, own) => {
      expect(seatTurn(combatant(fields))).toEqual(own)
    })
  })

  // The rule the Combat tab's mark and the companions' tabs' marks follow (`isTurnOf`): a turn
  // only in an encounter under way, never one begun that isn't the tracker's, though it names who
  // acts (item 19).
  describe('isMyTurn', () => {
    it.each([
      ['the character’s, under way', true, {}],
      ['a companion’s, under way', true, { currentId: 'c-brakka' }],
      ['a foe’s', false, { currentId: 'c-goblin' }],
      ['the character’s, not under way', false, { underWay: false }],
    ])('takes a turn, %s, as the seat’s: %p', (_, mine, fields) => {
      expect(isMyTurn(mockTurnCombat(fields))).toBe(mine)
    })
  })

  describe('hpBar', () => {
    it.each([
      ['a living sliver', { value: 1, max: 250, temp: 0 }, 1, 'bg-warning'],
      ['down at none', { value: 0, max: 250, temp: 0 }, 0, 'bg-danger'],
    ])('draws %s', (_, hp, percent, bar) => {
      expect(hpBar(hp)).toEqual({ percent, bar })
    })
  })
})
