'use client'

import { useId, type ReactNode } from 'react'
import clsx from 'clsx'
import { Check, UserRound } from 'lucide-react'
import { EntryIcon } from '@/components/entry-icon/entry-icon'
import { MOST_AMONG } from '@/constants/sending-stone'
import type { MoveEnd } from '@/features/transfers/types'

/*
 * Who coins are handed out to (module 0.49.0): any of the campaign's other characters, each with
 * its portrait, as a move's recipients look. They're the browser's own checkboxes, so Space ticks
 * one as in any form, and a screen reader says which are ticked.
 */

/**
 * The characters to tick any of, and Select all above them where one hand-out may give to them
 * all, which unticks them all once they are.
 * @param value - Those ticked, by id.
 */
export function RecipientChecks({
  characters,
  value,
  onChange,
}: Readonly<{
  characters: readonly MoveEnd[]
  value: readonly string[]
  onChange: (ids: string[]) => void
}>) {
  const id = useId()
  const ticked = new Set(value)
  const all =
    characters.length > 0 && characters.every(end => ticked.has(end.id))
  // Kept in the list's order, whatever order they're ticked in.
  const toggle = (end: string) =>
    onChange(
      characters
        .map(each => each.id)
        .filter(each => (each === end ? !ticked.has(each) : ticked.has(each))),
    )
  return (
    <div className='flex flex-col gap-1.5'>
      {characters.length > 1 && characters.length <= MOST_AMONG && (
        <Tick
          name={`${id}-all`}
          checked={all}
          onChange={() => onChange(all ? [] : characters.map(end => end.id))}
        >
          <span className='min-w-0 flex-1'>Select all</span>
        </Tick>
      )}
      {characters.map(end => (
        <Tick
          key={end.id}
          name={`${id}-to`}
          checked={ticked.has(end.id)}
          onChange={() => toggle(end.id)}
        >
          <EntryIcon src={end.portrait} fallback={UserRound} />
          {/* Its name wraps, whole, as a move's recipients' do, never past the dialog's edge. */}
          <span className='min-w-0 flex-1 wrap-anywhere'>{end.name}</span>
        </Tick>
      ))}
    </div>
  )
}

/** One to tick: a card around the checkbox, as a move's recipients look, with a box for a dot. */
function Tick({
  name,
  checked,
  onChange,
  children,
}: Readonly<{
  name: string
  checked: boolean
  onChange: () => void
  children: ReactNode
}>) {
  return (
    <label className='block cursor-pointer'>
      <input
        type='checkbox'
        name={name}
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
        {children}
      </span>
    </label>
  )
}
