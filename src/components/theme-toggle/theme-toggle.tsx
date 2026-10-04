'use client'

import { useSyncExternalStore } from 'react'
import clsx from 'clsx'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

const THEMES = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
] as const

// Nothing to listen to: whether the page has hydrated never changes afterwards.
const noop = () => {}
const subscribe = () => noop

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // The saved theme is only known in the browser, so the server and the first render in the
  // browser show no choice; it is filled in once hydrated.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const current = hydrated ? theme : undefined

  return (
    <div
      role='radiogroup'
      aria-label='Theme'
      className='flex items-center rounded-lg border border-border p-0.5'
    >
      {THEMES.map(({ value, label, Icon }) => (
        <button
          key={value}
          type='button'
          role='radio'
          aria-checked={current === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={clsx(
            'rounded-md p-1.5 transition-colors',
            current === value
              ? 'bg-primary text-on-primary'
              : 'text-text-secondary hover:bg-primary/10 hover:text-text-primary',
          )}
        >
          <Icon aria-hidden className='size-3.5' />
        </button>
      ))}
    </div>
  )
}
