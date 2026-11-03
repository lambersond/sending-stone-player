'use client'

import { useState, useId } from 'react'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useInteractions,
  useClick,
  useDismiss,
  useRole,
  FloatingPortal,
  FloatingFocusManager,
} from '@floating-ui/react'
import clsx from 'clsx'
import { SheetFact } from '../sheet-fact/sheet-fact'
import { usePortalRoot } from '@/components/modal/use-portal-root'
import { useTopmostEscape } from '@/components/modal/use-topmost-escape'
import { useTransferring } from '@/features/transfers/hooks/use-transferring'
import { compactAmount } from '@/utils/format-amount'
import type { SheetInventory } from '@/types/sending-stone'

/**
 * Coin, how much the character carries, and how many items they are attuned to; on the coin's
 * label's row, how it's moved, where the sheet gives it a way (module 0.31.0).
 */
export function Holdings({
  inventory,
}: Readonly<{ inventory: SheetInventory }>) {
  const { currency, encumbrance, attunement } = inventory
  const moves = useTransferring().coins?.(currency)
  // On a party's sheet, from module 0.33.0's feedback: one spinner by the label while its coins
  // are on their way, its buttons disabled without their own.
  const waiting = useTransferring().waiting?.has('coins') === true
  return (
    // On a phone, coin across the top, and load and attunement side by side under it.
    <dl className='grid grid-cols-2 gap-2 @xl:grid-cols-3'>
      {currency.length > 0 && (
        <SheetFact
          label='Currency'
          className='col-span-2 @xl:col-span-1'
          action={moves}
          busy={waiting}
        >
          <ul className='flex flex-wrap gap-x-3 gap-y-1'>
            {currency.map(coin => (
              <li
                key={coin.id}
                title={coin.label}
                className={clsx(coin.value === 0 && 'text-text-secondary')}
              >
                <CoinAmount coin={coin} />
              </li>
            ))}
          </ul>
        </SheetFact>
      )}
      {encumbrance && (
        <SheetFact
          label='Encumbrance'
          className={clsx(!attunement && 'col-span-2 @xl:col-span-1')}
        >
          <Load encumbrance={encumbrance} />
        </SheetFact>
      )}
      {attunement && (
        <SheetFact
          label='Attunement'
          className={clsx(!encumbrance && 'col-span-2 @xl:col-span-1')}
        >
          <span className='font-semibold tabular-nums'>
            {attunement.value}
            {attunement.max !== null && ` / ${attunement.max}`}
          </span>
        </SheetFact>
      )}
    </dl>
  )
}

type Coin = SheetInventory['currency'][number]

/**
 * How much of a coin the character has, such as "41 GP". From 1,000, it's shortened, as in
 * "12.8k GP", so that every coin fits on a phone, and the exact amount is a click or tap away.
 */
function CoinAmount({ coin }: Readonly<{ coin: Coin }>) {
  const short = compactAmount(coin.value)
  if (short === undefined) {
    return <CoinText amount={coin.value.toLocaleString()} coin={coin} />
  }
  return <ExactAmount short={short} coin={coin} />
}

/**
 * An amount and the coin's abbreviation after it, smaller, as in "41 GP", half a space apart, from
 * module 0.32.0's feedback.
 */
function CoinText({ amount, coin }: Readonly<{ amount: string; coin: Coin }>) {
  return (
    <>
      <span className='font-semibold tabular-nums'>{amount}</span>
      {/* Half a space: half the room between an amount and its coin, which still reads as a
          space. */}
      <span className='text-[0.5em]'> </span>
      <span className='text-xs'>{coin.abbreviation}</span>
    </>
  )
}

/**
 * A shortened amount of a coin, as a button that opens a popover above it with the exact amount,
 * and the coin's name, such as "Gold": by a click or tap, or Enter or Space. Escape, or a click
 * or tap elsewhere, closes it; inside a dialog too, and only it.
 */
function ExactAmount({ short, coin }: Readonly<{ short: string; coin: Coin }>) {
  const [open, setOpen] = useState(false)
  const amount = useId()
  const shown = `${short} ${coin.abbreviation}`.trimEnd()
  const root = usePortalRoot()
  useTopmostEscape(open)
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    whileElementsMounted: autoUpdate,
    middleware: [offset(6), flip({ padding: 8 }), shift({ padding: 8 })],
  })
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: 'dialog' }),
  ])
  return (
    <>
      <button
        ref={refs.setReference}
        type='button'
        // What it shows, then what it opens to.
        aria-label={`${shown}, exact amount`}
        className='rounded-md underline decoration-text-secondary/60 decoration-dotted underline-offset-4 transition-colors hover:text-primary'
        {...getReferenceProps()}
      >
        <CoinText amount={short} coin={coin} />
      </button>
      {open && (
        <FloatingPortal root={root}>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              aria-labelledby={amount}
              className='z-50 flex max-w-[calc(100vw-1rem)] flex-col gap-0.5 rounded-xl border border-border bg-card px-3 py-2 text-text-primary shadow-xl outline-none'
              {...getFloatingProps()}
            >
              {coin.label && (
                <p className='text-xs font-semibold text-text-secondary'>
                  {coin.label}
                </p>
              )}
              <p id={amount}>
                <CoinText amount={coin.value.toLocaleString()} coin={coin} />
              </p>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  )
}

/**
 * What the character carries of the most they can, as a bar, marked where being encumbered and
 * heavily encumbered begin under the variant rule.
 */
function Load({
  encumbrance,
}: Readonly<{ encumbrance: NonNullable<SheetInventory['encumbrance']> }>) {
  const { value, max, units, encumbered, heavilyEncumbered } = encumbrance
  const share = (weight: number) =>
    max ? Math.min(100, Math.max(0, (weight / max) * 100)) : 0
  const over =
    (heavilyEncumbered !== null && value > heavilyEncumbered) ||
    (max !== null && value > max)
  const loaded = encumbered !== null && value > encumbered
  return (
    <span className='flex flex-col gap-1.5'>
      <span className='tabular-nums'>
        <span className='font-semibold'>{value.toLocaleString()}</span>
        {max !== null && ` / ${max.toLocaleString()}`} {units}
      </span>
      {max !== null && (
        <span
          aria-hidden
          className='relative h-1.5 overflow-hidden rounded-full bg-border'
        >
          <span
            className={clsx(
              'absolute inset-y-0 left-0 rounded-full',
              over && 'bg-danger',
              !over && loaded && 'bg-warning',
              !over && !loaded && 'bg-primary',
            )}
            style={{ width: `${share(value)}%` }}
          />
          {[encumbered, heavilyEncumbered].map(
            (threshold, index) =>
              threshold !== null && (
                <span
                  key={index}
                  className='absolute inset-y-0 w-0.5 bg-text-secondary/60'
                  style={{ left: `${share(threshold)}%` }}
                />
              ),
          )}
        </span>
      )}
    </span>
  )
}
