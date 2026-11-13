import clsx from 'clsx'
import { Skeleton } from '@/components/skeleton/skeleton'
import { SkeletonStatus } from '@/components/skeleton/skeleton-status'
import { SHEET_TAB_PAGE, SHEET_TABS_ROW } from '@/features/sheet/constants'
import {
  ASIDE_BESIDE,
  GM_PILL,
  TABLE_FRAME,
  TABLE_HEADER_BAR,
  TABLE_NAV_BAR,
} from '@/features/table/constants'

/**
 * A character's table while it's read (v0.48.0), at its player's seat or its Gamemaster's: laid out
 * as GameTable lays it out at every width, so that nothing moves as the table takes its place. The
 * header, with the character's name, known from the page's check, where the table's shows it, and
 * at the Gamemaster's seat the GM pill; the sheet's tabs, its first tiles and its abilities; from
 * 1024 px the combat and chat column beside it, and narrower the tabs, in a bar at the bottom of a
 * phone or a rail beside a tablet. Its name and pill are hidden from assistive technology with the
 * rest, as the page's title has the name and its status says it's loading. Its frame, header
 * bar, tabs' row, tab page, column and bar are the table's and the sheet's own boxes, so that a
 * change to one moves both.
 * @param gm - Whether it's the Gamemaster's seat, whose header has the GM pill and no Delete.
 */
export function GameTableSkeleton({
  name,
  gm = false,
}: Readonly<{ name: string; gm?: boolean }>) {
  return (
    <div className={TABLE_FRAME}>
      <SkeletonStatus />
      <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
        {/* The header, as TableHeader's: back, the name and its line, then its buttons. */}
        <div className={TABLE_HEADER_BAR}>
          <div className='flex min-w-0 items-center gap-2'>
            <IconSlot className='-ml-1.5 sm:-ml-3' />
            <div aria-hidden className='min-w-0'>
              <div className='flex items-baseline gap-2 overflow-hidden'>
                <p
                  className={clsx(
                    'truncate text-lg leading-tight font-semibold',
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
        <div className='flex min-h-0 flex-1'>
          <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
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
          <div
            className={clsx(
              'hidden min-h-0 min-w-0 flex-col lg:flex',
              ASIDE_BESIDE,
            )}
          >
            <div className='flex h-12 shrink-0 items-center gap-3 border-b border-border px-3'>
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
    <div className='flex min-h-14 flex-1 flex-col items-center justify-center gap-1 md:min-h-18 md:w-full md:flex-none'>
      <Skeleton className='size-6 rounded-lg' />
      <Skeleton className='h-3 w-14 rounded-md' />
    </div>
  )
}

/** The Character tab's top, as CharacterSheet's: its card of tiles, then the six abilities. */
function SheetSkeleton() {
  return (
    <div className={SHEET_TAB_PAGE}>
      <div className='flex flex-col gap-4 rounded-2xl border border-border bg-card p-4'>
        <div className='flex items-center gap-4'>
          <Skeleton className='size-16 rounded-2xl' />
          <div className='grid min-w-0 flex-1 gap-2'>
            <Skeleton className='h-5 w-40 max-w-full rounded-md' />
            <Skeleton className='h-4 w-28 max-w-full rounded-md' />
          </div>
        </div>
        <div className='flex gap-1.5'>
          <Skeleton className='h-7 w-28 rounded-full' />
          <Skeleton className='h-7 w-24 rounded-full' />
        </div>
        <div className='grid grid-cols-2 gap-2 @lg:grid-cols-4'>
          <Skeleton className='h-[4.5rem] rounded-xl' />
          <Skeleton className='h-[4.5rem] rounded-xl' />
          <Skeleton className='h-[4.5rem] rounded-xl' />
          <Skeleton className='h-[4.5rem] rounded-xl' />
        </div>
      </div>
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-3 w-20 rounded-md' />
        <div className='grid grid-cols-3 gap-2 @xl:grid-cols-6'>
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

/** One ability's tile: its name, its modifier and score, and its save across its foot. */
function AbilitySkeleton() {
  return (
    <div className='flex flex-col items-center gap-2 rounded-2xl border border-border bg-card pt-3'>
      <Skeleton className='h-3 w-8 rounded-md' />
      <Skeleton className='h-6 w-10 rounded-md' />
      <Skeleton className='h-4 w-8 rounded-full' />
      <div className='flex h-8 w-full items-center justify-center border-t border-border'>
        <Skeleton className='h-3 w-14 rounded-md' />
      </div>
    </div>
  )
}
