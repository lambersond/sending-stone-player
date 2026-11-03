import { DIE_SIDES, type DieSides } from '@lambersond/3d-dice-core'

/** Whether a die of so many faces is one the dice throw: a d4, d6, d8, d10, d12, d20 or d100. */
export function isDieSides(faces: number): faces is DieSides {
  return (DIE_SIDES as readonly number[]).includes(faces)
}
