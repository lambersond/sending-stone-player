import clsx from 'clsx'
import { HeartPulse } from 'lucide-react'
import { Pips } from './spell-slots'
import { atFullHitPoints, hitDieRoll, type HitDicePool } from '@/utils/formulas'
import type { SheetFormulaRoll } from '@/hooks/use-sheet-roller'
import type { TableSheet } from '@/types/table'

/**
 * How the sheet spends a hit die: a tap rolls one with the player's dice, for the hit points it
 * gives back, and the Gamemaster's game spends it too while it takes hit dice.
 */
export type HitDieSpending = {
  onSpend: (die: string) => void
  /** What its buttons say: Spend while the game takes hit dice; else Roll, as it's only rolled. */
  verb: 'Spend' | 'Roll'
  /** At full hit points, where a die spent would give back nothing, so none is. */
  full: boolean
}

/**
 * Why no hit die is spent at full hit points, as the sheet says it beside each button, its own
 * title showing only to a mouse.
 */
export const FULL_HP = 'At full hit points'

/**
 * How a sheet's hit dice are spent, given what rolls them, and whether the game spends them too;
 * none where nothing rolls them.
 */
export function hitDieSpending(
  sheet: TableSheet,
  onRollFormula?: (roll: SheetFormulaRoll) => void,
  spendsAtTable = false,
): HitDieSpending | undefined {
  if (!onRollFormula) return
  return {
    onSpend: die => onRollFormula(hitDieRoll(sheet, die)),
    verb: spendsAtTable ? 'Spend' : 'Roll',
    full: atFullHitPoints(sheet),
  }
}

/**
 * A button that spends a hit die of one size: "Spend d10", or "Roll d10" where the game won't
 * spend it, as it's only rolled here. Its name is what it shows, then how many are left, of how
 * many, for voice control to find it by what's on screen. None is spent with none left, or at
 * full hit points.
 */
export function HitDieButton({
  pool,
  spending: { onSpend, verb, full },
}: Readonly<{ pool: HitDicePool; spending: HitDieSpending }>) {
  return (
    <button
      type='button'
      onClick={() => onSpend(pool.die)}
      disabled={pool.value === 0 || full}
      title={full ? FULL_HP : undefined}
      className='inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card'
    >
      <HeartPulse aria-hidden className='size-4 text-primary' />
      {verb} {pool.die}
      <span className='sr-only'>, {leftOf(pool, 'an unknown number')}</span>
    </button>
  )
}

/**
 * How many hit dice of a size are left, of how many: a pip for each, filled for each left, as
 * spell slots have them, and in words, in ruby when none are left, under the pips where there's
 * no room beside them. Only to look at, as what's beside it, the button or the size alone, says
 * the same to a screen reader.
 */
export function HitDiceLeft({ pool }: Readonly<{ pool: HitDicePool }>) {
  const { value, max } = pool
  return (
    <span
      aria-hidden
      className={clsx(
        'flex flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold tabular-nums',
        value === 0 && 'text-ruby',
      )}
    >
      {value !== null && max !== null && <Pips value={value} max={max} />}
      {leftOf(pool, '–')}
    </span>
  )
}

/**
 * A character's hit dice, a row for each size, the largest first: how many are left, and a button
 * that spends one; or, where nothing rolls them, the size alone. At full hit points none is spent,
 * which it says.
 */
export function HitDiceList({
  pools,
  spending,
}: Readonly<{ pools: HitDicePool[]; spending?: HitDieSpending }>) {
  return (
    <>
      <ul className='flex max-w-sm flex-col gap-1.5'>
        {/* Its count, taking the room its button leaves, puts its words under its pips before the
            button goes under it, which it does only where even the pips don't fit beside it. */}
        {pools.map(pool => (
          <li
            key={pool.die}
            className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'
          >
            <HitDiceLeft pool={pool} />
            {spending ? (
              <HitDieButton pool={pool} spending={spending} />
            ) : (
              <span className='inline-flex items-center gap-1.5 text-sm font-semibold'>
                <HeartPulse
                  aria-hidden
                  className='size-4 text-text-secondary'
                />
                {pool.die}
                <span className='sr-only'>
                  , {leftOf(pool, 'an unknown number')}
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {spending?.full && (
        <p className='mt-1 text-xs font-normal text-text-secondary'>
          {FULL_HP}
        </p>
      )}
    </>
  )
}

/** A class's hit dice as its row says them: "Hit dice 3/5 d10", a dash for a count unknown. */
export function hitDiceText({ die, value, max }: HitDicePool): string {
  return `Hit dice ${value ?? '–'}/${max ?? '–'} ${die}`
}

/** How many are left, such as "3 of 5 left", saying a count the sheet doesn't know so. */
function leftOf({ value, max }: HitDicePool, unknown: string): string {
  const left = value ?? unknown
  return max === null ? `${left} left` : `${left} of ${max} left`
}
