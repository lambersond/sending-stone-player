import { ROLL_KINDS } from '@/constants/sending-stone'
import type { RollKind, RollKindInfo, RollRequestInput } from '@/types/roll'

/**
 * What the app knows of each kind of roll request, in ROLL_KINDS' order: one row a kind, read by
 * the schema, the server, the requests' checks and the sheet's rolls alike, in place of a list of
 * kinds beside each of them.
 */
export const ROLL_KIND_INFO = {
  skill: {
    gmLabel: 'A check',
    dice: 'd20',
    check: 'skill',
    keyed: true,
    answers: true,
  },
  tool: { gmLabel: 'A check', dice: 'd20', check: 'tool', keyed: true },
  ability: {
    gmLabel: 'A check',
    dice: 'd20',
    check: 'check',
    keyed: true,
    answers: true,
  },
  save: { gmLabel: 'A saving throw', dice: 'd20', keyed: true, answers: true },
  death: { gmLabel: 'A death saving throw', dice: 'd20' },
  initiative: { gmLabel: 'Initiative', dice: 'd20' },
  attack: { gmLabel: 'An attack', dice: 'd20' },
  use: { gmLabel: 'A use', dice: 'none' },
  damage: { gmLabel: 'Damage', dice: 'free', damage: true, summed: true },
  hitDie: { gmLabel: 'Hit dice', dice: 'free', companion: false },
  hitDice: {
    gmLabel: 'Hit dice',
    dice: 'hitDice',
    summed: true,
    companion: false,
  },
  formula: { gmLabel: 'A roll', dice: 'free' },
  // From module 0.44.0: the dice the player picks, the Gamemaster's too, as the character's own,
  // never a companion's.
  plainRoll: { gmLabel: 'A dice roll', dice: 'plain', companion: false },
  ask: { gmLabel: 'A roll asked of the table', dice: 'none', fromText: true },
  textDamage: {
    gmLabel: 'Damage',
    dice: 'free',
    damage: true,
    summed: true,
    fromText: true,
  },
  textRoll: { gmLabel: 'A roll', dice: 'free', fromText: true },
  itemDamage: { gmLabel: 'Damage', dice: 'free', damage: true, summed: true },
  recharge: { gmLabel: 'A recharge', dice: 'recharge' },
  endEnchantment: { gmLabel: 'An enchantment ended', dice: 'none', gm: false },
  endConcentration: { gmLabel: 'Concentration ended', dice: 'none', gm: false },
  endTurn: {
    gmLabel: 'A turn ended',
    dice: 'none',
    gm: false,
    companion: false,
  },
  undoEndTurn: {
    gmLabel: 'A turn taken back',
    dice: 'none',
    gm: false,
    companion: false,
  },
  spend: { gmLabel: 'Charges spent', dice: 'none', companion: false },
  inspiration: {
    gmLabel: 'Heroic Inspiration',
    dice: 'none',
    companion: false,
  },
  spellSlot: {
    gmLabel: 'A spell slot spent or restored',
    dice: 'none',
    companion: false,
  },
  transfer: {
    gmLabel: 'Items or coins moved',
    dice: 'none',
    companion: false,
    own: 'transfersEnabled',
    shaped: true,
  },
  remove: {
    gmLabel: 'An item removed',
    dice: 'none',
    companion: false,
    own: 'removalsEnabled',
    shaped: true,
  },
  favorite: {
    gmLabel: 'A favorite added or removed',
    dice: 'none',
    gm: false,
    companion: false,
    own: 'favoritesEnabled',
    shaped: true,
  },
  effect: {
    gmLabel: 'An effect changed',
    dice: 'none',
    gm: false,
    companion: false,
    own: 'effectsEnabled',
    shaped: true,
  },
  wildShape: {
    gmLabel: 'Wild Shape',
    dice: 'none',
    gm: false,
    companion: false,
    own: 'wildShapeEnabled',
  },
  prepare: {
    gmLabel: 'A spell prepared or unprepared',
    dice: 'none',
    gm: false,
    companion: false,
  },
  // From module 0.44.0, by a switch of its own: the player's alone, posting nothing, of their
  // character, its form while shaped, or a companion of theirs.
  hitPoints: {
    gmLabel: 'Hit points set',
    dice: 'none',
    gm: false,
    own: 'hitPointsEnabled',
  },
  // From module 0.44.0: the dice of a later roll the game asks a typing player for, the player's
  // alone, a companion's too. It throws none of its own: its values are its answer's, each checked
  // against the ask, never thrown dice by size; and the rolls the game makes of it add up, as
  // damage's do.
  dice: {
    gmLabel: 'Dice the game asked for',
    dice: 'none',
    summed: true,
    gm: false,
  },
} as const satisfies Record<RollKind, RollKindInfo>

/** The kinds `pred` holds for, in ROLL_KINDS' order: as `kindsWhere(kind => …)`. */
export function kindsWhere(pred: (kind: RollKind) => unknown): RollKind[] {
  return ROLL_KINDS.filter(kind => pred(kind))
}

/**
 * What may answer what the game asks, in the order the server looks for an earlier answer: a
 * saving throw, or from module 0.27.0, where Midi-QOL asks for one, an ability or skill check.
 */
export const ANSWER_KINDS = [
  'save',
  'ability',
  'skill',
] as const satisfies readonly RollKind[]

/**
 * The kinds with a switch of the campaign's own, never one of the rolls, in ROLL_KINDS' order, as
 * the server withholds them: a move, a removal, a favorite, an effect changed, Wild Shape and from
 * module 0.44.0 hit points set.
 */
export const OWN_KINDS: readonly RollKind[] = kindsWhere(
  kind => 'own' in ROLL_KIND_INFO[kind],
)

/** How what throws no dice, and is rolled no way, is sent: as it is, with nothing added. */
export const NO_DICE = {
  mode: 0,
  explicit: false,
  extras: [],
  dice: [],
} as const satisfies Pick<
  RollRequestInput,
  'mode' | 'explicit' | 'extras' | 'dice'
>
