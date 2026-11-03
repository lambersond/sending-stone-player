import { actionTitle, verbOf } from '../action-entry/utils'
import { NONE_LEFT } from '../hit-dice/constants'
import { spendsToo } from '../uses-button/utils'
import type { DamageModifiers } from '@/types/roll'
import type { SheetAction, SheetUses } from '@/types/sending-stone'

/**
 * A spell or feature that rolls nothing of its own, such as Bless, Shield or Action Surge, as a
 * button that casts or uses it in the Gamemaster's game. Where the module says it spends the very
 * counter its row shows, from 0.29.0, and none of it is left, it can't be: it says so, and a tap
 * does nothing, as the game would only turn it down.
 * @param uses - The uses its row shows.
 */
export function UseChip({
  action,
  onUse,
  uses,
}: Readonly<{
  action: SheetAction
  onUse: (modifiers?: DamageModifiers) => void
  uses?: SheetUses | null
}>) {
  const verb = verbOf(action)
  const spent =
    !!uses &&
    uses.value === 0 &&
    spendsToo(action.activity?.spends, uses.counter)
  return (
    <button
      type='button'
      aria-label={`${verb} ${actionTitle(action)}`}
      aria-disabled={spent || undefined}
      title={spent ? NONE_LEFT : undefined}
      onClick={() => {
        if (!spent) onUse()
      }}
      className='shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/20 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary/10'
    >
      {verb}
    </button>
  )
}
