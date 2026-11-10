/**
 * @jest-environment node
 */
import {
  ANSWER_KINDS,
  kindsWhere,
  NO_DICE,
  OWN_KINDS,
  ROLL_KIND_INFO,
} from './roll-kinds'
import { ROLL_KINDS } from './sending-stone'
import type { RollKindInfo } from '@/types/roll'

/** Each kind's value of one of its rows' fields, for the kinds that have it. */
function byKind(field: 'gmLabel' | 'check' | 'own') {
  return Object.fromEntries(
    ROLL_KINDS.flatMap(kind => {
      const info: RollKindInfo = ROLL_KIND_INFO[kind]
      const value = info[field]
      return value === undefined ? [] : [[kind, value]]
    }),
  )
}

const dice = (group: string) =>
  kindsWhere(kind => ROLL_KIND_INFO[kind].dice === group)

// Each list as the code said it by hand when the table was made (24f808b), copied once; with the
// kinds of module 0.44.0 since, a plain roll and hit points set (v0.44), and of module 0.45.0, the
// dice the game asks for (item 11).
describe('constants/roll-kinds, the request-kind table', () => {
  it('has a row for each kind, in ROLL_KINDS’ order', () => {
    expect(Object.keys(ROLL_KIND_INFO)).toEqual([...ROLL_KINDS])
  })

  // The lists read in order: the schema's effect dice kinds as declared, the Prisma `in` of an
  // earlier answer (db/roll-requests.ts:323), and the kinds withheld, or never another's
  // (db/roll-requests.ts:154, :572-581).
  it.each([
    [
      'the d20 rolls, as EFFECT_DICE_KINDS (constants/sending-stone.ts:215)',
      dice('d20'),
      ['skill', 'tool', 'ability', 'save', 'death', 'initiative', 'attack'],
    ],
    ['ANSWER_KINDS', ANSWER_KINDS, ['save', 'ability', 'skill']],
    [
      'OWN_KINDS',
      OWN_KINDS,
      ['transfer', 'remove', 'favorite', 'effect', 'wildShape', 'hitPoints'],
    ],
  ])('%s, in order', (_, derived, literal) => {
    expect(derived).toEqual(literal)
  })

  // The lists only asked whether they have a kind.
  it.each([
    [
      'the d20 rolls (utils/roll-requests.ts:1507 D20_KINDS)',
      dice('d20'),
      ['skill', 'ability', 'tool', 'save', 'death', 'initiative', 'attack'],
    ],
    [
      'hit dice as they are (schemas/roll-request.ts:862)',
      dice('hitDice'),
      ['hitDice'],
    ],
    [
      'a recharge’s one d6 (schemas/roll-request.ts:876)',
      dice('recharge'),
      ['recharge'],
    ],
    ['a plain roll’s dice, as it names them', dice('plain'), ['plainRoll']],
    [
      'their own dice (schemas/roll-request.ts:896)',
      dice('free'),
      ['damage', 'textDamage', 'itemDamage', 'hitDie', 'formula', 'textRoll'],
    ],
    [
      'no dice (schemas/roll-request.ts:847, with OWN_FIELDS’ kinds)',
      dice('none'),
      [
        'use',
        'ask',
        'endEnchantment',
        'endConcentration',
        'spend',
        'inspiration',
        'spellSlot',
        'transfer',
        'remove',
        'favorite',
        'effect',
        'wildShape',
        'prepare',
        'hitPoints',
        'endTurn',
        'undoEndTurn',
        // Changed on purpose (item 11): its values are its answer's, never thrown dice.
        'dice',
      ],
    ],
    [
      'damage (utils/roll-requests.ts:1594, roll-tray.tsx:1652, schemas :733)',
      kindsWhere(kind => 'damage' in ROLL_KIND_INFO[kind]),
      ['damage', 'textDamage', 'itemDamage'],
    ],
    [
      'summed (utils/roll-requests.ts:1591 SUMMED)',
      kindsWhere(kind => 'summed' in ROLL_KIND_INFO[kind]),
      // Changed on purpose (item 11): the rolls the game makes of an ask add up, as damage's do.
      ['damage', 'textDamage', 'itemDamage', 'hitDice', 'dice'],
    ],
    [
      'checks (schemas :60, db/roll-requests.ts:225, use-sheet-roller.ts:86, use-table-rolls.ts:1405)',
      kindsWhere(kind => 'check' in ROLL_KIND_INFO[kind]),
      ['skill', 'tool', 'ability'],
    ],
    [
      'keyed (schemas/roll-request.ts:793, :54 LINKABLE)',
      kindsWhere(kind => 'keyed' in ROLL_KIND_INFO[kind]),
      ['skill', 'tool', 'ability', 'save'],
    ],
    [
      'from a description’s link only (schemas/roll-request.ts:48 FROM_TEXT)',
      kindsWhere(kind => 'fromText' in ROLL_KIND_INFO[kind]),
      ['ask', 'textDamage', 'textRoll'],
    ],
    [
      'answers (schemas/roll-request.ts:66 ANSWERS)',
      kindsWhere(kind => 'answers' in ROLL_KIND_INFO[kind]),
      ['save', 'ability', 'skill'],
    ],
    [
      'never the Gamemaster’s (utils/roll-requests.ts:233 GM_UNSENT)',
      kindsWhere(kind => 'gm' in ROLL_KIND_INFO[kind]),
      [
        'endEnchantment',
        'endConcentration',
        'endTurn',
        'undoEndTurn',
        'favorite',
        'effect',
        'wildShape',
        'prepare',
        'hitPoints',
        // Changed on purpose (item 11): only a typing player's runs are asked.
        'dice',
      ],
    ],
    [
      'never a companion’s (constants/sending-stone.ts:460 COMPANION_UNTAKEN)',
      kindsWhere(kind => 'companion' in ROLL_KIND_INFO[kind]),
      [
        'inspiration',
        'hitDie',
        'hitDice',
        'plainRoll',
        'spend',
        'spellSlot',
        'transfer',
        'remove',
        'favorite',
        'effect',
        'wildShape',
        'prepare',
        'endTurn',
        'undoEndTurn',
      ],
    ],
    [
      'waiting while transformed (db/roll-requests.ts:160)',
      kindsWhere(kind => 'shaped' in ROLL_KIND_INFO[kind]),
      ['transfer', 'remove', 'favorite', 'effect'],
    ],
  ])('%s, as a set', (_, derived, literal) => {
    expect(new Set(derived)).toEqual(new Set(literal))
  })

  it.each([
    [
      'gmLabel, the words of utils/roll-requests.ts:1473 GM_ROLL_KINDS',
      byKind('gmLabel'),
      {
        skill: 'A check',
        ability: 'A check',
        tool: 'A check',
        save: 'A saving throw',
        death: 'A death saving throw',
        initiative: 'Initiative',
        attack: 'An attack',
        damage: 'Damage',
        use: 'A use',
        hitDie: 'Hit dice',
        hitDice: 'Hit dice',
        formula: 'A roll',
        plainRoll: 'A dice roll',
        textRoll: 'A roll',
        textDamage: 'Damage',
        itemDamage: 'Damage',
        recharge: 'A recharge',
        ask: 'A roll asked of the table',
        endEnchantment: 'An enchantment ended',
        endConcentration: 'Concentration ended',
        spend: 'Charges spent',
        inspiration: 'Heroic Inspiration',
        spellSlot: 'A spell slot spent or restored',
        transfer: 'Items or coins moved',
        remove: 'An item removed',
        favorite: 'A favorite added or removed',
        effect: 'An effect changed',
        wildShape: 'Wild Shape',
        prepare: 'A spell prepared or unprepared',
        hitPoints: 'Hit points set',
        endTurn: 'A turn ended',
        undoEndTurn: 'A turn taken back',
        // Changed on purpose (item 11).
        dice: 'Dice the game asked for',
      },
    ],
    [
      'check, as utils/roll-requests.ts:1186 CHECK_TYPES',
      byKind('check'),
      { skill: 'skill', tool: 'tool', ability: 'check' },
    ],
    [
      'own, the switches of db/roll-requests.ts:572-581',
      byKind('own'),
      {
        transfer: 'transfersEnabled',
        remove: 'removalsEnabled',
        favorite: 'favoritesEnabled',
        effect: 'effectsEnabled',
        wildShape: 'wildShapeEnabled',
        hitPoints: 'hitPointsEnabled',
      },
    ],
  ])('%s, by kind', (_, derived, literal) => {
    expect(derived).toEqual(literal)
  })

  it('sends no dice as use-table-rolls.ts:1011’s PLAIN did, in its key order', () => {
    expect(JSON.stringify(NO_DICE)).toBe(
      '{"mode":0,"explicit":false,"extras":[],"dice":[]}',
    )
  })
})
