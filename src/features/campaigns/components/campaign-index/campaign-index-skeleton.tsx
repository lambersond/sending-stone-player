import clsx from 'clsx'
import {
  CAMPAIGN_CARD,
  CAMPAIGNS_HEAD,
  CAMPAIGNS_HEADING,
  CAMPAIGNS_LEAD,
} from '../../constants'
import { INDEX_GRID, INDEX_ROOT } from './constants'
import { Skeleton } from '@/components/skeleton/skeleton'
import { SkeletonStatus } from '@/components/skeleton/skeleton-status'

/**
 * The campaigns page while it reads the Gamemaster's campaigns (v0.48.0), laid out as
 * CampaignIndex lays the page out: its head's words, still, as they never change, and its buttons'
 * outlines; then two campaigns' rows, and from 900 px of the index a campaign's page beside them.
 * The head is drawn with the list, as the index's choice of campaign narrows it on a phone, so it
 * shows here rather than at once. Where the address asks for a campaign, a phone shows its page's
 * outline in place of the head and the list, as it will once the campaign is read. Its index, head,
 * grid and campaign's page are the page's own boxes, so that a change to one moves both.
 * @param asked - Whether the address asks for a campaign, `?campaign=<id>`.
 */
export function CampaignIndexSkeleton({ asked }: Readonly<{ asked: boolean }>) {
  return (
    <div className={INDEX_ROOT}>
      <SkeletonStatus />
      <div
        aria-hidden
        className={clsx(CAMPAIGNS_HEAD, asked && '@max-[900px]/index:hidden')}
      >
        <div className='min-w-0'>
          <p className='text-2xl font-semibold tracking-tight'>
            {CAMPAIGNS_HEADING}
          </p>
          <p className='mt-1 max-w-[46ch] text-text-secondary'>
            {CAMPAIGNS_LEAD}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {/* Connect Foundry and New campaign. */}
          <Skeleton className='h-10 w-44 rounded-xl' />
          <Skeleton className='h-10 w-40 rounded-xl' />
        </div>
      </div>
      <div className={INDEX_GRID}>
        <div
          className={clsx(
            'min-w-0 flex-col gap-2',
            asked ? 'hidden @min-[900px]/index:flex' : 'flex',
          )}
        >
          <RowSkeleton />
          <RowSkeleton />
        </div>
        <div
          className={clsx(
            'min-w-0 flex-col gap-4',
            asked ? 'flex' : 'hidden @min-[900px]/index:flex',
          )}
        >
          {/* All campaigns, back to the list on a phone. */}
          {asked && (
            <Skeleton className='h-10 w-36 rounded-lg @min-[900px]/index:hidden' />
          )}
          <CardSkeleton />
        </div>
      </div>
    </div>
  )
}

/** A campaign's row: its title, its game's line and its chip, then its seats. */
function RowSkeleton() {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-x-2.5 gap-y-1 rounded-[14px] border border-border bg-card p-3'>
      <div className='min-w-0'>
        <div className='flex h-[22.5px] items-center'>
          <Skeleton className='h-4 w-36 max-w-full rounded-md' />
        </div>
        <div className='flex h-[19.5px] items-center'>
          <Skeleton className='h-3 w-48 max-w-full rounded-md' />
        </div>
      </div>
      <Skeleton className='h-[26px] w-[4.5rem] rounded-full' />
      <div className='col-span-full flex h-6 items-center gap-3'>
        <Skeleton className='size-6 rounded-full' />
        <Skeleton className='h-3 w-32 rounded-md' />
      </div>
    </div>
  )
}

/** A campaign's page: its title and game, then its characters and its invite link. */
function CardSkeleton() {
  return (
    <div className={CAMPAIGN_CARD}>
      <div className='flex items-start justify-between gap-3'>
        <div className='grid min-w-0 gap-2'>
          <Skeleton className='h-6 w-48 max-w-full rounded-md' />
          <Skeleton className='h-4 w-56 max-w-full rounded-md' />
        </div>
        <Skeleton className='h-[26px] w-[4.5rem] rounded-full' />
      </div>
      <div className='grid gap-2'>
        <Skeleton className='h-4 w-28 rounded-md' />
        <Skeleton className='h-12 w-full rounded-xl' />
        <Skeleton className='h-12 w-full rounded-xl' />
      </div>
      <div className='grid gap-2'>
        <Skeleton className='h-4 w-24 rounded-md' />
        <Skeleton className='h-12 w-full rounded-xl' />
      </div>
    </div>
  )
}
