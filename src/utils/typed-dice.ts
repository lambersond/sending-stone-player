import type {
  Advantage,
  DiePool,
  DieSides,
  RollResult,
} from '@lambersond/3d-dice-core'

// A roll's dice as the player typed them in from their own physical dice (module 0.32.0), in the
// shape the app's own throw gives them, so that everything after keeps them as it keeps its own.

/**
 * From 0.42.1, Elven Accuracy's third d20 asked on its own line, which may be skipped for the game
 * to roll; false asks it with the other two, as 0.42.0 did.
 */
export const ELVEN_LINE = true

/** Elven Accuracy's third d20, as its own line in the dice dialog is headed and named. */
export const ELVEN_LABEL = 'Elven Accuracy: third d20'

/**
 * Elven Accuracy's third d20 as the dice dialog words it once it's skipped, as an effect's die is:
 * "not counting Elven Accuracy’s d20". It never goes to the game as an effect's die: its value is
 * among the d20s.
 */
export const ELVEN_DIE = {
  name: 'Elven Accuracy',
  faces: 20,
  count: 1,
} as const

/**
 * How many d20s a check, save or attack throws: two with advantage or disadvantage, and three
 * with advantage where dnd5e gives the attack Elven Accuracy and its third is asked with the other
 * two (`ELVEN_LINE` false).
 */
export function d20Count(
  advantage?: Advantage,
  elvenAccuracy?: boolean,
): 1 | 2 | 3 {
  if (advantage === 'adv' && elvenAccuracy) return 3
  return advantage ? 2 : 1
}

/** A check's d20s as their group is headed: such as "d20, advantage". */
export function d20Label(advantage?: Advantage, count = 1): string {
  if (!advantage) return 'd20'
  if (advantage === 'dis') return 'd20, disadvantage'
  return count === 3 ? 'd20, advantage (Elven Accuracy)' : 'd20, advantage'
}

/**
 * The dice typed in, as `executeRoll` would have thrown them: each pool's values, its d20 with
 * advantage or disadvantage one die of the two or three thrown, the higher kept, or the lower; any
 * other pool a die each. A pool of none is left out, as `executeRoll` leaves it out.
 * @param pools - The dice asked for, in order.
 * @param values - What was typed in for each, in the same order.
 */
export function typedResult(
  pools: { sides: DieSides; count: number }[],
  values: number[][],
  {
    advantage,
    modifier = 0,
  }: { advantage?: Advantage; modifier?: number } = {},
): RollResult {
  const thrown = pools.flatMap((pool, index): DiePool[] => {
    if (pool.count === 0) return []
    const typed = values[index] ?? []
    if (pool.sides === 20 && advantage) {
      const kept = advantage === 'dis' ? Math.min(...typed) : Math.max(...typed)
      return [{ sides: 20, count: 1, rolls: [typed], kept: [kept] }]
    }
    return [
      {
        sides: pool.sides,
        count: typed.length,
        rolls: typed.map(value => [value]),
        kept: typed,
      },
    ]
  })
  const dice = thrown.reduce(
    (sum, { kept }) => sum + kept.reduce((all, value) => all + value, 0),
    0,
  )
  return {
    id: crypto.randomUUID(),
    at: Date.now(),
    pools: thrown,
    modifier,
    advantage,
    total: dice + modifier,
  }
}
