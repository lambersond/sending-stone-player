'use client'

import { useState, type ReactNode } from 'react'
import { RollButton } from '../../../rolling/components/roll-button/roll-button'
import { NONE_LEFT } from './constants'
import { HitDiceMenu } from './hit-dice-menu'
import { leftOf, withPool } from './utils'
import type { HitDieSpending } from './types'
import type { MenuPoint } from '../../../rolling/types'
import type { HitDicePool } from '@/types/roll'

/** Why no hit die is spent at full hit points, as a Use button's title says. */
const FULL_HP = 'At full hit points'

/**
 * A button that spends a hit die of one size, a tap a die; a right-click, a long-press, or the
 * keyboard's context menu key opens a popover there to spend more at once, of that size and any
 * other the character has, which a tap on the button closes, spending none. It says Use, and is
 * named for that, then the size and how many are left, of how many, for voice control to find it
 * by what's on screen. None is spent with none left, or at full hit points, which its title says;
 * and the popover closes then, for good.
 * @param pool - The size it spends, and how many of it are left, as its row says: for a class's,
 *   the class's own, though the popover offers every class's of that size, as dnd5e spends them.
 * @param children - Shown before its word, such as the die's icon.
 */
export function HitDieUse({
  pool,
  spending: { pools, onSpend, formula, full },
  children,
}: Readonly<{
  pool: HitDicePool
  spending: HitDieSpending
  children?: ReactNode
}>) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; point?: MenuPoint }>()
  const { die, value } = pool
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
          else onSpend([{ die, count: 1 }])
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
          pools={withPool(pools, pool)}
          formula={formula}
          onSpend={counts => {
            setMenu(undefined)
            onSpend(counts)
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
    </>
  )
}
