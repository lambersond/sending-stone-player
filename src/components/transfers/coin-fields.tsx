'use client'

import { useId } from 'react'
import clsx from 'clsx'
import { typedCount } from './amount-field'
import { MOST_MOVED } from '@/constants/sending-stone'
import type { SheetCurrency } from '@/types/sending-stone'

/*
 * How many of each coin to move (module 0.31.0), typed, as a pile of coin may run to thousands.
 * Only whole coins move: dnd5e 6 may hold part of one, as 10.5 gp, of which 10 may be moved.
 */

/** The coins there's a whole one of, in the sheet's order, each with as many as may be moved. */
export function movableCoins(
  currency: SheetCurrency[],
): (SheetCurrency & { max: number })[] {
  return currency
    .map(coin => ({
      ...coin,
      max: Math.min(Math.floor(coin.value), MOST_MOVED),
    }))
    .filter(({ max }) => max >= 1)
}

/** Whether what's typed for a coin may be moved: nothing, as none, or a number up to its most. */
function fits(text: string, max: number): boolean {
  if (text === '') return true
  const count = typedCount(text)
  return count !== undefined && count <= max
}

/**
 * The coins to move, by key, as typed, leaving out those with none; or nothing, while any is typed
 * as more than there is, or not as a number, or none at all is.
 */
export function coinsMoved(
  currency: SheetCurrency[],
  value: Readonly<Record<string, string>>,
): Record<string, number> | undefined {
  const moved: Record<string, number> = {}
  for (const { id, max } of movableCoins(currency)) {
    const text = value[id] ?? ''
    if (!fits(text, max)) return undefined
    const count = typedCount(text) ?? 0
    if (count >= 1) moved[id] = count
  }
  return Object.keys(moved).length > 0 ? moved : undefined
}

/**
 * A number to type for each coin there's a whole one of, of as many as there are, and a button
 * for all of them; one typed as more, or not as a number, is said to be, under it.
 * @param value - What's typed, by coin; nothing typed is none.
 */
export function CoinFields({
  currency,
  value,
  onChange,
}: Readonly<{
  currency: SheetCurrency[]
  value: Readonly<Record<string, string>>
  onChange: (value: Record<string, string>) => void
}>) {
  const ids = useId()
  const set = (id: string, text: string) => onChange({ ...value, [id]: text })
  return (
    <fieldset className='grid gap-2'>
      <legend className='mb-1.5 text-sm font-medium'>Coins</legend>
      {movableCoins(currency).map(({ id, label, abbreviation, max }) => {
        const text = value[id] ?? ''
        const ok = fits(text, max)
        const input = `${ids}-${id}`
        return (
          <div key={id} className='grid gap-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <label htmlFor={input} className='w-20 text-sm font-medium'>
                {label}
              </label>
              <input
                id={input}
                type='text'
                inputMode='numeric'
                pattern='[0-9]*'
                value={text}
                onChange={event => set(id, event.target.value)}
                autoComplete='off'
                aria-invalid={ok ? undefined : true}
                aria-describedby={ok ? undefined : `${input}-error`}
                className={clsx(
                  // 16px text, as iOS zooms into a smaller one it focuses.
                  'h-10 w-28 rounded-xl border bg-page px-3 text-base tabular-nums outline-none focus:ring-2',
                  ok
                    ? 'border-border focus:ring-primary/40'
                    : 'border-danger focus:ring-danger/40',
                )}
              />
              <span className='text-sm text-text-secondary'>
                of {max.toLocaleString('en')} {abbreviation}
              </span>
              <button
                type='button'
                aria-label={`All ${label}`}
                onClick={() => set(id, String(max))}
                className='ml-auto h-10 rounded-xl border border-border px-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-primary/5'
              >
                All
              </button>
            </div>
            {!ok && (
              <p
                id={`${input}-error`}
                role='alert'
                className='text-sm text-danger'
              >
                Enter a whole number up to {max.toLocaleString('en')}.
              </p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
