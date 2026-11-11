import { ADDED_WORDS } from '../../constants'
import { shownTotal } from '../../utils/brief'
import {
  leastOf,
  rechargeTitle,
  thrownAgainThere,
  thrownAgainWords,
} from '../../utils/tray-words'
import { OnlyYou } from './only-you'
import { TableStatus } from './table-status'
import { Terms } from './terms'
import { useTableRole } from '@/hooks/use-table-api'
import { seatWords } from '@/utils/seat-words'
import type { LocalFormula, TableRollState } from '@/types/roll'

/**
 * A hit die spent, or a formula rolled: the total, and each of its terms with its dice, and the
 * least it comes to, where its dice came to less. Hit dice spent at once are one roll, every die
 * among its terms, and the least each gives back said where one gave back its least. One with a die
 * rerolled or exploded, which the game throws again itself, shows the game's total, once it says.
 * A die thrown again that the player answered (module 0.44.0) says it was added to its roll.
 */
export function FormulaResult({
  roll,
  state,
}: Readonly<{ roll: LocalFormula; state?: TableRollState }>) {
  const { game } = seatWords(useTableRole())
  const again = thrownAgainThere(roll, state)
  return (
    <div className='flex items-center gap-3'>
      <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl font-bold text-primary tabular-nums'>
        {shownTotal(roll, state)}
      </span>
      <div className='min-w-0'>
        <p className='truncate font-semibold'>{rechargeTitle(roll, state)}</p>
        <p className='text-xs text-text-secondary tabular-nums'>
          <Terms terms={roll.terms} firstThrow={again} />
          {roll.minimum !== undefined && ` · ${leastOf(roll)}`}
          {again && thrownAgainWords(game)}
        </p>
        {state && (
          <TableStatus state={state} made={roll.again && ADDED_WORDS} />
        )}
        {!state && roll.described && <OnlyYou />}
      </div>
    </div>
  )
}
