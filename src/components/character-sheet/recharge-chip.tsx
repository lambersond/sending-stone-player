'use client'

import { useLayoutEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRollsLocked } from '@/hooks/use-rolls-locked'
import type { SheetFormulaRoll } from '@/hooks/use-sheet-roller'
import type { SheetUses } from '@/types/sending-stone'

/*
 * A spent recharge, rolled from the sheet (module 0.36.0), as dnd5e's NPC sheet rolls one: a d6,
 * its uses back to full on the lowest that recharges them or more.
 */

/**
 * Whether uses can be recharged from here: they recharge, they're an item's own or one of its
 * activities', not a resource's, and something of them is spent, as dnd5e rolls a recharge only
 * then.
 */
export function rechargeable(uses: SheetUses | null | undefined): boolean {
  const counter = uses?.counter
  return (
    !!uses?.recharge && !!counter && 'item' in counter && uses.value < uses.max
  )
}

/**
 * A Recharge chip, first of a row's chips, left of its uses, which rolls a d6 to recharge them,
 * for the game to roll it too. Where it had focus and goes, as the uses come back, focus stays in
 * its row: on its uses, where they're a button still shown, else on its name. Nothing for uses it
 * can't recharge (`rechargeable`).
 * @param name - What the uses are of, such as "Fire Breath".
 */
export function RechargeChip({
  name,
  uses,
  onRoll,
}: Readonly<{
  name: string
  uses: SheetUses
  onRoll: (roll: SheetFormulaRoll) => void
}>) {
  const locked = useRollsLocked()
  const button = useRef<HTMLButtonElement>(null)
  // As it goes, while it's still on the page, whether it has focus; once it's gone, the row's own.
  useLayoutEffect(() => {
    const chip = button.current
    return () => {
      if (!chip || chip.ownerDocument.activeElement !== chip) return
      const box = chip.parentElement
      const row = chip.closest('li, tr')
      queueMicrotask(() => keepFocusIn(box, row))
    }
  }, [])
  const { counter, recharge } = uses
  if (!recharge || !counter || !('item' in counter)) return
  const at = recharge === 6 ? 'a 6 on a d6' : `${recharge} or more on a d6`
  return (
    // A 44-pixel target round the chip as drawn.
    <button
      ref={button}
      type='button'
      aria-label={`Roll ${name}’s recharge: ${at}`}
      title='Roll a d6 to recharge it'
      disabled={locked}
      onClick={() =>
        onRoll({
          label: `${name} recharge`,
          terms: [{ sign: 1, count: 1, sides: 6 }],
          recharge: counter,
        })
      }
      className='group flex min-h-11 shrink-0 items-center disabled:opacity-50'
    >
      <span className='inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-sm font-semibold transition-colors group-hover:border-primary/50 group-hover:bg-primary/5'>
        <RefreshCw aria-hidden className='size-3.5' />
        Recharge
      </span>
    </button>
  )
}

/**
 * Focus kept in a row whose Recharge chip went: on its uses beside it, where they're a button
 * still shown, else on the button that opens the row, its own or, for one of an item's
 * activities, its item's.
 * @param box - What held the chip: the row's chips, or a table's cell of uses.
 */
function keepFocusIn(box: Element | null, row: Element | null) {
  const uses = box?.closest('[data-uses]') ?? box?.querySelector('[data-uses]')
  const targets = [
    uses?.querySelector<HTMLElement>('button'),
    row?.querySelector<HTMLElement>('button[aria-expanded]') ??
      row?.parentElement
        ?.closest('li')
        ?.querySelector<HTMLElement>('button[aria-expanded]'),
  ]
  // The first that takes it: uses folded away in a narrow list once the chip's gone aren't drawn,
  // and a browser gives focus to nothing that isn't, which would leave it on the page's body.
  for (const target of targets) {
    if (!target) continue
    target.focus()
    if (target.ownerDocument.activeElement === target) return
  }
}
