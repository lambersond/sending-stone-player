'use client'

import { askedWords } from '@/features/companions/utils'
import type { CompanionAskRow } from '@/features/companions/types'

/**
 * Which of the character's companions the game asks a save of, from module 0.41.0 (round 0.41.0
 * §3.1.3), at the character's own pane, under the prompts' heading: a line each, "Bat 1 is asked
 * for a Dexterity saving throw", and Show, which switches to its tab. It never answers: the save's
 * buttons, with the companion's own modifiers, are on its own pane. From module 0.45.0, also those
 * whose dice the game asks its player for, "Brakka is asked for the dice of Bite: Rend", typed in
 * on its own pane. None where none is asked.
 * @param onShow - Switches to the companion's tab, giving it focus.
 */
export function CompanionAskNotice({
  asked,
  onShow,
}: Readonly<{
  asked: readonly CompanionAskRow[]
  onShow: (key: string) => void
}>) {
  if (asked.length === 0) return
  return (
    <ul aria-label='Companions asked' className='mt-1.5 grid gap-1.5'>
      {asked.map(({ key, name, ...row }) => (
        <li
          key={key}
          className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'
        >
          <p className='min-w-0 text-sm'>
            <span className='font-semibold'>{name}</span> is asked for{' '}
            {askedWords(row)}
          </p>
          <button
            type='button'
            aria-label={`Show ${name}`}
            onClick={() => onShow(key)}
            className='inline-flex min-h-11 shrink-0 items-center rounded-xl border border-primary/40 px-3 text-sm font-semibold text-primary-text transition-colors hover:bg-primary/10 sm:min-h-9'
          >
            Show
          </button>
        </li>
      ))}
    </ul>
  )
}
