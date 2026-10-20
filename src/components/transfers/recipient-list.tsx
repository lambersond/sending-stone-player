'use client'

import { useId, useState } from 'react'
import clsx from 'clsx'
import { UserRound, Users, type LucideIcon } from 'lucide-react'
import { EntryIcon } from '@/components/character-sheet/sheet-entry'
import { SearchField } from '@/components/search-field/search-field'
import { matchesSearch, searchKey } from '@/utils/search'
import type { MoveEnd } from './move-dialog'

/*
 * Who a move goes to (module 0.31.0): the parties first, then the campaign's characters, each with
 * its portrait. They're the browser's own radio buttons, one group across both, so arrow keys move
 * the choice as they do in any form, and a screen reader says which is chosen of how many.
 */

/** How many there may be before they can be searched by name, as the picker's targets. */
const SEARCH_ABOVE = 5

type Section = {
  key: 'parties' | 'characters'
  label: 'Parties' | 'Characters'
  ends: MoveEnd[]
  fallback: LucideIcon
}

/**
 * The parties and characters to choose one from, under their headings, a section with none left
 * out; searched by name once there are more than a few, the one chosen kept whatever's typed.
 * @param value - The one chosen, if one is.
 */
export function RecipientList({
  parties = [],
  characters,
  value,
  onChange,
}: Readonly<{
  parties?: MoveEnd[]
  characters: MoveEnd[]
  value?: string
  onChange: (id: string) => void
}>) {
  const id = useId()
  const name = `${id}-to`
  const [query, setQuery] = useState('')
  const sections: Section[] = [
    { key: 'parties', label: 'Parties', ends: parties, fallback: Users },
    {
      key: 'characters',
      label: 'Characters',
      ends: characters,
      fallback: UserRound,
    },
  ]
  const count = parties.length + characters.length
  // Kept while anything's typed in it, so it can't be left filtering with no box to clear it.
  const searchable = count > SEARCH_ABOVE || query !== ''
  const searching = searchable && searchKey(query) !== ''
  const matches = (end: MoveEnd) =>
    !searching || matchesSearch([end.name], query)
  const found = sections.reduce(
    (total, { ends }) => total + ends.filter(end => matches(end)).length,
    0,
  )
  const shown = sections
    .map(section => ({
      ...section,
      ends: section.ends.filter(end => end.id === value || matches(end)),
    }))
    .filter(({ ends }) => ends.length > 0)
  return (
    <div className='flex flex-col gap-3'>
      {searchable && (
        <SearchField
          value={query}
          onChange={setQuery}
          label='Search by name'
          placeholder='Search'
        />
      )}
      {shown.map(({ key, label, ends, fallback }) => (
        <div key={key}>
          <p
            id={`${id}-${key}`}
            className='mb-1.5 px-0.5 text-xs font-semibold tracking-wider text-text-secondary uppercase'
          >
            {label}
          </p>
          <div
            role='group'
            aria-labelledby={`${id}-${key}`}
            className='flex flex-col gap-1.5'
          >
            {ends.map(end => (
              <Option
                key={end.id}
                end={end}
                name={name}
                fallback={fallback}
                checked={end.id === value}
                onChange={onChange}
              />
            ))}
          </div>
        </div>
      ))}
      {searching && found === 0 && (
        <p className='text-sm text-text-secondary'>No one matches</p>
      )}
    </div>
  )
}

/** One to choose: a card around the radio button, as the picker's choices look. */
function Option({
  end,
  name,
  fallback,
  checked,
  onChange,
}: Readonly<{
  end: MoveEnd
  name: string
  fallback: LucideIcon
  checked: boolean
  onChange: (id: string) => void
}>) {
  return (
    <label className='block cursor-pointer'>
      <input
        type='radio'
        name={name}
        value={end.id}
        checked={checked}
        onChange={() => onChange(end.id)}
        className='peer sr-only'
      />
      <span
        className={clsx(
          'flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 py-1.5 text-left text-sm font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
          checked
            ? 'border-primary bg-primary/10 text-primary-text'
            : 'border-border hover:bg-primary/5',
        )}
      >
        <span
          aria-hidden
          className={clsx(
            'size-3.5 shrink-0 rounded-full border',
            checked ? 'border-4 border-primary' : 'border-border',
          )}
        />
        <EntryIcon src={end.portrait} fallback={fallback} />
        <span className='min-w-0 flex-1 truncate'>{end.name}</span>
        {/* Said after the name, as "The Iron Company Primary". */}
        {end.primary && ' '}
        {end.primary && (
          <span className='shrink-0 text-xs font-normal text-text-secondary'>
            Primary
          </span>
        )}
      </span>
    </label>
  )
}
