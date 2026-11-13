import clsx from 'clsx'
import { INVITE_PAGE } from './constants'
import { Skeleton } from '@/components/skeleton/skeleton'
import { SkeletonStatus } from '@/components/skeleton/skeleton-status'
import {
  CHOOSER_CHOICES,
  CHOOSER_OPTION,
} from '@/features/characters/components/character-chooser/constants'

/**
 * An invite link while it's read (v0.48.0), shaped as InviteChoice draws a working one: what the
 * player is invited to, its title and its game's line, then two of its characters to choose from
 * and the button that joins as one. Nothing of it is known until the invite is read. Its box is
 * the invite's own, and its characters' the chooser's, so that a change to one moves both.
 */
export function InviteSkeleton() {
  return (
    <div className={INVITE_PAGE}>
      <SkeletonStatus />
      <div className='flex h-5 items-center'>
        <Skeleton className='h-3 w-24 rounded-md' />
      </div>
      <div className='mt-1 flex h-8 items-center'>
        <Skeleton className='h-6 w-56 max-w-full rounded-md' />
      </div>
      <div className='mt-1 flex h-5 items-center'>
        <Skeleton className='h-3 w-64 max-w-full rounded-md' />
      </div>
      <div className={clsx('mt-8', CHOOSER_CHOICES)}>
        {/* Its legend, whose margin the gap below it is, as a legend is no grid item. */}
        <div className='flex h-5 items-center'>
          <Skeleton className='h-3 w-48 rounded-md' />
        </div>
        <OptionSkeleton />
        <OptionSkeleton />
      </div>
      <Skeleton className='mt-4 h-11 w-52 rounded-xl' />
    </div>
  )
}

/** One character to choose: its radio, its avatar and its name. */
function OptionSkeleton() {
  return (
    <div className={CHOOSER_OPTION}>
      <Skeleton className='size-4 rounded-full' />
      <Skeleton className='size-9 rounded-full' />
      <Skeleton className='h-4 w-40 max-w-full rounded-md' />
    </div>
  )
}
