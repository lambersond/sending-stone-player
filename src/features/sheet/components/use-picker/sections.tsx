'use client'

import { useId, type ReactNode } from 'react'
import { shownOf } from './utils'
import { SearchField } from '@/components/search-field/search-field'
import { matchesSearch, searchKey } from '@/utils/search'
import type { Section } from './types'
import type { TableCombatant } from '@/types/table'

/**
 * How many combatants a list of them may have before they can be searched by name: more than
 * this, the player's own row and the defeated among them, but not "No target".
 */
const SEARCH_ABOVE = 5

/** Those shown whatever is typed in a search, where none are. */
const NONE: readonly string[] = []

/**
 * Combatants to pick from, in their sections, each a list under its heading where there's more
 * than one to show; searched by what each row shows, once there are more than a few, the search
 * kept while anything's typed in it, so it can't be left filtering with no box to clear it. A
 * screen reader hears how many a search found.
 * @param kept - Those shown whatever is typed, such as those ticked, so that all the picks made
 *   can be seen, and unticked.
 * @param row - A combatant's row, given whether it's among the allies.
 */
export function Sections({
  sections,
  query,
  onQuery,
  kept = NONE,
  row,
}: Readonly<{
  sections: Section[]
  query: string
  onQuery: (query: string) => void
  kept?: readonly string[]
  row: (combatant: TableCombatant, ally: boolean) => ReactNode
}>) {
  const id = useId()
  const count = sections.reduce((total, { rows }) => total + rows.length, 0)
  const searchable = count > SEARCH_ABOVE || query !== ''
  const searching = searchable && searchKey(query) !== ''
  const matches = (combatant: TableCombatant) =>
    !searching || matchesSearch(shownOf(combatant), query)
  const found = sections.reduce(
    (total, { rows }) =>
      total + rows.filter(combatant => matches(combatant)).length,
    0,
  )
  const shown = sections
    .map(section => ({
      ...section,
      rows: section.rows.filter(
        combatant => kept.includes(combatant.id) || matches(combatant),
      ),
    }))
    .filter(({ rows }) => rows.length > 0)
  const headed = shown.length > 1
  return (
    <>
      {searchable && (
        <div className='mb-3'>
          <SearchField
            value={query}
            onChange={onQuery}
            label='Search targets by name'
            placeholder='Search'
          />
        </div>
      )}
      <p aria-live='polite' className='sr-only'>
        {searching &&
          (found === 1 ? '1 target found' : `${found} targets found`)}
      </p>
      <div className='flex flex-col gap-4'>
        {shown.map(({ key, label, rows }) => (
          <div key={key}>
            {headed && (
              <h3
                id={`${id}-${key}`}
                className='mb-1.5 px-0.5 text-xs font-semibold tracking-wider text-text-secondary uppercase'
              >
                {label}
              </h3>
            )}
            <ul
              aria-labelledby={headed ? `${id}-${key}` : undefined}
              className='flex flex-col gap-1.5'
            >
              {rows.map(combatant => (
                <li key={combatant.id}>{row(combatant, key === 'allies')}</li>
              ))}
            </ul>
          </div>
        ))}
        {searching && found === 0 && (
          <p className='text-sm text-text-secondary'>No one matches</p>
        )}
      </div>
    </>
  )
}
