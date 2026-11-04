'use client'

import { useId, type Ref } from 'react'
import clsx from 'clsx'

/**
 * Whether damage on its own spends what its use would, as the sheet's settings' switches are drawn:
 * named for what it spends, which says more beneath it. Space or Enter turns it, as a tap does.
 */
export function SpendSwitch({
  ref,
  label,
  on,
  onChange,
}: Readonly<{
  ref?: Ref<HTMLElement>
  label: string
  on: boolean
  onChange: (on: boolean) => void
}>) {
  const hint = useId()
  return (
    <div className='flex flex-col gap-1'>
      {/* A target as tall as a finger on a phone, as the switch inside it is small. */}
      <label className='flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium sm:min-h-9'>
        <input
          ref={ref as Ref<HTMLInputElement>}
          type='checkbox'
          role='switch'
          checked={on}
          onChange={event => onChange(event.target.checked)}
          onKeyDown={event => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            onChange(!on)
          }}
          aria-describedby={hint}
          className='peer sr-only'
        />
        <span
          aria-hidden
          className={clsx(
            'relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
            on ? 'bg-primary' : 'bg-border',
          )}
        >
          <span
            className={clsx(
              'absolute top-0.5 size-4 rounded-full bg-card shadow-sm transition-[left]',
              on ? 'left-4.5' : 'left-0.5',
            )}
          />
        </span>
        {label}
      </label>
      <p id={hint} className='pl-12 text-xs text-text-secondary'>
        Turn it off where it was spent in Foundry already.
      </p>
    </div>
  )
}
