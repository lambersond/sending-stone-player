'use client'

import clsx from 'clsx'
import { StatTag } from './stat-tag'
import type { ReactNode } from 'react'

/*
 * The tiles and chips at the top of a sheet, a character's and, from module 0.36.0, a creature's:
 * its portrait, its conditions, and its vital numbers, each in a tile.
 */

/**
 * One of the sheet's vital numbers. Each box is a container, so a label with a short form, such as
 * Prof for Proficiency, can use it when its box is too narrow for the whole word: the longest,
 * Armor class, needs 114 pixels. What it shows fills the box's height, which a taller box beside
 * it on its row may stretch, for the hit points' bar to sit at its foot.
 * @param wide - For one of a pair, such as the hit points beside the hit dice, a column on a
 * phone, where there are two, and two where there are more; two columns however many there are,
 * as the hit points with no hit dice beside them; or a row of its own, up to four columns.
 * @param group - What it says, as a group of its own named so, where its value is more than a
 * number, as a companion's initiative right after its character (module 0.36.0).
 */
export function Stat({
  label,
  short,
  wide,
  group,
  tag,
  children,
}: Readonly<{
  label: string
  short?: string
  wide?: 'pair' | 'double' | 'row'
  group?: string
  /**
   * Whose number it is, where it isn't the character's own, from module 0.40.0: the form's, such
   * as "Wolf", or "Circle of the Moon" for an AC at that circle's floor. Words, after its label.
   */
  tag?: string
  children: ReactNode
}>) {
  return (
    <div
      className={clsx(
        '@container flex min-w-0 flex-col gap-0.5 rounded-xl bg-page py-2',
        wide === 'pair' && '@lg:col-span-2',
        wide === 'double' && 'col-span-2',
        wide === 'row' && 'col-span-2 @lg:col-span-4',
      )}
    >
      <dt className='truncate px-3 text-[11px] font-semibold tracking-wider text-text-secondary uppercase'>
        {short ? (
          <>
            <span className='@max-[116px]:hidden'>{label}</span>
            <abbr
              title={label}
              className='hidden no-underline @max-[116px]:inline'
            >
              {short}
            </abbr>
          </>
        ) : (
          label
        )}
        {tag && <StatTag>{tag}</StatTag>}
      </dt>
      <dd className='flex-1 px-3 text-lg font-bold tabular-nums'>
        {group ? (
          // On a span in the value, as a list's own div may have no role.
          <span
            role='group'
            aria-label={group}
            className='inline-flex flex-wrap items-center gap-x-1 gap-y-0.5'
          >
            {children}
          </span>
        ) : (
          children
        )}
      </dd>
    </div>
  )
}
