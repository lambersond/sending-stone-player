/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import {
  castAtLevel,
  defaultPool,
  groupActions,
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
    it('groups what she carries by kind, then spells as the spellbook does, then features, each in order', () => {
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
        ['equipment', 'Equipment', null, ['Cloak of Displacement']],
        ['consumables', 'Consumables', null, ['Potion of Healing']],
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
      ])
    })

    it("puts the rest of what she carries in its kinds, in the inventory's order", () => {
      const groups = groupActions(
        [
          sheetAction({ id: 'odd', name: 'Bastion Bell', type: 'facility' }),
          sheetAction({ id: 'gem', name: 'Ruby', type: 'loot' }),
          sheetAction({ id: 'pack', name: 'Bag of Tricks', type: 'container' }),
          sheetAction({ id: 'kit', name: "Thieves' Tools", type: 'tool' }),
        ],
        spellbook,
      )

      expect(groups.map(group => [group.id, group.label])).toEqual([
        ['tools', 'Tools'],
        ['containers', 'Containers'],
        ['loot', 'Loot'],
        ['items', 'Items'],
      ])
    })

    it("puts spells cast from an item under its name, after the spellbook's, whether the spellbook shows them or not", () => {
      const wand = { id: 'wand', name: 'Wand of Magic Missiles' }
      const groups = groupActions(
        [
          spell('door', 'Dimension Door', 4),
          {
            ...spell('coat-hands', 'Burning Hands', 1),
            castFrom: { id: 'coat', name: 'Cinder Coat' },
          },
          { ...spell('wand-missile', 'Magic Missile', 1), castFrom: wand },
          { ...spell('wand-ray', 'Ray of Sickness', 1), castFrom: wand },
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
        ['spells-innate', 'Innate Spellcasting', null, ['Hellish Rebuke']],
        ['spells-spell4', '4th Level', null, ['Dimension Door']],
        ['from-coat', 'Cinder Coat', null, ['Burning Hands']],
        [
          'from-wand',
          'Wand of Magic Missiles',
          null,
          ['Magic Missile', 'Ray of Sickness'],
        ],
      ])
    })

    it("puts spells the spellbook doesn't show, from an older module that doesn't say what they're cast from, with its spells from items", () => {
      const scroll = spell('scroll-sleep', 'Sleep', 1)
      const withItems = groupActions(
        [scroll, spell('wand-missile', 'Magic Missile', 1)],
        spellbook,
      )
      expect(
        withItems.map(group => [
          group.id,
          group.label,
          group.actions.map(action => action.name),
        ]),
      ).toEqual([
        ['spells-item', 'Additional Spells', ['Sleep', 'Magic Missile']],
      ])

      const withoutItems = groupActions(
        [spell('missile', 'Magic Missile', 1), scroll],
        spellbook.filter(section => section.id !== 'item'),
      )
      expect(withoutItems.map(group => [group.id, group.label])).toEqual([
        ['spells-spell1', '1st Level'],
        ['spells-item', 'Additional Spells'],
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

  describe('defaultPool and castAtLevel', () => {
    it("picks a spell's own slots, else the lowest spell level's left, then pact magic's, as dnd5e does", () => {
      const missile = spell('missile', 'Magic Missile', 1)
      expect(defaultPool(missile, spellbook)?.id).toBe('spell2')
      expect(defaultPool(spell('hex', 'Hex', 1), spellbook)?.id).toBe('pact')
      expect(defaultPool(spell('fireball', 'Fireball', 3), spellbook)?.id).toBe(
        'spell3',
      )
      const spent = spellbook.map(section =>
        section.slots
          ? { ...section, slots: { ...section.slots, value: 0 } }
          : section,
      )
      expect(defaultPool(missile, spent)).toBeNull()
      expect(defaultPool(spell('bolt', 'Fire Bolt', 0), spellbook)).toBeNull()
    })

    it("uses an activity that spends no slot at its spell's own level, whether any is left or not", () => {
      // Magic Missile's own slots, 1st level, have none left.
      const darts = {
        ...spell('missile', 'Magic Missile', 1),
        consumesSlot: false,
      }
      expect(defaultPool(darts, spellbook)?.id).toBe('spell1')
      expect(castAtLevel(darts, spellbook)).toBe(1)
    })

    it('casts a spell at the level of the slots chosen, else of those dnd5e picks, else its own', () => {
      const missile = spell('missile', 'Magic Missile', 1)
      expect(castAtLevel(missile, spellbook)).toBe(2)
      expect(castAtLevel(missile, spellbook, 'spell3')).toBe(3)
      expect(castAtLevel(spell('bolt', 'Fire Bolt', 0), spellbook)).toBe(0)
      expect(
        castAtLevel(sheetAction({ id: 'dagger', name: 'Dagger' }), spellbook),
      ).toBeNull()
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

  describe('outOfSlots for an activity that spends none', () => {
    it('is never out of them', () => {
      const aura = { ...spell('shield', 'Shield', 1), consumesSlot: false }
      expect(outOfSlots(aura, [pool(0), pool(0)])).toBe(false)
    })
  })

  it('names pools and ordinals shortly', () => {
    expect(named('spell3', '3rd Level', 3)).toBe('3rd')
    expect(named('pact', 'Pact Magic — 2nd Level', 2)).toBe('Pact 2nd')
    expect(named('pact', 'Pact Magic', null)).toBe('Pact')
    expect(named('arcane', 'Arcane Slots', 5)).toBe('Arcane Slots')
    expect([1, 2, 3, 4, 9].map(level => ordinal(level))).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '9th',
    ])
  })
})
