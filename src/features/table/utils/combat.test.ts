import { hpBar, isMyTurn, noCombatLines, seatTurn } from './combat'
import { mockTurnCombat } from '@/mocks/sending-stone'
import type { TableCombat, TableCombatant } from '@/types/table'

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
      [
        'the character’s, begun, not the tracker’s',
        false,
        { underWay: false, active: false },
      ],
    ])('takes a turn, %s, as the seat’s: %p', (_, mine, fields) => {
      expect(isMyTurn(mockTurnCombat(fields))).toBe(mine)
    })
  })

  // What the Combat tab says with no encounter under way (v0.45, the owner's decision 1): the line
  // to roll initiative only in the tracker's encounter before Begin Combat, the one the game takes
  // it into; nothing beneath the heading in one begun that isn't the tracker's.
  describe('noCombatLines', () => {
    const thorin = { initiative: null, side: 'me' as const }
    const setUp = (fields: Partial<TableCombat>, waiting: TableCombatant) =>
      mockTurnCombat({
        underWay: false,
        round: 0,
        currentId: undefined,
        combatants: [combatant({ id: 'c-goblin', side: 'other' }), waiting],
        ...fields,
      })

    it.each([
      ['no encounter', 'order', undefined],
      [
        'the tracker’s, not begun, the character without initiative',
        'roll',
        setUp({}, combatant({ id: 'c-thorin', ...thorin })),
      ],
      [
        'the tracker’s, not begun, a companion of the character without initiative',
        'roll',
        setUp(
          {},
          combatant({ initiative: null, yours: true, companion: 'wolfBrakka' }),
        ),
      ],
      [
        'the tracker’s, not begun, another of the party without initiative',
        'order',
        setUp({}, combatant({ initiative: null })),
      ],
      [
        'the tracker’s, not begun, the character with initiative',
        'order',
        setUp({}, combatant({ id: 'c-thorin', side: 'me' })),
      ],
      [
        'not the tracker’s, not begun, the character without initiative',
        'order',
        setUp({ active: false }, combatant({ id: 'c-thorin', ...thorin })),
      ],
      [
        'begun, not the tracker’s, the character without initiative',
        'none',
        setUp(
          { active: false, round: 2, currentId: 'c-goblin' },
          combatant({ id: 'c-thorin', ...thorin }),
        ),
      ],
      [
        'begun, not the tracker’s, no one waiting',
        'none',
        mockTurnCombat({ underWay: false, active: false, round: 3 }),
      ],
    ])('says, for %s: %s', (_, lines, combat) => {
      expect(noCombatLines(combat)).toBe(lines)
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
