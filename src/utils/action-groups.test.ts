/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  groupActions,
  levelLabel,
  ordinal,
  outOfSlots,
  poolName,
  slotPools,
  type SlotPool,
} from './action-groups'
import { sheetAction, sheetSpell } from '@/mocks/sending-stone'
import type { SheetSpellSection } from '@/types/sending-stone'

/** A warlock-wizard's spellbook, in dnd5e's order. */
const spellbook: SheetSpellSection[] = [
  {
    id: 'innate',
    label: 'Innate Spellcasting',
    slots: null,
    spells: [sheetSpell({ id: 'rebuke', name: 'Hellish Rebuke', level: 1 })],
  },
  {
    id: 'spell0',
    label: 'Cantrips',
    slots: null,
    spells: [sheetSpell({ id: 'bolt', name: 'Fire Bolt', level: 0 })],
  },
  {
    id: 'pact',
    label: 'Pact Magic — 2nd Level',
    slots: { value: 2, max: 2, level: 2 },
    spells: [sheetSpell({ id: 'hex', name: 'Hex', level: 1 })],
  },
  {
    id: 'spell1',
    label: '1st Level',
    slots: { value: 0, max: 4, level: 1 },
    spells: [
      sheetSpell({ id: 'shield', name: 'Shield', level: 1 }),
      sheetSpell({ id: 'missile', name: 'Magic Missile', level: 1 }),
    ],
  },
  {
    id: 'spell2',
    label: '2nd Level',
    slots: { value: 1, max: 3, level: 2 },
    spells: [sheetSpell({ id: 'mirror', name: 'Mirror Image', level: 2 })],
  },
  {
    id: 'spell3',
    label: '3rd Level',
    slots: { value: 1, max: 2, level: 3 },
    spells: [sheetSpell({ id: 'fireball', name: 'Fireball', level: 3 })],
  },
  {
    id: 'spell4',
    label: '4th Level',
    slots: { value: 0, max: 0, level: 4 },
    spells: [sheetSpell({ id: 'door', name: 'Dimension Door', level: 4 })],
  },
  {
    id: 'item',
    label: 'Additional Spells',
    slots: null,
    spells: [
      sheetSpell({ id: 'wand-missile', name: 'Magic Missile', level: 1 }),
    ],
  },
]

const spell = (id: string, name: string, level: number) =>
  sheetAction({ id, name, type: 'spell', level })

/** First-level slots, of which this many are left. */
const pool = (value: number): SlotPool => ({
  id: 'spell1',
  label: '1st Level',
  level: 1,
  value,
  max: 2,
})

/** A pool's short name, from its id, label and level. */
const named = (id: string, label: string, level: number | null) =>
  poolName({ id, label, level, value: 1, max: 1 })

describe('utils/action-groups', () => {
  describe('groupActions', () => {
    it('groups weapons, spells as the spellbook does, features, then items, each in order', () => {
      const groups = groupActions(
        [
          sheetAction({
            id: 'potion',
            name: 'Potion of Healing',
            type: 'consumable',
          }),
          spell('fireball', 'Fireball', 3),
          sheetAction({ id: 'dagger', name: 'Dagger', type: 'weapon' }),
          sheetAction({ id: 'breath', name: 'Fire Breath' }),
          spell('bolt', 'Fire Bolt', 0),
          sheetAction({ id: 'staff', name: 'Staff of Fire', type: 'weapon' }),
          spell('missile', 'Magic Missile', 1),
          spell('hex', 'Hex', 1),
          spell('shield', 'Shield', 1),
          sheetAction({
            id: 'cloak',
            name: 'Cloak of Displacement',
            type: 'equipment',
          }),
          spell('rebuke', 'Hellish Rebuke', 1),
        ],
        spellbook,
      )

      expect(
        groups.map(group => [
          group.id,
          group.label,
          group.slots,
          group.actions.map(action => action.name),
        ]),
      ).toEqual([
        ['weapons', 'Weapons', null, ['Dagger', 'Staff of Fire']],
        ['spells-innate', 'Innate Spellcasting', null, ['Hellish Rebuke']],
        ['spells-spell0', 'Cantrips', null, ['Fire Bolt']],
        [
          'spells-pact',
          'Pact Magic — 2nd Level',
          { value: 2, max: 2 },
          ['Hex'],
        ],
        [
          'spells-spell1',
          '1st Level',
          { value: 0, max: 4 },
          ['Magic Missile', 'Shield'],
        ],
        ['spells-spell3', '3rd Level', { value: 1, max: 2 }, ['Fireball']],
        ['features', 'Features', null, ['Fire Breath']],
        [
          'items',
          'Items',
          null,
          ['Potion of Healing', 'Cloak of Displacement'],
        ],
      ])
    })

    it("shows no slots for a level the character has none of, and puts spells the spellbook doesn't show by their level", () => {
      const groups = groupActions(
        [
          spell('door', 'Dimension Door', 4),
          spell('scroll-bolt', 'Ray of Frost', 0),
          spell('scroll-sleep', 'Sleep', 1),
          sheetAction({ id: 'odd', name: 'Odd Spell', type: 'spell' }),
        ],
        spellbook,
      )

      expect(groups.map(group => [group.label, group.slots])).toEqual([
        ['4th Level', null],
        ['Cantrips', null],
        ['1st Level', null],
      ])
      expect(groups.map(group => group.id)).toEqual([
        'spells-spell4',
        'spells-level0',
        'spells-level1',
      ])
      expect(groups[1].actions.map(action => action.name)).toEqual([
        'Ray of Frost',
        'Odd Spell',
      ])
    })

    it('has no groups for no actions', () => {
      expect(groupActions([], spellbook)).toEqual([])
    })
  })

  describe('slotPools', () => {
    it("offers every level's slots and pact magic's at the spell's level or higher, lowest first", () => {
      expect(
        slotPools(spell('missile', 'Magic Missile', 1), spellbook),
      ).toEqual([
        { id: 'spell1', label: '1st Level', level: 1, value: 0, max: 4 },
        {
          id: 'pact',
          label: 'Pact Magic — 2nd Level',
          level: 2,
          value: 2,
          max: 2,
        },
        { id: 'spell2', label: '2nd Level', level: 2, value: 1, max: 3 },
        { id: 'spell3', label: '3rd Level', level: 3, value: 1, max: 2 },
      ])
      expect(
        slotPools(spell('fireball', 'Fireball', 3), spellbook)?.map(
          pool => pool.id,
        ),
      ).toEqual(['spell3'])
      expect(slotPools(spell('hex', 'Hex', 1), spellbook)).toHaveLength(4)
      expect(slotPools(spell('door', 'Dimension Door', 4), spellbook)).toEqual(
        [],
      )
    })

    it('has none for a spell cast without slots, or for anything else', () => {
      expect(slotPools(spell('bolt', 'Fire Bolt', 0), spellbook)).toBeNull()
      expect(
        slotPools(spell('rebuke', 'Hellish Rebuke', 1), spellbook),
      ).toBeNull()
      expect(
        slotPools(spell('wand-missile', 'Magic Missile', 1), spellbook),
      ).toBeNull()
      expect(slotPools(spell('scroll', 'Sleep', 1), spellbook)).toBeNull()
      expect(
        slotPools(sheetAction({ id: 'dagger', name: 'Dagger' }), spellbook),
      ).toBeNull()
    })

    it('takes a spell level from its section, and offers pact magic of no known level, from an older module', () => {
      const older = spellbook.map(section =>
        section.slots
          ? {
              ...section,
              slots: { value: section.slots.value, max: section.slots.max },
            }
          : section,
      )
      expect(
        slotPools(spell('mirror', 'Mirror Image', 2), older)?.map(pool => [
          pool.id,
          pool.level,
        ]),
      ).toEqual([
        ['spell2', 2],
        ['spell3', 3],
        ['pact', null],
      ])
    })
  })

  describe('outOfSlots', () => {
    it('says so when no slot is left that could cast the spell, nor a use of its own', () => {
      const shield = spell('shield', 'Shield', 1)
      expect(outOfSlots(shield, [pool(0), pool(0)])).toBe(true)
      expect(outOfSlots(shield, [])).toBe(true)
      expect(outOfSlots(shield, [pool(0), pool(1)])).toBe(false)
      expect(outOfSlots(shield, null)).toBe(false)
      expect(
        outOfSlots(
          { ...shield, uses: { value: 1, max: 1, recovery: 'Long Rest' } },
          [pool(0)],
        ),
      ).toBe(false)
    })
  })

  it('names pools, levels and ordinals shortly', () => {
    expect(named('spell3', '3rd Level', 3)).toBe('3rd')
    expect(named('pact', 'Pact Magic — 2nd Level', 2)).toBe('Pact 2nd')
    expect(named('pact', 'Pact Magic', null)).toBe('Pact')
    expect(named('arcane', 'Arcane Slots', 5)).toBe('Arcane Slots')
    expect(levelLabel(0)).toBe('Cantrips')
    expect(levelLabel(2)).toBe('2nd Level')
    expect([1, 2, 3, 4, 9].map(level => ordinal(level))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '9th',
    ])
  })
})
