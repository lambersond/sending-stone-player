import { sameCounter } from '@/utils/requests/status'
import type { SheetCounter, SheetSpend } from '@/types/sending-stone'

/**
 * Does using an activity spend this counter too, as the module says what it spends? Not where it
 * costs none, or gives some back, as Staff of the Magi's Spell Absorption does the staff's charges,
 * which dnd5e uses however many are left; a formula's cost, which the sheet can't work out, is
 * taken as one.
 * @param spends - What the activity spends, as its `activity.spends` has it.
 */
export function spendsToo(
  spends: SheetSpend[] | undefined,
  counter: SheetCounter | undefined,
): boolean {
  return !!spends?.some(
    ({ counter: spent, amount }) =>
      (amount === null || amount > 0) && sameCounter(spent, counter),
  )
}
