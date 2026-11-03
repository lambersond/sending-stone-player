'use client'

import clsx from 'clsx'
import { Badge } from './badge'
import { Paw } from './paw'
import { sizeCrWords } from '@/utils/wild-shape-words'
import type { BeastEntry } from '@/types/sending-stone'

/**
 * A Beast to learn, as a radio: its name, size and CR, and its statistics; known ones not
 * offered.
 */
export function BeastCard({
  each,
  checked,
  stop,
  onPick,
}: Readonly<{
  each: BeastEntry
  checked: boolean
  /** Whether it takes the group's tab stop. */
  stop: boolean
  onPick: (uuid: string) => void
}>) {
  const line = sizeCrWords(each.size, each.cr)
  const facts = [
    typeof each.ac === 'number' ? `AC ${each.ac}` : undefined,
    each.speeds.length > 0 ? each.speeds.join(', ') : undefined,
  ].filter(Boolean)
  return (
    <button
      type='button'
      role='radio'
      aria-checked={checked}
      aria-disabled={each.known || undefined}
      aria-label={[each.name, line, ...facts]
        .filter(Boolean)
        .join(', ')
        .concat(each.known ? ', known' : '')}
      tabIndex={stop ? 0 : -1}
      data-ws-beast={each.uuid}
      onClick={() => {
        if (!each.known) onPick(each.uuid)
      }}
      className={clsx(
        'flex min-h-11 flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors',
        checked
          ? 'border-wild bg-wild-bg/60 ring-1 ring-wild'
          : 'border-border bg-card',
        each.known ? 'cursor-not-allowed' : 'hover:border-wild/50',
      )}
    >
      <span className='flex items-center gap-2.5'>
        <Paw />
        <span className='min-w-0 flex-1'>
          <span className='block font-semibold'>{each.name}</span>
          {line && (
            <span className='block text-xs text-text-secondary'>{line}</span>
          )}
        </span>
        {each.known && <Badge>Known</Badge>}
      </span>
      {facts.length > 0 && (
        <span className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary'>
          {facts.map(fact => (
            <span key={fact}>{fact}</span>
          ))}
        </span>
      )}
    </button>
  )
}
