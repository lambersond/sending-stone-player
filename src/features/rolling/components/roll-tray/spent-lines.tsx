import { spentLine } from '../../utils/tray-words'
import { useSpent } from '@/features/sheet/components/effect-controls/use-spent'
import type { LocalRoll, TableRollState } from '@/types/roll'

/**
 * Beneath a roll the player added a die offered to, such as Bardic Inspiration's (module 0.42.1),
 * once the game has made it: a line for each, saying what became of the effect it spent. None for
 * a roll still on its way, or not made, which spent nothing; nor for one taken with nothing to
 * follow it by (`unfollowed`), which may not be made, its effect left as it is.
 */
export function SpentLines({
  roll,
  state,
}: Readonly<{ roll: LocalRoll; state?: TableRollState }>) {
  const spent = useSpent()
  if (roll.kind !== 'check' || !roll.spends) return
  if (state?.status !== 'done' || state.unfollowed) return
  return roll.spends.map(spend => (
    <p key={spend.effect} className='mt-1 text-sm text-text-secondary'>
      {spentLine(spend, spent(spend.effect))}
    </p>
  ))
}
