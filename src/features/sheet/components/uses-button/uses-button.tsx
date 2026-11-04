'use client'

import { useState } from 'react'
import clsx from 'clsx'
import { UsesLeft } from './uses-left'
import { UsesMenu } from './uses-menu'
import { spendsToo } from './utils'
import { useCharging } from '@/features/sheet/components/charging/use-charging'
import type { SheetSpend, SheetUses } from '@/types/sending-stone'

/*
 * What the character spends, as the player changes it here directly, from module 0.29.0, as they
 * would on dnd5e's sheet: a counter's charges spent, such as two Sorcery Points, and Heroic
 * Inspiration used or gained; and from module 0.42.1, one of their spell slots spent or restored,
 * as dnd5e's sheet's pips do. Each posts a line in the game's chat, which says so.
 */

/**
 * A counter's uses left, such as 8/20: where the game takes charges spent from here, of a counter
 * the sheet says may be spent so, with some left, a button that opens a popover to spend some,
 * from 1, spending none until the player says how many; else only its count. Inside a row's
 * summary, a tap on it opens its popover, not the row.
 * @param name - What the counter is called, such as "Sorcery Points".
 * @param spends - What using the row's activity spends, to say where it spends this counter too.
 * @param bare - Whether to show nothing but the button, none where none can be spent, as where
 *   the count is written out beside it already.
 */
export function UsesButton({
  uses,
  name,
  spends,
  bare = false,
  className,
}: Readonly<{
  uses: SheetUses
  name: string
  spends?: SheetSpend[]
  bare?: boolean
  className?: string
}>) {
  const { spend } = useCharging()
  const [menu, setMenu] = useState<HTMLElement>()
  const { counter } = uses
  const spendable =
    !!spend && !!counter && uses.spendable === true && uses.value > 0
  // Closed once none can be spent, as when the sheet says they're spent elsewhere.
  if (!spendable && menu) setMenu(undefined)
  if (!spendable) return !bare && <UsesLeft uses={uses} />
  return (
    <>
      <button
        type='button'
        aria-label={`Spend ${name}: ${uses.value} of ${uses.max} left`}
        aria-haspopup='dialog'
        aria-expanded={menu !== undefined}
        onClick={event => {
          // Inside a row's summary, it's the popover that opens, not the row.
          event.preventDefault()
          event.stopPropagation()
          setMenu(menu ? undefined : event.currentTarget)
        }}
        className={clsx(
          'shrink-0 rounded-full transition-colors hover:bg-primary/10 focus-visible:bg-primary/10',
          className,
        )}
      >
        <UsesLeft uses={uses} />
      </button>
      {menu && (
        <UsesMenu
          anchor={menu}
          name={name}
          left={uses.value}
          usedToo={spendsToo(spends, counter)}
          onSpend={count => {
            setMenu(undefined)
            spend(counter, count, name)
          }}
          onClose={() => setMenu(undefined)}
        />
      )}
    </>
  )
}
