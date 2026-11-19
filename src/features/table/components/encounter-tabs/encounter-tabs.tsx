'use client'

import { useRef, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import { encounterLabels, encounterNews } from './utils'
import { SWITCH_TAB, SWITCH_TAB_OFF, SWITCH_TAB_ON } from '@/constants/buttons'
import { tabStep } from '@/utils/tab-keys'
import type { TableCombat } from '@/types/table'

/**
 * The encounters under way, a tab each, above the Combat tab's turn panel (item 36), as the
 * creature switcher's are above the sheet: each named for the encounter, or else for who of the
 * seat's is in it, with its round, and on one not shown, a dot where it's the seat's turn there,
 * which its name says too.
 * Left and Right move between them, wrapping, and Home and End go to the first and last: focus
 * moves first, then the encounter is shown. Past what fits, the row scrolls.
 * @param shown - The encounter shown, by id.
 * @param onChoose - Shows an encounter, by id.
 */
export function EncounterTabs({
  combats,
  shown,
  onChoose,
}: Readonly<{
  combats: readonly TableCombat[]
  shown: string
  onChoose: (id: string) => void
}>) {
  const row = useRef<HTMLDivElement>(null)
  const labels = encounterLabels(combats)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const at = combats.findIndex(({ id }) => id === shown)
    const next = tabStep(event.key, at, combats.length)
    if (next === undefined) return
    event.preventDefault()
    const tabs =
      row.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    tabs?.[next]?.focus()
    onChoose(combats[next].id)
  }

  return (
    <div
      ref={row}
      role='tablist'
      aria-label='Encounters'
      onKeyDown={onKeyDown}
      className='flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
    >
      {combats.map(combat => {
        const on = combat.id === shown
        const label = labels.get(combat.id) ?? 'Encounter'
        // News is for a tab not shown, as the creature switcher's is.
        const news = on ? '' : encounterNews(combat)
        return (
          <button
            key={combat.id}
            type='button'
            role='tab'
            id={`encounter-tab-${combat.id}`}
            aria-selected={on}
            aria-controls='encounter-panel'
            tabIndex={on ? 0 : -1}
            aria-label={`${label}, round ${combat.round}${news}`}
            onClick={() => onChoose(combat.id)}
            className={clsx(
              SWITCH_TAB,
              on ? SWITCH_TAB_ON : SWITCH_TAB_OFF,
              'max-w-48 py-1',
            )}
          >
            <span className='flex min-w-0 flex-col items-start leading-tight'>
              <span className='max-w-full truncate'>{label}</span>
              <span className='text-xs font-medium text-text-secondary'>
                {`Round ${combat.round}`}
              </span>
            </span>
            {news && (
              <span
                aria-hidden
                className='size-2 shrink-0 rounded-full bg-primary'
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
