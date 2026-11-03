import { checkDamageDice, isSeatCombatant } from './roll-requests'
import { combat, combatant, mockTableDamage } from '@/mocks/sending-stone'
import type { RollRequestInput } from '@/types/roll'

const request = (fields: Partial<RollRequestInput>): RollRequestInput => ({
  kind: 'skill',
  key: 'prc',
  mode: 0,
  explicit: false,
  extras: [],
  dice: [{ faces: 20, results: [14] }],
  ...fields,
})

const alone = (fields: Partial<RollRequestInput> = {}) =>
  request({
    kind: 'itemDamage',
    key: undefined,
    item: 'wolfBite',
    activity: 'biteAttack',
    dice: [{ faces: 8, results: [5] }],
    ...fields,
  })

describe('utils/roll-requests for companions, from module 0.36.0', () => {
  /** A fight with Thorin, his wolf and a goblin, the wolf yet to roll. */
  const fight = combat({
    combatants: [
      combatant({ id: 'c-thorin', character: 'actor-thorin', initiative: 18 }),
      combatant({ id: 'c-wolf', companion: 'wolfBrakka', initiative: null }),
      combatant({ id: 'c-goblin', name: 'Goblin' }),
    ],
  })

  it('takes the seat’s own combatant as its character’s, or the companion’s by its key', () => {
    const [thorin, wolf, goblin] = fight.combatants
    expect(isSeatCombatant(thorin, 'actor-thorin')).toBe(true)
    expect(isSeatCombatant(wolf, 'wolfBrakka')).toBe(true)
    expect(isSeatCombatant(wolf, 'actor-thorin')).toBe(false)
    expect(isSeatCombatant(goblin, 'wolfBrakka')).toBe(false)
    expect(isSeatCombatant(thorin, 'wolfBrakka')).toBe(false)
  })

  describe('damage on its own', () => {
    it('checks its dice as an attack’s due damage is checked', () => {
      const { normal } = mockTableDamage()
      expect(checkDamageDice(alone(), normal)).toBeUndefined()
      expect(
        checkDamageDice(
          alone({
            dice: [{ faces: 8, results: [5, 6] }],
            modifiers: { extra: 1 },
          }),
          normal,
        ),
      ).toBeUndefined()
      expect(checkDamageDice(alone({ modifiers: { extra: 1 } }), normal)).toBe(
        'dice',
      )
      expect(checkDamageDice(alone({ types: [null] }), normal)).toBeUndefined()
      expect(checkDamageDice(alone({ types: ['cold'] }), normal)).toBe('type')
    })
  })
})
