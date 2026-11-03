import { useSpent } from '../../../sheet/components/effect-controls/use-spent'
import { spentLine } from '../../utils/tray-words'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * Beneath a roll the player added a die offered to, such as Bardic Inspiration's (module 0.42.1),
 * once the game has made it: a line for each, saying what became of the effect it spent. None for
 * a roll still on its way, or not made, which spent nothing.
 */
export function SpentLines({
  roll,
  state,
}: Readonly<{ roll: LocalRoll; state?: TableRollState }>) {
  const spent = useSpent()
  if (roll.kind !== 'check' || !roll.spends || state?.status !== 'done') return
  return roll.spends.map(spend => (
    <p key={spend.effect} className='mt-1 text-sm text-text-secondary'>
      {spentLine(spend, spent(spend.effect))}
    </p>
  ))
}
