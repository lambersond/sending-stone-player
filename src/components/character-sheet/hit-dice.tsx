'use client'

import { useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { HitDiceMenu } from './hit-dice-menu'
import { RollButton } from './roll-button'
import { DieIcon, type DieSides } from '@/components/icons'
import {
  atFullHitPoints,
  hitDiceFormula,
  hitDieRoll,
  type HitDicePool,
} from '@/utils/formulas'
import type { MenuPoint } from './roll-menu'
import type { SheetFormulaRoll } from '@/hooks/use-sheet-roller'
import type { TableSheet } from '@/types/table'

/**
 * How the sheet spends hit dice: rolled with the player's dice, for the hit points they give back,
 * and spent in the Gamemaster's game too while it takes hit dice.
 */
export type HitDieSpending = {
  /** Spends this many hit dice of a size, thrown together. */
  onSpend: (die: string, count: number) => void
  /** What spending this many of a size gives back, as a formula, such as "3d8 + 9". */
  formula: (die: string, count: number) => string
  /** At full hit points, where a die spent would give back nothing, so none is. */
  full: boolean
}

/** Why no hit die is spent at full hit points, as a Use button's title says. */
export const FULL_HP = 'At full hit points'

/** Why none of a size is spent with none left, as its Use button's title says. */
export const NONE_LEFT = 'None left'

/** How a sheet's hit dice are spent, given what rolls them; none where nothing rolls them. */
export function hitDieSpending(
  sheet: TableSheet,
  onRollFormula?: (roll: SheetFormulaRoll) => void,
): HitDieSpending | undefined {
  if (!onRollFormula) return
  return {
    onSpend: (die, count) => onRollFormula(hitDieRoll(sheet, die, count)),
    formula: (die, count) => hitDiceFormula(sheet, die, count),
    full: atFullHitPoints(sheet),
  }
}

/**
 * A button that spends a hit die of one size, a tap a die; a right-click, a long-press, or the
 * keyboard's context menu key opens a popover there to spend more at once, which a tap on the
 * button closes, spending none. It says Use, and is named for that, then the size and how many are
 * left, of how many, for voice control to find it by what's on screen. None is spent with none
 * left, or at full hit points, which its title says; and the popover closes then, for good.
 * @param children - Shown before its word, such as the die's icon.
 */
export function HitDieUse({
  pool,
  spending: { onSpend, formula, full },
  children,
}: Readonly<{
  pool: HitDicePool
  spending: HitDieSpending
  children?: ReactNode
}>) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; point?: MenuPoint }>()
  const { die, value, max } = pool
  let why: string | undefined
  if (value === 0) why = NONE_LEFT
  else if (full) why = FULL_HP
  // Closed once none can be spent, as when the sheet says they're spent elsewhere, rather than
  // hidden: it doesn't open again by itself once some can be.
  if (why && menu) setMenu(undefined)
  return (
    <>
      <RollButton
        target={pool}
        onRoll={() => {
          // With its popover open, as after a long-press, a tap closes it, spending none.
          if (menu) setMenu(undefined)
          else onSpend(die, 1)
        }}
        onMenu={(anchor, _, point) => setMenu({ anchor, point })}
        label={`Use a ${die} hit die, ${leftOf(pool, 'an unknown number')}`}
        popup='dialog'
        disabled={why !== undefined}
        title={why}
        className='inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-sm font-semibold transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border disabled:hover:bg-card'
      >
        {children}
        Use
      </RollButton>
      {menu && !why && (
        <HitDiceMenu
          anchor={menu.anchor}
          point={menu.point}
          die={die}
          // As many as are left, or where the sheet doesn't say, as many as there are.
          most={value ?? max ?? 1}
          formula={count => formula(die, count)}
          onSpend={count => {
            setMenu(undefined)
            onSpend(die, count)
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
    </>
  )
}

/**
 * A character's hit dice, a row for each size, the largest first: its die, its size, how many are
 * left of how many, such as 3/5, in ruby with none left, and a button that spends them; or, where
 * nothing rolls them, no button. Each row is as wide as it can be, side by side where there's room
 * for them; where there's no room for its count beside its size, the count goes under it, the
 * button staying beside them. In a tile too narrow for a die as well as a count such as 10/12 and
 * the button, under 150 pixels, as on a phone under 375 pixels wide, the die is left out: the size
 * beside it says what it shows.
 */
export function HitDiceList({
  pools,
  spending,
}: Readonly<{ pools: HitDicePool[]; spending?: HitDieSpending }>) {
  return (
    <ul className='flex flex-wrap gap-x-4 gap-y-1.5'>
      {pools.map(pool => (
        <li
          key={pool.die}
          className='flex min-w-0 flex-[1_1_9rem] items-center gap-2'
        >
          <HitDieIcon
            die={pool.die}
            className='size-5 text-primary @max-[150px]:hidden'
          />
          {/* What the button says to a screen reader, or the words after it, says too. */}
          <span
            aria-hidden
            className='flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 text-sm'
          >
            <span className='font-semibold'>{pool.die}</span>
            <span
              className={clsx(
                'tabular-nums',
                pool.value === 0
                  ? 'font-semibold text-ruby'
                  : 'font-normal text-text-secondary',
              )}
            >
              {countOf(pool)}
            </span>
          </span>
          {spending ? (
            <HitDieUse pool={pool} spending={spending} />
          ) : (
            <span className='sr-only'>
              {pool.die}, {leftOf(pool, 'an unknown number')}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/** A hit die's shape, by its size, such as "d10"; none for a size there's no icon of. */
export function HitDieIcon({
  die,
  className,
}: Readonly<{ die: string; className?: string }>) {
  const sides = SIDES.get(die)
  return (
    sides && <DieIcon sides={sides} className={clsx('shrink-0', className)} />
  )
}

/** The sizes of hit die there's an icon of, by their names. */
const SIDES = new Map<string, DieSides>(
  ([4, 6, 8, 10, 12, 20] as const).map(sides => [`d${sides}`, sides]),
)

/** A class's hit dice as its row says them: "Hit dice 3/5 d10", a dash for a count unknown. */
export function hitDiceText(pool: HitDicePool): string {
  return `Hit dice ${countOf(pool)} ${pool.die}`
}

/** How many are left, of how many: "3/5", a dash for a count unknown. */
function countOf({ value, max }: HitDicePool): string {
  return `${value ?? '–'}/${max ?? '–'}`
}

/** How many are left, such as "3 of 5 left", saying a count the sheet doesn't know so. */
function leftOf({ value, max }: HitDicePool, unknown: string): string {
  const left = value ?? unknown
  return max === null ? `${left} left` : `${left} of ${max} left`
}
