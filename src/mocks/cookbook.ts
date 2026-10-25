/* eslint-disable unicorn/no-null -- the cookbook's body uses null for an absent value */
import type { CookbookChange, CookbookDishBody } from '@/types/cookbook'

/*
 * Dishes from the Magical Recipe Book (module 0.38.0), as its server builds them from its seeded
 * recipes and ingredients, their texts quoted from that seed: each of its own dish id, cooked and
 * eaten on day 4 by Thorin, so that posting one never reads as a repeat of another.
 */

/** A dish's body, its effect left out for a standard dish. */
function dish(
  id: string,
  recipe: string,
  status: string,
  message: string,
  effect: {
    ingredients: { name: string; text: string }[]
    changes: CookbookChange[]
  } | null,
): CookbookDishBody {
  const outcome =
    status === 'boon' || status === 'bane' ? status : ('standard' as const)
  return {
    version: 1,
    dish: {
      id,
      recipe,
      status,
      outcome,
      cookedOnDay: 4,
      consumedOnDay: 4,
    },
    cook: { name: 'Thorin' },
    message,
    effect: effect && {
      name: `${recipe} (${outcome === 'boon' ? 'Boon' : 'Bane'})`,
      ingredients: effect.ingredients,
      duration: { seconds: 86_400 },
      stacks: false,
      changes: effect.changes,
    },
  }
}

const FIREBERRIES_BOON = {
  name: 'Fireberries',
  text: 'Gain 3+1d6 Maximum Hit Points and resistance to fire damage.',
}

const FIREBERRY_BOON_CHANGES: CookbookChange[] = [
  { type: 'maxHitPoints', value: 7, formula: '3+1d6' },
  { type: 'damageResistance', damageType: 'fire' },
]

/** Fireberry Glazed Skewers' boon, its 1d6 rolled as 4. */
export const fireberryBoon = dish(
  'cmh2k8q0n0001ab12cd34ef56',
  'Fireberry Glazed Skewers',
  'boon',
  'Perfectly charred with a bite of heat, leaving you feeling invincible.',
  { ingredients: [FIREBERRIES_BOON], changes: FIREBERRY_BOON_CHANGES },
)

/** Ashcakes with Fireberry Jam's bane, its 1d6 rolled as 6. */
export const fireberryBane = dish(
  'cmh2k8q0n0002ab12cd34ef56',
  'Ashcakes with Fireberry Jam',
  'bane',
  'The cakes are undercooked in the center and burnt on the outside, the jam too cloying.',
  {
    ingredients: [
      {
        name: 'Fireberries',
        text: 'Lose 3+1d6 Maximum Hit Points and vulnerability to fire damage.',
      },
    ],
    changes: [
      { type: 'maxHitPoints', value: -9, formula: '3+1d6' },
      { type: 'damageVulnerability', damageType: 'fire' },
    ],
  },
)

/** Shadowleaf Mushroom Skewers' boon: two ingredients, two skills. */
export const shadowleafBoon = dish(
  'cmh2k8q0n0003ab12cd34ef56',
  'Shadowleaf Mushroom Skewers',
  'boon',
  'The shadowleaf imparts a subtle, smoky bitterness that perfectly complements the earthy mushrooms. The mountain herbs add a bright, aromatic finish that lingers pleasantly on the palate.',
  {
    ingredients: [
      { name: 'Shadowleaf', text: 'Advantage on Stealth Checks.' },
      { name: 'Mountain Herbs', text: 'Advantage on Athletics Checks.' },
    ],
    changes: [
      { type: 'rollMode', roll: 'skill', skill: 'ste', mode: 'advantage' },
      { type: 'rollMode', roll: 'skill', skill: 'ath', mode: 'advantage' },
    ],
  },
)

/** Glowlure Fritters' boon: a sense, and a part no change holds (Water Breathing). */
export const glowlureBoon = dish(
  'cmh2k8q0n0004ab12cd34ef56',
  'Glowlure Fritters',
  'boon',
  'The fritters are crispy and golden, each bite bursting with tang and a pleasant fizz. A shimmering warmth rises behind your eyes.',
  {
    ingredients: [
      {
        name: 'Glowlure Algae',
        text: 'Darkvision (60 ft), Water Breathing, and advantage on Perception checks.',
      },
    ],
    changes: [
      { type: 'sense', sense: 'darkvision', range: 60 },
      { type: 'rollMode', roll: 'skill', skill: 'prc', mode: 'advantage' },
    ],
  },
)

/** Ashen Root Stew's bane: −1 to every check and save. */
export const ashenRootBane = dish(
  'cmh2k8q0n0005ab12cd34ef56',
  'Ashen Root Stew',
  'bane',
  'The ashen root is undercooked—fibrous, bitter, and chalky on the tongue. The broth is thin, acrid, and burns the back of the throat with raw blister garlic. A greasy film floats on the surface, and every bite reminds you of something that should’ve stayed buried.',
  {
    ingredients: [
      {
        name: 'Ashen Root',
        text: '-1 to all ability checks and saving throws.',
      },
    ],
    changes: [
      { type: 'rollBonus', roll: 'check', value: -1 },
      { type: 'rollBonus', roll: 'save', value: -1 },
    ],
  },
)

/** Kraken Ink Risotto's bane: an ability score down, and a level of exhaustion. */
export const krakenBane = dish(
  'cmh2k8q0n0006ab12cd34ef56',
  'Kraken Ink Risotto',
  'bane',
  'The risotto is slimy and tastes overwhelmingly of brine and decay. Instead of wisdom, you feel only confusion and nausea.',
  {
    ingredients: [
      {
        name: 'Kraken Ink Concentrate',
        text: '-4 to Intelligence and Tired. Gain one level of Exhaustion.',
      },
    ],
    changes: [
      { type: 'abilityScore', ability: 'int', value: -4 },
      { type: 'exhaustion', levels: 1 },
    ],
  },
)

/** Fireberry Glazed Skewers cooked plainly: a standard dish, no effect. */
export const fireberrySuccess = dish(
  'cmh2k8q0n0007ab12cd34ef56',
  'Fireberry Glazed Skewers',
  'success',
  'Grilled meat or mushroom skewers lacquered with a sweet and spicy fireberry glaze. The scent alone makes mouths water.',
  null,
)

/** Ashen Root Stew cooked badly: still a standard dish, no effect. */
export const ashenRootFailure = dish(
  'cmh2k8q0n0008ab12cd34ef56',
  'Ashen Root Stew',
  'failure',
  'The root has softened into tender chunks, releasing its mild bitterness into a rich, savory broth. The blister garlic has mellowed into a peppery heat that lingers pleasantly. It fills the belly with warmth and leaves a smoky aftertaste like a campfire in the distance.',
  null,
)

/** As fireberryBoon, with a change of a kind this app doesn't know, kept as sent. */
export const unknownKind = dish(
  'cmh2k8q0n0009ab12cd34ef56',
  'Fireberry Glazed Skewers',
  'boon',
  'Perfectly charred with a bite of heat, leaving you feeling invincible.',
  {
    ingredients: [FIREBERRIES_BOON],
    changes: [...FIREBERRY_BOON_CHANGES, { type: 'tempHitPoints', value: 5 }],
  },
)

/** As fireberryBoon, with a known kind whose fields it refuses (a modifier of 0), kept as sent. */
export const malformedKnown = dish(
  'cmh2k8q0n0010ab12cd34ef56',
  'Fireberry Glazed Skewers',
  'boon',
  'Perfectly charred with a bite of heat, leaving you feeling invincible.',
  {
    ingredients: [FIREBERRIES_BOON],
    changes: [
      ...FIREBERRY_BOON_CHANGES,
      { type: 'abilityScore', ability: 'str', value: 0 },
    ],
  },
)

/** The eight traced from the cookbook's seed, which parse back unchanged. */
export const SEEDED_DISHES = [
  fireberryBoon,
  fireberryBane,
  shadowleafBoon,
  glowlureBoon,
  ashenRootBane,
  krakenBane,
  fireberrySuccess,
  ashenRootFailure,
]
