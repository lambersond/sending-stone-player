import type { Advantage } from '@lambersond/3d-dice-core'

/**
 * A roll mode as the dice take it: advantage above zero, disadvantage below, neither at zero. Any
 * advantage and any disadvantage combined cancel out, as in D&D Fifth Edition.
 */
export function toAdvantage(mode: number): Advantage | undefined {
  if (mode > 0) return 'adv'
  if (mode < 0) return 'dis'
  return undefined
}
