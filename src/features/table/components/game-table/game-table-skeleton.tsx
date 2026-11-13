import clsx from 'clsx'
import { Skeleton } from '@/components/skeleton/skeleton'
import { SkeletonStatus } from '@/components/skeleton/skeleton-status'
import {
  ABILITIES_GRID,
  ABILITIES_SECTION,
  ABILITY_CHECK,
  ABILITY_SAVE,
  ABILITY_TILE,
  SHEET_CARD,
  SHEET_TAB_PAGE,
  SHEET_TABS_ROW,
  STAT_TILE,
  STAT_WIDE,
} from '@/features/sheet/constants'
import { statsGrid } from '@/features/sheet/utils/stats-grid'
import {
  ASIDE_BESIDE,
  ASIDE_COLUMN,
  ASIDE_TABS_BAR,
  GM_PILL,
  TABLE_BODY,
  TABLE_COLUMN,
  TABLE_FRAME,
  TABLE_HEADER_BAR,
  TABLE_NAME,
  TABLE_NAV_BAR,
  TABLE_NAV_TAB,
  TABLE_PANE,
} from '@/features/table/constants'
import type { ReactNode } from 'react'

/**
 * A character's table while it's read (v0.48.0), at its player's seat or its Gamemaster's: laid out
 * as GameTable lays it out at every width, so that nothing moves as the table takes its place. The
 * header, with the character's name, known from the page's check, where the table's shows it, and
 * at the Gamemaster's seat the GM pill; the sheet's tabs, its card of six tiles and its abilities;
 * from 1024 px the combat and chat column beside it, and narrower the tabs, in a bar at the bottom
 * of a phone or a rail beside a tablet. Its name and pill are hidden from assistive technology with
 * the rest, as the page's title has the name and its status says it's loading. Its boxes are the
 * table's and the sheet's own, so that a change to one moves both.
 * @param gm - Whether it's the Gamemaster's seat, whose header has the GM pill and no Delete.
 */
export function GameTableSkeleton({
  name,
  gm = false,
}: Readonly<{ name: string; gm?: boolean }>) {
  return (
    <div className={TABLE_FRAME}>
      <SkeletonStatus />
      <div className={TABLE_COLUMN}>
        {/* The header, as TableHeader's: back, the name and its line, then its buttons. */}
        <div className={TABLE_HEADER_BAR}>
          <div className='flex min-w-0 items-center gap-2'>
            <IconSlot className='-ml-1.5 sm:-ml-3' />
            <div aria-hidden className='min-w-0'>
              <div className='flex items-baseline gap-2 overflow-hidden'>
                <p
                  className={clsx(
                    TABLE_NAME,
                    gm ? 'min-w-0' : 'max-w-full shrink-0',
                  )}
                >
                  {name}
                </p>
                {gm && <span className={GM_PILL}>GM</span>}
              </div>
              <div className='flex h-5 items-center'>
                <Skeleton className='h-3 w-36 max-w-full rounded-md' />
              </div>
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            {/* Live, then Help, Full screen and, at the player's seat, Delete. */}
            <Skeleton className='h-[26px] w-[4.5rem] rounded-full' />
            <IconSlot />
            <IconSlot />
            {!gm && <IconSlot />}
          </div>
        </div>
        <div className={TABLE_BODY}>
          <div className={clsx(TABLE_PANE, 'flex')}>
            {/* The sheet's tabs, as SheetTabs's row, the Character tab chosen. */}
            <div className={clsx(SHEET_TABS_ROW, 'gap-3')}>
              <Skeleton className='h-8 w-28 rounded-lg' />
              <Skeleton className='size-5 rounded-md' />
              <Skeleton className='size-5 rounded-md' />
              <Skeleton className='size-5 rounded-md' />
              <Skeleton className='size-5 rounded-md' />
              <Skeleton className='ml-auto size-5 rounded-md' />
            </div>
            <div className='@container min-h-0 flex-1 overflow-hidden'>
              <SheetSkeleton />
            </div>
          </div>
          {/* Combat and the chat, beside the sheet from 1024 px, as AsideColumn's. */}
          <div className={clsx(ASIDE_COLUMN, 'hidden', ASIDE_BESIDE)}>
            <div className={clsx(ASIDE_TABS_BAR, 'flex')}>
              <Skeleton className='h-8 w-24 rounded-lg' />
              <Skeleton className='h-8 w-20 rounded-lg' />
              <Skeleton className='h-3 w-24 rounded-md' />
            </div>
            <div className='flex flex-col gap-4 p-4'>
              <Skeleton className='h-24 w-4/5 rounded-2xl' />
              <Skeleton className='h-24 w-4/5 self-end rounded-2xl' />
              <Skeleton className='h-24 w-4/5 rounded-2xl' />
            </div>
          </div>
        </div>
      </div>
      {/* The tabs below 1024 px, as TableNav's: a bar on a phone, a rail beside a tablet. */}
      <div className={TABLE_NAV_BAR}>
        <TabSlot />
        <TabSlot />
        <TabSlot />
      </div>
    </div>
  )
}

/** The room one of the header's icon buttons takes, 32 px square on a phone and 44 from `sm`. */
function IconSlot({ className }: Readonly<{ className?: string }>) {
  return (
    <div
      className={clsx(
        'flex size-8 shrink-0 items-center justify-center sm:size-11',
        className,
      )}
    >
      <Skeleton className='size-5 rounded-md' />
    </div>
  )
}

/** The room one of the bar's or the rail's tabs takes: its icon over its label. */
function TabSlot() {
  return (
    <div className={TABLE_NAV_TAB}>
      <Skeleton className='size-6 rounded-lg' />
      <Skeleton className='h-3 w-14 rounded-md' />
    </div>
  )
}

/**
 * The room a line of words takes at the size its classes give it, one line tall, its block
 * standing for its words.
 */
function LineSlot({
  className,
  children,
}: Readonly<{ className?: string; children: ReactNode }>) {
  return (
    <div className={clsx('flex h-[1lh] items-center', className)}>
      {children}
    </div>
  )
}

/**
 * The Character tab's top, as CharacterSheet's: its card, with who the character is, a condition
 * or two, then its six tiles as a character with one size of hit die has them, the hit points and
 * the hit dice a pair, then armor class, proficiency, initiative and speed; then its abilities.
 */
function SheetSkeleton() {
  return (
    <div className={SHEET_TAB_PAGE}>
      <div className={SHEET_CARD}>
        <div className='flex items-center gap-4'>
          <Skeleton className='size-16 rounded-2xl' />
          <div className='grid min-w-0 flex-1 gap-2'>
            <Skeleton className='h-5 w-40 max-w-full rounded-md' />
            <Skeleton className='h-4 w-28 max-w-full rounded-md' />
          </div>
        </div>
        <div className='flex gap-1.5'>
          <Skeleton className='h-7.5 w-28 rounded-full' />
          <Skeleton className='h-7.5 w-24 rounded-full' />
        </div>
        <div className={statsGrid(1, false)}>
          <StatSkeleton wide='pair' bar />
          <StatSkeleton wide='pair' />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>
      </div>
      <div className={ABILITIES_SECTION}>
        <LineSlot className='text-xs'>
          <Skeleton className='h-2.5 w-16 rounded-md' />
        </LineSlot>
        <div className={ABILITIES_GRID}>
          <AbilitySkeleton />
          <AbilitySkeleton />
          <AbilitySkeleton />
          <AbilitySkeleton />
          <AbilitySkeleton />
          <AbilitySkeleton />
        </div>
      </div>
    </div>
  )
}

/**
 * One of the card's tiles, as Stat draws it: its label, a line of its size, over its value.
 * @param wide - As Stat's.
 * @param bar - The hit points' value, a line of its size over their bar; else a number beside its
 *   icon, as armor class, initiative and speed have, which the icon's foot, its baseline, makes
 *   2 px taller than a line of the number alone.
 */
function StatSkeleton({
  wide,
  bar = false,
}: Readonly<{ wide?: keyof typeof STAT_WIDE; bar?: boolean }>) {
  return (
    <div className={clsx(STAT_TILE, wide && STAT_WIDE[wide])}>
      <LineSlot className='px-3 text-[11px]'>
        <Skeleton className='h-2.5 w-16 max-w-full rounded-md' />
      </LineSlot>
      {bar ? (
        <div className='flex flex-col gap-1 px-3 text-lg'>
          <LineSlot>
            <Skeleton className='h-5 w-14 max-w-full rounded-md' />
          </LineSlot>
          <Skeleton className='h-1.5 w-full rounded-full' />
        </div>
      ) : (
        <div className='flex h-7.5 items-center gap-1 px-3'>
          <Skeleton className='size-4 rounded-md' />
          <Skeleton className='h-5 w-10 max-w-full rounded-md' />
        </div>
      )}
    </div>
  )
}

/** One ability's tile, as the sheet's: its name, its modifier and its score, then its save. */
function AbilitySkeleton() {
  return (
    <div className={clsx(ABILITY_TILE, 'border-border')}>
      <div className={ABILITY_CHECK}>
        <LineSlot className='text-xs'>
          <Skeleton className='h-2.5 w-8 rounded-md' />
        </LineSlot>
        <Skeleton className='h-6 w-10 rounded-md' />
        <Skeleton className='h-4.5 w-8 rounded-full' />
      </div>
      <div className={ABILITY_SAVE}>
        <LineSlot>
          <Skeleton className='h-2.5 w-14 rounded-md' />
        </LineSlot>
      </div>
    </div>
  )
}
