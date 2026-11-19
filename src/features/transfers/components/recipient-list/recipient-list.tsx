'use client'

import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { Check, UserRound, Users, type LucideIcon } from 'lucide-react'
import { allTicked, everyTicked, tickedAfter } from './utils'
import { EntryIcon } from '@/components/entry-icon/entry-icon'
import { SearchField } from '@/components/search-field/search-field'
import { MOST_AMONG } from '@/constants/sending-stone'
import { matchesSearch, searchKey } from '@/utils/search'
import type { Section } from './types'
import type { MoveEnd, Several } from '@/features/transfers/types'

/*
 * Who a move goes to (module 0.31.0): the parties first, then the campaign's characters, each with
 * its portrait. They're the browser's own radio buttons, one group across both, so arrow keys move
 * the choice as they do in any form, and a screen reader says which is chosen of how many. From
 * module 0.49.0, on a character's Give of its coins (`several`), the characters are the browser's
 * own checkboxes instead, any of them ticked, with Select all first among them where one give may
 * go to them all; a party is still chosen alone, its radio letting go of the characters, and a
 * character ticked letting go of the party. From module 0.51.0 (`everyone`), the parties are
 * checkboxes too, ticked with any of the characters; Select all stays with the characters.
 */

/** How many there may be before they can be searched by name, as the picker's targets. */
const SEARCH_ABOVE = 5

/**
 * The parties and characters to choose from, under their headings, a section with none left out;
 * searched by name once there are more than a few, those picked kept whatever's typed.
 * @param value - Those picked, by id: one, or with `several` any of those it ticks.
 */
export function RecipientList({
  parties = [],
  characters,
  value,
  onChange,
  several,
}: Readonly<{
  parties?: MoveEnd[]
  characters: MoveEnd[]
  value: readonly string[]
  onChange: (ids: string[]) => void
  /**
   * On a character's Give of its coins: from module 0.49.0 (`characters`), any of the characters
   * may be ticked, or one party chosen alone; from module 0.51.0 (`everyone`), the parties are
   * checkboxes too, ticked with any of the characters.
   */
  several?: Several
}>) {
  const id = useId()
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
      ends: section.ends.filter(end => value.includes(end.id) || matches(end)),
    }))
    .filter(({ ends }) => ends.length > 0)
  // Ticks, for the characters of a give of coins, and from module 0.51.0 its parties too: radios
  // for the rest.
  const ticks = (key: Section['key']) =>
    several === 'everyone' || (several === 'characters' && key === 'characters')
  // Every one that may be ticked, in the list's order.
  const order =
    several === 'everyone' ? [...parties, ...characters] : characters
  const selectsAll =
    !!several && characters.length > 1 && characters.length <= MOST_AMONG
  const pick = (key: Section['key'], end: string) =>
    onChange(ticks(key) ? tickedAfter(value, end, order) : [end])
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
            {key === 'characters' && ticks(key) && selectsAll && (
              <Option
                kind='checkbox'
                name={`${id}-all`}
                checked={everyTicked(value, characters)}
                onChange={() => onChange(allTicked(value, characters, order))}
              >
                <span className='min-w-0 flex-1'>Select all</span>
              </Option>
            )}
            {ends.map(end => (
              <Option
                key={end.id}
                kind={ticks(key) ? 'checkbox' : 'radio'}
                name={ticks(key) ? `${id}-each` : `${id}-to`}
                value={end.id}
                checked={value.includes(end.id)}
                onChange={() => pick(key, end.id)}
              >
                <EndName end={end} fallback={fallback} />
              </Option>
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

/**
 * One to choose or tick: a card around the radio button or checkbox, as the picker's choices look,
 * with a dot or a check drawn by kind.
 */
function Option({
  kind,
  name,
  value,
  checked,
  onChange,
  children,
}: Readonly<{
  kind: 'radio' | 'checkbox'
  name: string
  value?: string
  checked: boolean
  onChange: () => void
  children: ReactNode
}>) {
  return (
    <label className='block cursor-pointer'>
      <input
        type={kind}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
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
        {kind === 'radio' ? (
          <span
            aria-hidden
            className={clsx(
              'size-3.5 shrink-0 rounded-full border',
              checked ? 'border-4 border-primary' : 'border-border',
            )}
          />
        ) : (
          <span
            aria-hidden
            className={clsx(
              'flex size-4 shrink-0 items-center justify-center rounded border',
              checked
                ? 'border-primary bg-primary text-on-primary'
                : 'border-border',
            )}
          >
            {checked && <Check className='size-3' strokeWidth={3} />}
          </span>
        )}
        {children}
      </span>
    </label>
  )
}

/** Who an end is, on its card: its portrait, its name, and "Primary" after the primary party's. */
function EndName({
  end,
  fallback,
}: Readonly<{ end: MoveEnd; fallback: LucideIcon }>) {
  return (
    <>
      <EntryIcon src={end.portrait} fallback={fallback} />
      {/* Its name wraps, whole, to be read before it's chosen: one kept on one line held the
          move's fieldset, as wide as what's in it, past the dialog's edge. */}
      <span className='min-w-0 flex-1 wrap-anywhere'>{end.name}</span>
      {/* Said after the name, as "The Iron Company Primary". */}
      {end.primary && ' '}
      {end.primary && (
        <span className='shrink-0 text-xs font-normal text-text-secondary'>
          Primary
        </span>
      )}
    </>
  )
}
