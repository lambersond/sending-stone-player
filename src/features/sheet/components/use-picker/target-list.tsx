'use client'

import clsx from 'clsx'
import { Crosshair, ShieldCheck } from 'lucide-react'
import { Sections } from './sections'
import { Who } from './who'
import type { Section } from './types'
import type { TableCombatant } from '@/types/table'

/**
 * Combatants to tap, one of which is the target; or no one, whatever is searched. The last
 * attacked, or the default, is marked, still a tap away; an ally is marked by a shield, not the
 * crosshair.
 */
export function TargetList({
  lead,
  sections,
  query,
  onQuery,
  last,
  preset,
  onTap,
  onNone,
}: Readonly<{
  lead: string
  sections: Section[]
  query: string
  onQuery: (query: string) => void
  last?: string
  /** The default target, such as Self for a potion. */
  preset?: string
  onTap: (combatant: TableCombatant) => void
  onNone: () => void
}>) {
  return (
    <div>
      <p className='mb-3 text-sm text-text-secondary'>{lead}</p>
      <Sections
        sections={sections}
        query={query}
        onQuery={onQuery}
        row={(combatant, ally) => (
          <button
            type='button'
            onClick={() => onTap(combatant)}
            className={clsx(
              'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-primary/5',
              combatant.id === last || combatant.id === preset
                ? 'border-primary'
                : 'border-border',
              ally && 'border-l-4 border-l-party',
            )}
          >
            {ally ? (
              <ShieldCheck aria-hidden className='size-4 shrink-0 text-party' />
            ) : (
              <Crosshair aria-hidden className='size-4 shrink-0 text-attack' />
            )}
            <Who combatant={combatant} last={last} preset={preset} />
          </button>
        )}
      />
      <button
        type='button'
        onClick={onNone}
        className='mt-1.5 w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary transition-colors hover:bg-primary/5 hover:text-text-primary'
      >
        No target
      </button>
    </div>
  )
}
