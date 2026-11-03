'use client'

import clsx from 'clsx'
import { Check } from 'lucide-react'
import { Go } from './go'
import { Sections } from './sections'
import { Who } from './who'
import type { Section } from './types'

/**
 * Combatants to tick, as many as a use takes, then made at those ticked. Those ticked stay in the
 * list whatever is searched.
 */
export function TickList({
  lead,
  sections,
  query,
  onQuery,
  ticked,
  full,
  onToggle,
  go,
  onGo,
}: Readonly<{
  lead: string
  sections: Section[]
  query: string
  onQuery: (query: string) => void
  ticked: string[]
  /** Whether as many are ticked as it takes. */
  full: boolean
  onToggle: (id: string) => void
  go: string
  onGo: () => void
}>) {
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>{lead}</p>
      <Sections
        sections={sections}
        query={query}
        onQuery={onQuery}
        kept={ticked}
        row={(combatant, ally) => {
          const on = ticked.includes(combatant.id)
          return (
            <button
              type='button'
              role='checkbox'
              aria-checked={on}
              disabled={!on && full}
              onClick={() => onToggle(combatant.id)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5 disabled:opacity-40',
                on ? 'border-primary bg-primary/5' : 'border-border',
                ally && 'border-l-4 border-l-party',
              )}
            >
              <span
                aria-hidden
                className={clsx(
                  'flex size-4 shrink-0 items-center justify-center rounded border',
                  on
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-border',
                )}
              >
                {on && <Check className='size-3' />}
              </span>
              <Who combatant={combatant} />
            </button>
          )
        }}
      />
      <Go label={go} onGo={onGo} />
    </div>
  )
}
