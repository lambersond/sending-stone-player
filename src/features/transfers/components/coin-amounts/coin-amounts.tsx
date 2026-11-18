'use client'

import { useId } from 'react'
import clsx from 'clsx'
import { amountFits } from './utils'
import { MOST_MOVED } from '@/constants/sending-stone'
import { wholeCoins } from '@/utils/coins'
import type { SheetCurrency } from '@/types/sending-stone'

/*
 * How many of each coin to add, take away or hand out (module 0.49.0), typed. Unlike a move's
 * coins, they aren't capped at what the character holds: coins are added from nothing, and what's
 * taken away may be paid with other coins. What's held is said beside each, of its whole coins.
 */

/**
 * A number to type for each coin the sheet lists, up to the most the game takes at once, with how
 * many of it are held beside it; one typed as more, or not as a number, is said to be, under it.
 * @param legend - What the numbers are: "Coins", or what each of several gets.
 * @param value - What's typed, by coin; nothing typed is none.
 */
export function CoinAmounts({
  legend,
  currency,
  value,
  onChange,
}: Readonly<{
  legend: string
  currency: readonly SheetCurrency[]
  value: Readonly<Record<string, string>>
  onChange: (value: Record<string, string>) => void
}>) {
  const ids = useId()
  return (
    <fieldset className='grid gap-2'>
      <legend className='mb-1.5 text-sm font-medium'>{legend}</legend>
      {currency.map(coin => {
        const { id, label, abbreviation } = coin
        const text = value[id] ?? ''
        const ok = amountFits(text)
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
                onChange={event =>
                  onChange({ ...value, [id]: event.target.value })
                }
                autoComplete='off'
                aria-invalid={ok ? undefined : true}
                aria-describedby={
                  ok ? `${input}-held` : `${input}-held ${input}-error`
                }
                className={clsx(
                  // 16px text, as iOS zooms into a smaller one it focuses.
                  'h-10 w-28 rounded-xl border bg-page px-3 text-base tabular-nums outline-none focus:ring-2',
                  ok
                    ? 'border-border focus:ring-primary/40'
                    : 'border-danger focus:ring-danger/40',
                )}
              />
              <span
                id={`${input}-held`}
                className='text-sm text-text-secondary'
              >
                {wholeCoins(coin).toLocaleString('en')} {abbreviation} held
              </span>
            </div>
            {!ok && (
              <p
                id={`${input}-error`}
                role='alert'
                className='text-sm text-danger'
              >
                Enter a whole number up to {MOST_MOVED.toLocaleString('en')}.
              </p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
