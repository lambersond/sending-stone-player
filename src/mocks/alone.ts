/* eslint-disable unicorn/no-null -- the sheet uses null for an absent value */
import { characterSheet, sheetAction } from '@/mocks/sending-stone'
import type {
  CharacterSheet,
  DamagePreview,
  SheetAction,
  SheetUse,
  TableDamagePlan,
} from '@/types/sending-stone'

/*
 * Damage on its own and recharges (module 0.36.0), as the sheet sends them: a Draconic Spirit's
 * actions, each with the dice the game said it throws on its own, and breaths that recharge.
 */

/** Damage or healing as the game plans it: one roll, of the dice given. */
export function planned(
  formula: string,
  type: string | null,
  dice: { faces: number; number: number }[],
  fields: Partial<DamagePreview> = {},
): DamagePreview {
  return {
    critical: false,
    plannable: true,
    rolls: [{ formula, type, dice, perDie: 1 }],
    ...fields,
  }
}

/** An activity the game uses, as the module describes it. */
export function usedBy(id: string, type: SheetUse['type']): SheetUse {
  return {
    id,
    type,
    targets: {
      self: type === 'heal',
      area: type === 'save',
      count: null,
      perLevel: null,
      affects: null,
    },
  }
}

/** A longsword: an attack, its damage 1d8 + 4 on its own, 2d8 + 4 as a critical hit's. */
export function longsword(fields: Partial<SheetAction> = {}): SheetAction {
  const plan: TableDamagePlan = {
    normal: planned('1d8 + 4', 'Slashing', [{ faces: 8, number: 1 }]),
    critical: {
      ...planned('2d8 + 4', 'Slashing', [{ faces: 8, number: 2 }]),
      critical: true,
      rolls: [
        {
          formula: '2d8 + 4',
          type: 'Slashing',
          dice: [{ faces: 8, number: 2 }],
          perDie: 2,
        },
      ],
    },
  }
  return sheetAction({
    id: 'longsword',
    name: 'Longsword',
    type: 'weapon',
    toHit: 7,
    attackId: 'longswordAttack',
    damage: [{ formula: '1d8 + 4', type: 'Slashing', healing: false }],
    tableDamage: plan,
    ...fields,
  })
}

/**
 * Fire Breath: a DEX 14 save at an area, its 2d6 fire never a critical hit's, recharging on a 5
 * or 6, its one use spent.
 */
export function fireBreath(fields: Partial<SheetAction> = {}): SheetAction {
  return sheetAction({
    id: 'fireBreath',
    name: 'Fire Breath',
    range: '30 ft cone',
    activity: usedBy('breathSave', 'save'),
    save: { ability: 'DEX', dc: 14 },
    damage: [{ formula: '2d6', type: 'Fire', healing: false }],
    tableDamage: {
      normal: planned('2d6', 'Fire', [{ faces: 6, number: 2 }]),
      critical: null,
    },
    uses: {
      value: 0,
      max: 1,
      recovery: 'Recharge [5+]',
      recharge: 5,
      counter: { item: 'fireBreath' },
    },
    ...fields,
  })
}

/** Second Wind: healing, 1d10 + 5, never a critical hit's. */
export function secondWind(fields: Partial<SheetAction> = {}): SheetAction {
  return sheetAction({
    id: 'secondWind',
    name: 'Second Wind',
    activation: 'Bonus Action',
    activity: usedBy('windHeal', 'heal'),
    damage: [{ formula: '1d10 + 5', type: 'Healing', healing: true }],
    tableDamage: {
      normal: planned('1d10 + 5', 'Healing', [{ faces: 10, number: 1 }], {
        healing: true,
      }),
      critical: null,
    },
    ...fields,
  })
}

/** Chromatic Orb: an attack whose 3d8 is fire or cold, as its roller chooses. */
export function chromaticOrb(fields: Partial<SheetAction> = {}): SheetAction {
  const roll = {
    formula: '3d8',
    type: null,
    types: [
      { key: 'fire', label: 'Fire' },
      { key: 'cold', label: 'Cold' },
    ],
    dice: [{ faces: 8, number: 3 }],
    perDie: 1,
  }
  return sheetAction({
    id: 'orb',
    name: 'Chromatic Orb',
    type: 'spell',
    level: 1,
    toHit: 5,
    attackId: 'orbAttack',
    damage: [{ formula: '3d8', type: 'Fire or Cold', healing: false }],
    tableDamage: {
      normal: { critical: false, plannable: true, rolls: [roll] },
      critical: {
        critical: true,
        plannable: true,
        rolls: [
          {
            ...roll,
            formula: '6d8',
            dice: [{ faces: 8, number: 6 }],
            perDie: 2,
          },
        ],
      },
    },
    ...fields,
  })
}

/**
 * Lightning Breath: a save whose two uses are its activity's own, recharging only on a 6, one of
 * them spent.
 */
export function lightningBreath(
  fields: Partial<SheetAction> = {},
): SheetAction {
  return sheetAction({
    id: 'lightningBreath',
    name: 'Lightning Breath',
    activity: usedBy('lightningSave', 'save'),
    save: { ability: 'DEX', dc: 13 },
    damage: [{ formula: '4d6', type: 'Lightning', healing: false }],
    tableDamage: {
      normal: planned('4d6', 'Lightning', [{ faces: 6, number: 4 }]),
      critical: null,
    },
    uses: {
      value: 1,
      max: 2,
      recovery: 'Recharge [6]',
      recharge: 6,
      counter: { item: 'lightningBreath', activity: 'lightningSave' },
    },
    ...fields,
  })
}

/** The Draconic Spirit's sheet: its actions above, all under Actions, but as given. */
export function spiritSheet(
  actions: SheetAction[] = [
    longsword(),
    fireBreath(),
    secondWind(),
    chromaticOrb(),
    lightningBreath(),
  ],
  fields: Partial<CharacterSheet> = {},
): CharacterSheet {
  return characterSheet({
    actions: [{ id: 'action', label: 'Actions', actions }],
    ...fields,
  })
}
